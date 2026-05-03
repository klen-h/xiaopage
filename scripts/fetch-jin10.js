/**
 * 金十快讯实时监控 - 完整版
 * 采集 → 过滤 → 聚合 → LLM分析 → 企微推送 → 状态保存
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

// ==================== 配置区域 ====================
const JIN10_COOKIE = process.env.JIN10_COOKIE || '';
const WECHAT_WEBHOOK = process.env.WECHAT_WEBHOOK || '';
const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.siliconflow.cn/v1';
const LLM_MODEL = process.env.LLM_MODEL || 'deepseek-ai/DeepSeek-V3';

const TEMP_DIR = path.resolve('temp');
const DATA_DIR = path.resolve('public/data');
const STATE_PATH = path.join(DATA_DIR, 'jin10_state.json');
const RAW_PATH = path.join(DATA_DIR, 'jin10_flash.json');
const ANALYSIS_PATH = path.join(DATA_DIR, 'jin10_analysis.json');

// 硬规则：排除这些模式
const EXCLUDE_PATTERNS = [
  /^【金十数据整理[：:]/,
  /^【今日重点关注的财经数据/,
  /^【财料】/,
  /^【金十整理[：:]/,
  /涨\d+%.*股价再创历史新高/,
  /估值或升至逾\d+亿美元/,
  /Good afternoon/i,
  /"好好先生"/i,
  /特朗普.*"太迟先生"/i,
];

// 低价值关键词（标题党、情绪宣泄）
const LOW_VALUE_KEYWORDS = [
  '俏皮话', '最后一次新闻发布会', '不会成为"影子主席"',
  '部署时间创纪录', '厕所也反复出现问题',
  '特朗普：其他地方没人要他',
];

// 个股财报关键词（走另一条通道，不走宏观）
const STOCK_REPORT_KEYWORDS = [
  '一季度净利润', '第一季度净利润', 'Q1净利润',
  '一季度营收', '第一季度营收',
];

// A股相关关键词（用于相关性判断）
const A_STOCK_KEYWORDS = [
  'A股', '上证', '深证', '创业板', '科创板', '沪指', '深成指', '沪深300',
  '央行', '降准', '降息', 'MLF', 'LPR', '逆回购', '汇金', '社保基金',
  '证监会', 'IPO', '再融资', '减持', '增持',
  '中美', '关税', '贸易', '谈判', '制裁',
  '伊朗', '霍尔木兹', '原油', '黄金', '美联储', '鲍威尔', '加息', '降息',
  '房地产', '限购', '公积金', '地产',
  '证券', '券商', '银行', '保险', '半导体', '芯片', 'AI', '新能源',
];

// 事件簇定义（用于聚合）
const EVENT_CLUSTERS = [
  { name: '美联储利率决议', keywords: ['美联储', 'FOMC', '利率决议', '维持利率', '降息', '加息', '鲍威尔'] },
  { name: '美联储人事变动', keywords: ['沃什', '美联储主席提名', '参议院', '米兰', '哈玛克', '卡什卡利'] },
  { name: '伊朗局势', keywords: ['伊朗', '霍尔木兹', '核计划', '封锁', '特朗普.*伊朗', '美伊', '伊美'] },
  { name: '中东战争授权', keywords: ['战争授权', '战争权力法', '60天', '国会授权', '军事行动'] },
  { name: '原油能源', keywords: ['原油', '油价', '石油', 'WTI', '布伦特', 'EIA', '欧佩克', 'OPEC'] },
  { name: '黄金贵金属', keywords: ['黄金', '增持黄金', '世界黄金协会', '白银'] },
  { name: '国内政策', keywords: ['证监会', '央行', '降准', '降息', 'LPR', 'MLF', '限购', '公积金', '深圳.*房地产'] },
  { name: '中美贸易', keywords: ['中美', '关税', '贸易', '半导体', '华虹', '脱钩'] },
  { name: '俄乌局势', keywords: ['普京', '俄乌', '乌克兰', '停火', '胜利日'] },
  { name: '科技股财报', keywords: ['谷歌财报', '微软财报', '亚马逊财报', 'Meta财报', '苹果财报'] },
];

// ==================== 主入口 ====================
async function main() {
  console.log(`\n[${formatTime()}] 🚀 金十快讯监控启动`);

  // 1. 采集
  const items = await fetchJin10();
  if (items.length === 0) {
    console.log('❌ 未获取到数据');
    process.exit(0);
  }

  // 2. 去重（基于 state.lastId）
  const newItems = getNewItems(items);
  if (newItems.length === 0) {
    console.log('⏭️ 无新增快讯');
    process.exit(0);
  }
  console.log(`📥 新增 ${newItems.length} 条`);

  // 3. 硬规则过滤
  const filtered = preFilter(newItems);
  console.log(`🔍 硬过滤后: ${filtered.length} 条`);

  // 4. 同事件聚合
  const clustered = deduplicateByEvent(filtered);
  console.log(`📦 聚合为 ${clustered.length} 个事件簇`);

  // 5. 判断哪些需要 LLM 分析
  const state = loadState();
  const toAnalyze = [];
  const toUpdate = []; // 已有事件但需更新状态

  for (const cluster of clustered) {
    const existing = state.pushedClusters?.find(p => p.cluster === cluster._cluster);

    if (!existing) {
      // 全新事件
      toAnalyze.push(cluster);
    } else if (cluster.hot === '爆' && existing.pushCount === 0) {
      // 已有事件升级成"爆"
      console.log(`🔥 ${cluster._cluster} 升级为"爆"，补推`);
      toAnalyze.push(cluster);
    } else {
      // 静默更新状态
      toUpdate.push({ cluster: cluster._cluster, lastId: cluster.id });
    }
  }

  // 6. LLM 分析 + 推送
  if (toAnalyze.length > 0) {
    console.log(`🧠 送审 LLM: ${toAnalyze.length} 个事件簇`);
    const analysis = await analyzeWithLLM(toAnalyze);

    // 推送到企微
    await pushWechat(analysis, toAnalyze);

    // 更新推送状态
    for (const cluster of toAnalyze) {
      const existingIdx = state.pushedClusters?.findIndex(p => p.cluster === cluster._cluster);
      if (existingIdx >= 0) {
        state.pushedClusters[existingIdx].pushCount++;
        state.pushedClusters[existingIdx].lastUpdateId = cluster.id;
        state.pushedClusters[existingIdx].lastUpdateTime = new Date().toISOString();
      } else {
        state.pushedClusters = state.pushedClusters || [];
        state.pushedClusters.push({
          cluster: cluster._cluster,
          firstId: cluster.id,
          firstTime: new Date().toISOString(),
          lastUpdateId: cluster.id,
          lastUpdateTime: new Date().toISOString(),
          pushCount: 1,
          hotMax: cluster.hot === '爆' ? '爆' : '沸',
        });
      }
    }
  } else {
    console.log('📭 无新事件需分析，静默');
  }

  // 更新静默事件的状态
  for (const update of toUpdate) {
    const existing = state.pushedClusters?.find(p => p.cluster === update.cluster);
    if (existing) {
      existing.lastUpdateId = update.lastId;
      existing.lastUpdateTime = new Date().toISOString();
    }
  }

  // 7. 保存所有数据
  saveState(state);
  saveRawData(items, newItems);
  if (toAnalyze.length > 0) {
    saveAnalysis(toAnalyze);
  }

  console.log(`[${formatTime()}] ✅ 完成\n`);
}

// ==================== 采集 ====================
async function fetchJin10() {
  const params = JSON.stringify({ hot: ["爆", "沸"], channel: [1, 2, 3, 5] });

  try {
    const { data } = await axios.get(
      `https://3318fc142ea545eab931e22a61ec6e5c.z3c.jin10.com/flash?params=${encodeURIComponent(params)}`,
      {
        headers: {
          'accept': 'application/json, text/plain, */*',
          'accept-language': 'zh-CN,zh;q=0.9',
          'handleerror': 'true',
          'origin': 'https://www.jin10.com',
          'referer': 'https://www.jin10.com/',
          'sec-ch-ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
          'x-app-id': 'bVBF4FyRTn5NJF5n',
          'x-version': '1.0',
          'cookie': JIN10_COOKIE
        },
        timeout: 15000
      }
    );

    if (!Array.isArray(data.data)) {
      console.error('返回格式异常:', typeof data.data);
      return [];
    }

    return data.data.map(item => ({
      id: item.id,
      time: item.time,  
      hot: item.hot,
      content: item.data?.content || '',
      source: item.data?.source || '',
      source_link: item.data?.source_link || '',
      important: item.important,
      channel: item.channel || [],
      collectedAt: new Date().toISOString()
    }));

  } catch (error) {
    console.error('❌ 采集失败:', error.response?.status, error.message);
    return [];
  }
}

