/**
 * 金十快讯实时监控 - 原油核心版（修复版）
 * 修复：时间敏感词识别、板块行情保留、重大更新重新触发
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

const DATA_DIR = path.resolve('public/data');
const STATE_PATH = path.join(DATA_DIR, 'jin10_state.json');
const RAW_PATH = path.join(DATA_DIR, 'jin10_flash.json');
const ANALYSIS_PATH = path.join(DATA_DIR, 'jin10_analysis.json');

import { HOLDINGSTEXT } from './const/index.js';
import { getMarketData } from './data-layer.js';

// ==================== 过滤规则 ====================
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
  /特朗普.*其他地方没人要他/i,
];

const LOW_VALUE_KEYWORDS = [
  '俏皮话', '最后一次新闻发布会', '不会成为"影子主席"',
  '部署时间创纪录', '厕所也反复出现问题',
];

const URGENT_TIME_KEYWORDS = [
  '几小时内', '即将', '马上', '立刻', '立即',
  '倒计时', '最后期限', '最后通牒',
  '周一早上', '周二', '明天', '今晚',
  '行动开始', '行动将在', '启动.*行动',
  '几小时', '数小时内', '接下来',
];

const A_STOCK_KEYWORDS = [
  '原油', '油价', '石油', 'WTI', '布伦特', 'Brent', 'EIA',
  '欧佩克', 'OPEC', '页岩油', '战略储备', '储油', '管道',
  '霍尔木兹', '海峡', '油轮', '油运', '航运',
  '沙特', '阿联酋', '科威特', '伊拉克', '委内瑞拉',
  '三桶油', '中石油', '中石化', '中海油',
  '化工', '塑料', 'PTA', '沥青', '化肥',
  '通胀', 'CPI', 'PPI', '美联储', '加息', '降息', '鲍威尔',
  '央行', '降准', 'MLF', 'LPR',
  'A股', '上证', '深证', '创业板', '沪指', '沪深300',
  '汇金', '社保基金', '国家队',
  '伊朗', '核计划', '封锁', '美伊', '中东', '战争',
  '中美', '关税', '贸易', '制裁',
  '证券', '券商', '银行', '保险', '半导体', '芯片',
  '房地产', '限购', '公积金',
];

const EVENT_CLUSTERS = [
  { 
    name: '原油能源', 
    keywords: [
      '原油', '油价', '石油', 'WTI', '布伦特', 'Brent', 
      'EIA', '欧佩克', 'OPEC', '页岩油', '战略储备',
      '霍尔木兹', '海峡', '油轮', '储油', '管道', '出口',
      '沙特', '阿联酋', '科威特', '伊拉克', '委内瑞拉',
      '三桶油', '中石油', '中石化', '中海油',
      '化工', '塑料', 'PTA', '沥青', '化肥', '油运'
    ] 
  },
  { 
    name: '伊朗局势', 
    keywords: ['伊朗', '核计划', '封锁', '特朗普.*伊朗', '美伊', '伊美', '哈梅内伊'] 
  },
  { 
    name: '中东战争', 
    keywords: ['战争授权', '战争权力法', '60天', '国会授权', '军事行动', '以军', '真主党', '哈马斯'] 
  },
  { 
    name: '美联储利率', 
    keywords: ['美联储', 'FOMC', '利率决议', '维持利率', '降息', '加息', '鲍威尔', '沃什'] 
  },
  { 
    name: '美联储人事', 
    keywords: ['沃什', '美联储主席提名', '参议院', '米兰', '哈玛克', '卡什卡利'] 
  },
  { 
    name: '黄金贵金属', 
    keywords: ['黄金', '增持黄金', '世界黄金协会', '白银', '央行购金'] 
  },
  { 
    name: '国内政策', 
    keywords: ['证监会', '央行', '降准', '降息', 'LPR', 'MLF', '限购', '公积金', '房地产'] 
  },
  { 
    name: '中美贸易', 
    keywords: ['中美', '关税', '贸易', '半导体', '华虹', '脱钩'] 
  },
  { 
    name: '俄乌局势', 
    keywords: ['普京', '俄乌', '乌克兰', '停火', '胜利日'] 
  },
  { 
    name: '港股/中概股', 
    keywords: ['港股', '恒生', '科网股', '小米', '阿里巴巴', '百度', '中芯国际'] 
  },
];

// ==================== 主入口 ====================
async function main() {
  console.log(`\n[${formatTime()}] 🚀 金十快讯监控启动 [原油核心+盘面验证模式]`);

  const items = await fetchJin10();
  if (items.length === 0) {
    console.log('❌ 未获取到数据');
    process.exit(0);
  }

  const newItems = getNewItems(items);
  if (newItems.length === 0) {
    console.log('⏭️ 无新增快讯');
    process.exit(0);
  }
  console.log(`📥 新增 ${newItems.length} 条`);

  const filtered = preFilter(newItems);
  console.log(`🔍 硬过滤后: ${filtered.length} 条`);

  const clustered = deduplicateByEvent(filtered);
  console.log(`📦 聚合为 ${clustered.length} 个事件簇`);
  clustered.forEach(c => {
    const urgentTag = hasUrgentTime(c.content) ? '⏰' : '';
    console.log(`   ${c._clusterHot === '爆' ? '🔴' : '🔵'} ${urgentTag} ${c._cluster} (${c._clusterSize}条)`);
  });

  let marketData = null;
  let oilPrice = null;
  try {
    marketData = await getMarketData();
    console.log(`📊 数据层状态: A股${marketData.isAOpen ? '开市' : '休市'} | 获取到${marketData.holdings.length} 个ETF行情`);
    oilPrice = marketData.oil;
  } catch (e) {
    console.log('⚠️ data-layer获取失败:', e.message);
  }

  if (oilPrice) {
    console.log(`📊 布伦特原油: $${oilPrice.price} (${oilPrice.change > 0 ? '+' : ''}${oilPrice.change}%)`);
  }
  const holdingsData = marketData?.holdings || [];

  const state = loadState();
  const toAnalyze = [];
  const toUpdate = [];

  for (const cluster of clustered) {
    const existing = state.pushedClusters?.find(p => p.cluster === cluster._cluster);

    if (!existing) {
      toAnalyze.push(cluster);
      console.log(`   🆕 新事件: ${cluster._cluster}`);
    } else if (cluster.hot === '爆' && existing.pushCount === 0) {
      console.log(`   🔥 ${cluster._cluster} 升级为"爆"，补推`);
      toAnalyze.push(cluster);
    } else if (isMajorUpdate(cluster, existing)) {
      console.log(`   ⏰ ${cluster._cluster} 重大更新，重新推送`);
      toAnalyze.push(cluster);
    } else {
      toUpdate.push({ cluster: cluster._cluster, lastId: cluster.id });
    }
  }

  if (toAnalyze.length > 0) {
    console.log(`🧠 送审 LLM: ${toAnalyze.length} 个事件簇`);
    const analysis = await analyzeWithLLM(toAnalyze, oilPrice, holdingsData);
    await pushWechat(analysis, toAnalyze, oilPrice, holdingsData);
    
    for (const cluster of toAnalyze) {
      const existingIdx = state.pushedClusters?.findIndex(p => p.cluster === cluster._cluster);
      if (existingIdx >= 0) {
        state.pushedClusters[existingIdx].pushCount++;
        state.pushedClusters[existingIdx].lastUpdateId = cluster.id;
        state.pushedClusters[existingIdx].lastUpdateTime = new Date().toISOString();
        if (hasUrgentTime(cluster.content)) state.pushedClusters[existingIdx].hadUrgent = true;
        if (cluster.content.includes('军事行动')) state.pushedClusters[existingIdx].hasMilitary = true;
        if (cluster.content.includes('15000名') || cluster.content.includes('导弹驱逐舰')) state.pushedClusters[existingIdx].hasDeployment = true;
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
          hadUrgent: hasUrgentTime(cluster.content),
          hasMilitary: cluster.content.includes('军事行动'),
          hasDeployment: cluster.content.includes('15000名') || cluster.content.includes('导弹驱逐舰'),
        });
      }
    }
  } else {
    console.log('📭 无新事件需分析，静默');
  }

  for (const update of toUpdate) {
    const existing = state.pushedClusters?.find(p => p.cluster === update.cluster);
    if (existing) {
      existing.lastUpdateId = update.lastId;
      existing.lastUpdateTime = new Date().toISOString();
    }
  }

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

  const sorted = [...items].sort((a, b) => (a.id > b.id ? -1 : 1));

  let newItems;
  if (!lastId) {
    newItems = sorted.slice(0, 5);
    console.log('🆕 首次运行，取最近5条');
  } else {
    newItems = sorted.filter(i => i.id > lastId);
  }

  if (sorted.length > 0) {
    state.lastId = sorted[0].id;
    saveState(state);
  }

  return newItems.reverse();
}

// ==================== 硬过滤（修复版） ====================
function preFilter(items) {
  return items.filter(item => {
    const content = item.content || '';

    if (EXCLUDE_PATTERNS.some(p => p.test(content))) {
      console.log(`   🚫 排除(模式): ${content.slice(0, 40)}...`);
      return false;
    }

    if (LOW_VALUE_KEYWORDS.some(kw => content.includes(kw))) {
      console.log(`   🚫 排除(低价值): ${content.slice(0, 40)}...`);
      return false;
    }

    // 【修复】区分个股财报和板块行情
    const isStockReport = /一季度净利润|第一季度净利润|Q1净利润|一季度营收|第一季度营收/.test(content);
    const isSector = isSectorMove(content);
    const hasMacro = A_STOCK_KEYWORDS.some(kw => content.includes(kw));
    
    if (isStockReport && !isSector && !hasMacro) {
      console.log(`   🚫 排除(纯个股财报): ${content.slice(0, 40)}...`);
      return false;
    }

    return true;
  });
}

function isSectorMove(content) {
  const sectorPatterns = [
    /集体走高|集体上扬|集体大涨|集体飙升/,
    /涨幅扩大至\d+%/,
    /涨超.*涨超/,  // 至少2个涨超
    /科网股|芯片股|半导体股|地产股|汽车股/,
    /港股.*涨|恒生.*涨/,
  ];
  return sectorPatterns.some(p => p.test(content));
}

function hasUrgentTime(content) {
  return URGENT_TIME_KEYWORDS.some(kw => {
    if (kw.includes('.*')) return new RegExp(kw).test(content);
    return content.includes(kw);
  });
}

// ==================== 事件聚合 ====================
function deduplicateByEvent(items) {
  const clusters = [];
  const usedIds = new Set();

  for (const item of items) {
    if (usedIds.has(item.id)) continue;

    const content = item.content || '';
    let matched = false;

    for (const clusterDef of EVENT_CLUSTERS) {
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
          if ((item.source_link || '').length > (existing.representative.source_link || '').length) {
            existing.representative = item;
          }
        }

        usedIds.add(item.id);
        matched = true;
        break;
      }
    }

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

  return clusters.map(c => ({
    ...c.representative,
    _cluster: c.clusterName,
    _clusterSize: c.allItems.length,
    _clusterHot: c.hotMax === 2 ? '爆' : '沸',
    _clusterTime: c.earliestTime,
  }));
}

// ==================== 重大更新判断（新增） ====================
function isMajorUpdate(cluster, existing) {
  const content = cluster.content || '';
  
  // 1. 时间敏感词
  if (hasUrgentTime(content)) return true;
  
  // 2. 军事行动升级
  if (content.includes('军事行动') && !existing.hasMilitary) return true;
  if (content.includes('打击方案') && !existing.hasStrike) return true;
  if (content.includes('行动开始') && !existing.hasAction) return true;
  
  // 3. 美军具体部署
  if ((content.includes('15000名') || content.includes('导弹驱逐舰') || content.includes('航母') || content.includes('军机')) && !existing.hasDeployment) return true;
  
  // 4. 谈判破裂/逆转
  if (content.includes('不可接受') && !existing.wasRejected) return true;
  if (content.includes('违反停火') && !existing.wasBroken) return true;
  
  // 5. 领导人最新表态（与之前方向相反）
  if (content.includes('重启空袭') || content.includes('恢复打击')) return true;
  
  return false;
}

// ==================== LLM 分析 ====================
async function analyzeWithLLM(clusteredItems, oilPrice, holdingsData) {
  const holdingsStatusText = formatHoldingsForLLM(holdingsData);
  console.log('holdingsStatusText:', holdingsStatusText);
  const flashText = clusteredItems.map(i => {
    const sizeTag = i._clusterSize > 1 ? ` [本簇共${i._clusterSize}条]` : '';
    const oilTag = i._cluster === '原油能源' || i._cluster === '伊朗局势' || i._cluster === '中东战争' ? ' [原油核心]' : '';
    const urgentTag = hasUrgentTime(i.content) ? ' [时间敏感]' : '';
    return `[${i._clusterHot}]${sizeTag}${oilTag}${urgentTag} ${i._cluster}\n时间: ${i.time}\n来源: ${i.source || '金十'}\n${i.content.slice(0, 350)}...`;
  }).join('\n\n---\n\n');
  console.log('oilPrice:', oilPrice);
  const prompt = `你是一位宏观交易信号过滤专家。当前市场以原油价格为绝对核心锚定，所有分析必须围绕原油传导链展开，并结合实盘表现进行交叉验证。

【当前原油状态】
布伦特原油: $${oilPrice?.price || '未知'} (${oilPrice?.change > 0 ? '+' : ''}${oilPrice?.change || 0}%)

【用户持仓】
${HOLDINGSTEXT}

 【⚠️ 当前ETF实盘状态（按涨跌幅排序）】
 ${holdingsStatusText}

 【核心判断标准】
 1. 盘面交叉验证（最重要）：
 - 新闻逻辑与盘面表现是否一致？
 - 如果新闻是重大利好，但对应ETF没涨甚至跌了，说明什么？（可能是利好出尽、资金博弈、或逻辑有误）
 - 如果新闻看似平淡，但某个ETF突然异动拉升，说明什么？（可能有未公开资金抢筹）
 2. 原油传导链：同前
 3. 时间敏感度：同前
 4. 精准标的匹配：同前（必须在用户持仓中的ETF中选）

【输入事件簇】
${flashText}

 【输出要求】
 - 原油相关事件自动 +2 分
 - 时间敏感事件（几小时内发生）自动 +2 分
 - 【新增】盘面已提前反应（新闻落地前已涨/跌超1%）的事件 -1 分（防追高/防杀跌）
 - 【新增】盘面未反应但逻辑极强的突发消息 +1 分（埋伏机会）
 - 只输出 value_score >= 7 的事件，每天最多 3 个

 【输出格式】（严格JSON，新增盘面验证字段）
 {
   "market_mood": "string",
   "noise_level": "integer",
   "oil_outlook": "string",
   "top_events": [
     {
       "cluster_name": "string",
       "value_score": "integer",
       "oil_impact": "string",
       "transmission_chain": "string",
       "action": "string, 加仓/减仓/调仓/观望/埋伏",
       "target": "string, 必须是用户持仓中的ETF之一的全称",
       "urgency": "string",
       "time_sensitive": "boolean",
       "holding_match": "string",
       "why": "string, 核心价值逻辑",
       "market_validation": "string, 盘面验证情况：如'盘面已提前反应，追高风险大'或'盘面尚未反应，存在预期差'",
       "contrarian": "string",
       "risk": "string"
     }
   ],
   "daily_strategy": {
     "overall_position": "string",
     "core_logic": "string, 必须包含对当前盘面异动特征的评价",
     "oil_trade": "string",
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
          { role: "system", content: "你是冷酷的原油宏观交易员。当前一切以油价为核心。对无价值信息要毫不留情。必须输出合法JSON。" },
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
    console.log(`   情绪: ${parsed.market_mood} | 噪音: ${parsed.noise_level}% | 原油: ${parsed.oil_outlook || '无'}`);
    const events = parsed.top_events || [];
    events.forEach(e => {
      const oilTag = e.oil_impact ? '[原油]' : '';
      const timeTag = e.time_sensitive ? '[紧急]' : '';
      console.log(`   🚨 ${oilTag}${timeTag}[${e.urgency}] ${e.action} ${e.target} (价值${e.value_score}, 匹配${e.holding_match})`);
    });

    return parsed;

  } catch (error) {
    console.error('❌ LLM 失败:', error.message?.slice(0, 200));
    return { market_mood: '未知', noise_level: 0, oil_outlook: '', top_events: [], daily_strategy: {} };
  }
}

// ==================== 盘面格式化 ====================
function formatHoldingsForLLM(holdings) {
  if (!holdings || holdings.length === 0) {
    return '当前为非交易时段，无ETF实时盘面数据。请纯粹基于事件逻辑进行分析。';
  }
  // 按涨跌幅排序，让LLM一眼看到最强和最弱的
  const sorted = [...holdings].sort((a, b) => b.change - a.change);
  return sorted.map(h => {
    const arrow = h.change > 0 ? '🔺' : (h.change < 0 ? '🔻' : '➖');
    return `${arrow} ${h.name}: 现价${h.price} (${h.change > 0 ? '+' : ''}${h.changeStr}%)`;
  }).join('\n');
}


// ==================== 企微推送 ====================
async function pushWechat(analysis, rawItems, oilPrice, holdingsData) {
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
  const oilEmoji = oilPrice?.change > 0 ? '📈' : (oilPrice?.change < 0 ? '📉' : '➖');

  const topGainer = holdingsData.sort((a,b) => b.change - a.change)[0];
  const topLoser = holdingsData.sort((a,b) => a.change - b.change)[0];

  let markdown = `## ${oilEmoji} 金十快讯 [原油核心+盘面验证] <font color="warning">${analysis.market_mood}</font> 
  > 时间：${now} | 布伦特: **$${oilPrice?.price || '?'}** (${oilPrice?.change > 0 ? '+' : ''}${oilPrice?.change || 0}%)
  > 仓位建议：**${analysis.daily_strategy?.overall_position || '观望'}**
  > 原油展望：${analysis.oil_outlook || '无'}
  > 盘面特征：${topGainer ? `领涨<font color="info">${topGainer.name}(+${topGainer.changeStr}%)</font> | 领跌<font color="red">${topLoser.name}(${topLoser.changeStr}%)</font>` : '休市中'}
  --- 
  `;

  for (const event of events.slice(0, 3)) {
    const raw = rawItems.find(i => i._cluster === event.cluster_name);
    const isOilCore = event.oil_impact && event.oil_impact !== '无';
    const isUrgent = event.time_sensitive;
    const scoreColor = event.value_score >= 8 ? 'red' : (event.value_score >= 6 ? 'warning' : 'info');
    const oilTag = isOilCore ? '<font color="red">[原油]</font>' : '';
    const urgentTag = isUrgent ? '<font color="red">[紧急]</font>' : '';

    markdown += `### ${oilTag}${urgentTag} <font color="${scoreColor}">【${event.urgency}】${event.action} ${event.target} (${event.value_score}分)</font>
**事件：** ${event.cluster_name}
**持仓匹配：** ${event.holding_match || '无'}
**逻辑：** ${event.why}

**原油影响：** ${event.oil_impact || '无'}
**传导链：** ${event.transmission_chain || '无'}

**逆向机会：** ${event.contrarian || '无'}
**误读风险：** ${event.risk || '无'}

${raw ? `> 原文：${raw.content.slice(0, 100)}...` : ''}

---
`;
  }

  if (analysis.daily_strategy?.oil_trade) {
    markdown += `\n### 🛢️ 原油操作\n${analysis.daily_strategy.oil_trade}\n`;
  }

  if (analysis.daily_strategy?.key_risks?.length > 0) {
    markdown += `\n### ⚠️ 警惕\n${analysis.daily_strategy.key_risks.map(r => `- ${r}`).join('\n')}\n`;
  }

  if (analysis.daily_strategy?.watchlist?.length > 0) {
    markdown += `\n### 👀 观察\n${analysis.daily_strategy.watchlist.join('、')}\n`;
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
  fs.mkdirSync(DATA_DIR, { recursive: true });
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
  const existingIds = new Set(history.items.map(i => i.id));
  const uniqueNew = newItems.filter(i => !existingIds.has(i.id));

  history.items = [...uniqueNew, ...history.items].slice(0, 300);
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

  history.analyses = history.analyses.slice(0, 50);
  fs.writeFileSync(ANALYSIS_PATH, JSON.stringify(history, null, 2));
}

// ==================== 工具 ====================
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