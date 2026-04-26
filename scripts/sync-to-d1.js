const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 读取 videos.json
const videosPath = path.resolve('public/data/videos.json');
const videos = JSON.parse(fs.readFileSync(videosPath, 'utf-8'));

console.log(`准备同步 ${videos.length} 条视频数据到 D1...`);

// 构建 SQL 插入语句
const insertStatements = videos.map(video => {
  const { _id, id, title, date, sentiment_score, summary, tags, structured, weight } = video;
  // 转义单引号
  const escape = (str) => str ? str.replace(/'/g, "''") : '';
  const tagsJson = tags ? JSON.stringify(tags) : '[]';
  const structuredJson = structured ? JSON.stringify(structured) : '{}';
  
  return `INSERT OR REPLACE INTO videos (_id, id, title, date, sentiment_score, summary, tags, structured, weight) 
          VALUES ('${_id}', '${id}', '${escape(title)}', '${date}', ${sentiment_score || 0}, '${escape(summary)}', '${escape(tagsJson)}', '${escape(structuredJson)}', ${weight || 1});`;
}).join('\n');

// 写入临时 SQL 文件
const tempSqlPath = path.resolve('temp-insert.sql');
fs.writeFileSync(tempSqlPath, insertStatements);

console.log('执行 SQL 插入...');
try {
  execSync(`wrangler d1 execute xiaopage-db --remote --file="${tempSqlPath}"`, { 
    stdio: 'inherit',
    encoding: 'utf-8'
  });
  console.log('✅ 数据同步成功');
} catch (error) {
  console.error('❌ 数据同步失败:', error.message);
  process.exit(1);
} finally {
  // 清理临时文件
  if (fs.existsSync(tempSqlPath)) {
    fs.unlinkSync(tempSqlPath);
  }
}