// ==================== 去重 ====================
function getNewItems(items) {
  const state = loadState();
  const lastId = state.lastId || '';

  // 按ID降序（新在前）
  const sorted = [...items].sort((a, b) => (a.id > b.id ? -1 : 1));

  let newItems;
  if (!lastId) {
    newItems = sorted.slice(0, 5); // 首次只取5条
    console.log('🆕 首次运行，取最近5条');
  } else {
    newItems = sorted.filter(i => i.id > lastId);
  }

  // 更新 lastId
  if (sorted.length > 0) {
    state.lastId = sorted[0].id;
    saveState(state);
  }

  return newItems.reverse(); // 时间正序
}

// ==================== 硬规则过滤 ====================
function preFilter(items) {
  return items.filter(item => {
    const content = item.content || '';

    // 1. 排除汇总类/无意义类
    if (EXCLUDE_PATTERNS.some(p => p.test(content))) {
      console.log(`   🚫 排除(模式匹配): ${content.slice(0, 40)}...`);
      return false;
    }

    // 2. 排除低价值关键词
    if (LOW_VALUE_KEYWORDS.some(kw => content.includes(kw))) {
      console.log(`   🚫 排除(低价值): ${content.slice(0, 40)}...`);
      return false;
    }

    // 3. 纯个股财报走另一条通道
    const isStockReport = STOCK_REPORT_KEYWORDS.some(kw => content.includes(kw));
    const hasMacro = A_STOCK_KEYWORDS.some(kw => content.includes(kw));
    if (isStockReport && !hasMacro) {
      console.log(`   🚫 排除(个股财报): ${content.slice(0, 40)}...`);
      return false;
    }

    return true;
  });
}

