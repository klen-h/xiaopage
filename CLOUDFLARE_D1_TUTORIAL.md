# Cloudflare D1 使用教程

## 1. 创建 D1 数据库

### 在 Cloudflare Dashboard 创建
1. 访问 https://dash.cloudflare.com/
2. 左侧菜单选择 "Workers & Pages" → "D1"
3. 点击 "Create database"
4. 数据库名称：`xiaopage-db`
5. 点击 "Create"

### 使用 Wrangler CLI 创建（可选）
```bash
npm install -g wrangler
wrangler d1 create xiaopage-db
```

## 2. 创建表结构

### 方法一：在 Dashboard 中执行 SQL
1. 进入创建的数据库
2. 点击 "Console"
3. 执行以下 SQL：

```sql
CREATE TABLE IF NOT EXISTS videos (
  _id TEXT PRIMARY KEY,
  id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  sentiment_score INTEGER,
  summary TEXT,
  tags TEXT,  -- JSON 数组字符串
  structured TEXT,  -- JSON 对象字符串
  weight REAL,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_date ON videos(date DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment ON videos(sentiment_score);
```

### 方法二：使用 Wrangler CLI
创建 `schema.sql` 文件：
```sql
CREATE TABLE IF NOT EXISTS videos (
  _id TEXT PRIMARY KEY,
  id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  sentiment_score INTEGER,
  summary TEXT,
  tags TEXT,
  structured TEXT,
  weight REAL,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_date ON videos(date DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment ON videos(sentiment_score);
```

执行：
```bash
wrangler d1 execute xiaopage-db --file=./schema.sql
```

## 3. 在 Cloudflare Pages 中绑定 D1

### 方法一：在 Dashboard 中绑定
1. 进入 Cloudflare Pages 项目
2. 点击 "Settings" → "Functions" → "D1 databases"
3. 点击 "Add binding"
4. 变量名：`DB`
5. 选择数据库：`xiaopage-db`
6. 点击 "Save"

### 方法二：使用 Wrangler 配置
创建或更新 `wrangler.toml`：
```toml
[[d1_databases]]
binding = "DB"
database_name = "xiaopage-db"
database_id = "your-database-id"
```

## 4. 在 GitHub Actions 中写入数据

修改 `.github/workflows/check-bilibili.yml`，添加 D1 写入步骤：

```yaml
- name: 写入数据到 D1
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  run: |
    npm install -g wrangler
    # 读取 videos.json
    node -e "
      const videos = require('./public/data/videos.json');
      const fs = require('fs');
      fs.writeFileSync('videos-for-d1.json', JSON.stringify(videos));
    "
    # 使用 wrangler 批量插入
    wrangler d1 execute xiaopage-db --command="DELETE FROM videos"
    wrangler d1 execute xiaopage-db --command="INSERT INTO videos (_id, id, title, date, sentiment_score, summary, tags, structured, weight) SELECT _id, id, title, date, sentiment_score, summary, tags, structured, weight FROM read_json('videos-for-d1.json')"
```

### 获取 Cloudflare API Token
1. 访问 https://dash.cloudflare.com/profile/api-tokens
2. 创建 Token，权限选择 "Cloudflare D1 - Edit"
3. 复制 Token 添加到 GitHub Secrets：`CLOUDFLARE_API_TOKEN`

### 获取 Account ID
1. 访问 https://dash.cloudflare.com/
2. 右侧可以看到 Account ID
3. 添加到 GitHub Secrets：`CLOUDFLARE_ACCOUNT_ID`

## 5. 在前端读取数据

### 方法一：使用 Cloudflare Workers API（推荐）
创建 `src/api/cloudflare-d1.ts`：

```typescript
interface Video {
  _id: string;
  id: string;
  title: string;
  date: string;
  sentiment_score: number;
  summary: string;
  tags: string;
  structured: string;
  weight: number;
}

export async function fetchVideosFromD1(): Promise<Video[]> {
  try {
    // 通过 Cloudflare Workers 代理查询 D1
    const response = await fetch('/api/videos')
    if (!response.ok) throw new Error('Failed to fetch videos')
    return await response.json()
  } catch (error) {
    console.error('Error fetching videos:', error)
    // 降级到本地 JSON
    const res = await fetch('/data/videos.json')
    return await res.json()
  }
}
```

### 方法二：直接使用 Cloudflare D1 HTTP API
创建 `src/api/direct-d1.ts`：

```typescript
const CLOUDFLARE_ACCOUNT_ID = import.meta.env.CLOUDFLARE_ACCOUNT_ID
const CLOUDFLARE_API_TOKEN = import.meta.env.CLOUDFLARE_D1_API_TOKEN
const DATABASE_ID = 'your-database-id'

export async function fetchVideosFromD1Direct(): Promise<any[]> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sql: 'SELECT * FROM videos ORDER BY date DESC LIMIT 1000'
      })
    }
  )
  
  const data = await response.json()
  return data.result[0].results
}
```

## 6. 创建 Cloudflare Workers（可选）

如果需要 API 端点，创建 `worker/index.js`：

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    
    if (url.pathname === '/api/videos') {
      const { results } = await env.DB.prepare(
        'SELECT * FROM videos ORDER BY date DESC LIMIT 1000'
      ).all()
      
      return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    return new Response('Not found', { status: 404 })
  }
}
```

在 `wrangler.toml` 中配置：
```toml
[site]
bucket = "./dist"

[[d1_databases]]
binding = "DB"
database_name = "xiaopage-db"
database_id = "your-database-id"
```

## 7. 免费额度

- 每天读取：100,000 次
- 每天写入：100,000 次
- 存储：5 GB
- 查询结果大小：1 GB/天

对于当前项目（每小时更新一次，每天读取 < 1000 次），免费额度完全够用。

## 8. 迁移步骤总结

1. ✅ 创建 D1 数据库
2. ✅ 创建表结构
3. ✅ 在 Cloudflare Pages 绑定数据库
4. ⏳ 修改 GitHub Actions 写入 D1
5. ⏳ 修改前端读取逻辑
6. ⏳ 测试完整流程

## 9. 注意事项

- D1 是边缘数据库，数据最终一致性，写入后可能需要几秒钟才能全局同步
- 使用参数化查询防止 SQL 注入
- 定期备份数据（使用 `wrangler d1 export`）
- 监控免费额度使用情况