// ==================== 同事件聚合 ====================
function deduplicateByEvent(items) {
  const clusters = [];
  const usedIds = new Set();

  for (const item of items) {
    if (usedIds.has(item.id)) continue;

    const content = item.content || '';
    let matched = false;

    for (const clusterDef of EVENT_CLUSTERS) {
      // 检查是否匹配该事件簇
      const isMatch = clusterDef.keywords.some(kw => {
        if (kw.includes('.*')) {
          return new RegExp(kw).test(content);
        }
        return content.includes(kw);
      });

      if (isMatch) {
        const existing = clusters.find(c => c.clusterName === clusterDef.name);

        if (!existing) {
          clusters.push({
            clusterName: clusterDef.name,
            representative: item,
            allItems: [item],
            hotMax: item.hot === '爆' ? 2 : 1,
            earliestTime: item.time,
          });
        } else {
          existing.allItems.push(item);
          if (item.hot === '爆') existing.hotMax = 2;
          // 保留 source_link 更完整的
          if ((item.source_link || '').length > (existing.representative.source_link || '').length) {
            existing.representative = item;
          }
        }

        usedIds.add(item.id);
        matched = true;
        break;
      }
    }

    // 未匹配到任何簇，单独成簇
    if (!matched) {
      clusters.push({
        clusterName: '其他',
        representative: item,
        allItems: [item],
        hotMax: item.hot === '爆' ? 2 : 1,
        earliestTime: item.time,
      });
      usedIds.add(item.id);
    }
  }

  // 返回代表条目，附加簇信息
  return clusters.map(c => ({
    ...c.representative,
    _cluster: c.clusterName,
    _clusterSize: c.allItems.length,
    _clusterHot: c.hotMax === 2 ? '爆' : '沸',
    _clusterTime: c.earliestTime,
  }));
}

// ==================== LLM 分析 ====================
async function analyzeWithLLM(clusteredItems) {
  // 构建输入文本
  const flashText = clusteredItems.map(i => {
    const sizeTag = i._clusterSize > 1 ? ` [本簇共${i._clusterSize}条]` : '';
    return `[${i._clusterHot}]${sizeTag} ${i._cluster}\n时间: ${i.time}\n来源: ${i.source || '金十'}\n${i.content.slice(0, 300)}...`;
  }).join('\n\n---\n\n');

  const prompt = `你是一位宏观交易信号过滤专家。以下每个 [---] 分隔的是一个"事件簇"（同一事件的多条快讯聚合），请严格判断：

【核心标准】
1. 是否已被市场充分定价？（预期内/反复更新的已知事实 = 价值0）
2. 是否改变A股某板块的基本面预期？（政策、资金、供需）
3. 是否可能引发次日开盘跳空/放量/板块轮动？
4. 对"低估值、高股息、逆向布局"框架是否有启示？

【输入事件簇】
${flashText}

【输出要求】
- 只输出 value_score >= 7 的事件
- 每天最多 3 个事件
- 如果全部价值低于7，输出空数组
- 必须诚实标注"无价值"，不要强行解读

【输出格式】（严格JSON）
{
  "market_mood": "string, 恐慌/谨慎/中性/乐观/狂热",
  "noise_level": "integer, 0-100",
  "top_events": [
    {
      "cluster_name": "string, 事件名称",
      "value_score": "integer, 1-10",
      "action": "string, 加仓/减仓/调仓/观望/止损/止盈",
      "target": "string, 具体ETF或板块",
      "urgency": "string, 立即/开盘前/日内/不紧急",
      "why": "string, 一句话说明核心价值",
      "transmission": "string, 传导路径",
      "duration": "string, 影响时长",
      "contrarian": "string, 逆向机会？",
      "risk": "string, 若误读的最大风险"
    }
  ],
  "daily_strategy": {
    "overall_position": "string",
    "core_logic": "string, 50字内",
    "key_risks": ["string"],
    "watchlist": ["string"]
  }
}`;

  try {
    const response = await axios.post(
      `${LLM_BASE_URL}/chat/completions`,
      {
        model: LLM_MODEL,
        messages: [
          { role: "system", content: "你是冷酷的宏观信号过滤机器。对无价值信息要毫不留情。必须输出合法JSON。" },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: "json_object" }
      },
      {
        headers: { 'Authorization': `Bearer ${LLM_API_KEY}` },
        timeout: 120000
      }
    );

    const content = response.data.choices[0].message.content;
    const parsed = JSON.parse(content);

    console.log('✅ LLM 分析完成');
    console.log(`   情绪: ${parsed.market_mood} | 噪音: ${parsed.noise_level}%`);
    const events = parsed.top_events || [];
    events.forEach(e => {
      console.log(`   🚨 [${e.urgency}] ${e.action} ${e.target} (${e.value_score}分)`);
    });

    return parsed;

  } catch (error) {
    console.error('❌ LLM 失败:', error.message?.slice(0, 200));
    return { market_mood: '未知', noise_level: 0, top_events: [], daily_strategy: {} };
  }
}

// ==================== 企微推送 ====================
async function pushWechat(analysis, rawItems) {
  if (!WECHAT_WEBHOOK) {
    console.log('⚠️ 未配置 WECHAT_WEBHOOK');
    return;
  }

  const events = analysis.top_events || [];
  if (events.length === 0) {
    console.log('📭 无高价值信号，不推送');
    return;
  }

  const now = formatTime();

  let markdown = `## ⚡ 金十快讯信号 <font color="warning">${analysis.market_mood}</font>
> 时间：${now} | 噪音率：${analysis.noise_level || '?'}%
> 仓位建议：**${analysis.daily_strategy?.overall_position || '观望'}**
> 核心逻辑：${analysis.daily_strategy?.core_logic || '无'}

---

`;

  for (const event of events.slice(0, 3)) {
    const raw = rawItems.find(i => i._cluster === event.cluster_name);
    const scoreColor = event.value_score >= 8 ? 'red' : (event.value_score >= 6 ? 'warning' : 'info');

    markdown += `### <font color="${scoreColor}">【${event.urgency}】${event.action} ${event.target} (${event.value_score}分)</font>
**事件：** ${event.cluster_name}
**逻辑：** ${event.why}
**传导：** ${event.transmission || '无'} | **时长：** ${event.duration || '未知'}

**逆向机会：** ${event.contrarian || '无'}
**误读风险：** ${event.risk || '无'}

${raw ? `> 原文：${raw.content.slice(0, 80)}...` : ''}

---
`;
  }

  // 风险提示
  if (analysis.daily_strategy?.key_risks?.length > 0) {
    markdown += `\n### ⚠️ 今日警惕\n${analysis.daily_strategy.key_risks.map(r => `- ${r}`).join('\n')}\n`;
  }

  // 观察清单
  if (analysis.daily_strategy?.watchlist?.length > 0) {
    markdown += `\n### 👀 重点观察\n${analysis.daily_strategy.watchlist.join('、')}\n`;
  }

  try {
    await axios.post(
      WECHAT_WEBHOOK,
      { msgtype: 'markdown', markdown: { content: markdown } },
      { timeout: 15000 }
    );
    console.log('📲 企微推送成功');
  } catch (error) {
    console.error('❌ 企微推送失败:', error.response?.data || error.message);
  }
}

// ==================== 状态管理 ====================
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
  } catch {
    return { lastId: '', pushedClusters: [] };
  }
}

function saveState(state) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

// ==================== 数据持久化 ====================
function saveRawData(allItems, newItems) {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  let history = { date: '', items: [] };
  try {
    history = JSON.parse(fs.readFileSync(RAW_PATH, 'utf-8'));
  } catch {}

  const today = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });

  // 合并新数据
  const existingIds = new Set(history.items.map(i => i.id));
  const uniqueNew = newItems.filter(i => !existingIds.has(i.id));

  history.items = [...uniqueNew, ...history.items].slice(0, 300); // 保留最近300条
  history.date = today;
  history.lastUpdated = new Date().toISOString();

  fs.writeFileSync(RAW_PATH, JSON.stringify(history, null, 2));
}

function saveAnalysis(analyzedItems) {
  let history = { analyses: [] };
  try {
    history = JSON.parse(fs.readFileSync(ANALYSIS_PATH, 'utf-8'));
  } catch {}

  history.analyses.unshift({
    time: new Date().toISOString(),
    clusters: analyzedItems.map(i => ({
      cluster: i._cluster,
      hot: i._clusterHot,
      size: i._clusterSize,
      content: i.content.slice(0, 100),
    }))
  });

  history.analyses = history.analyses.slice(0, 50); // 保留50次
  fs.writeFileSync(ANALYSIS_PATH, JSON.stringify(history, null, 2));
}

// ==================== 工具函数 ====================
function formatTime() {
  return new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ==================== 运行 ====================
main().catch(err => {
  console.error('脚本异常:', err);
  process.exit(1);
});