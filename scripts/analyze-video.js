/**
 * 完整自动化视频分析脚本
 * 
 * 功能：
 * 1. 自动检测李大霄最新视频（通过 Bilibili API）
 * 2. 使用 yt-dlp 下载音频
 * 3. 调用 OpenAI Whisper 转文字
 * 4. 调用 LLM 生成分析 JSON
 * 5. 自动更新 public/data/videos.json
 * 
 * 使用方式：
 *   方式A - 分析指定视频:  node scripts/analyze-video.js <B站链接>
 *   方式B - 检测新视频:    node scripts/analyze-video.js --check-new
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import 'dotenv/config';
import { chat, chatJSON, printLLMConfig, checkLLMHealth } from './utils/llm.js';
import { truncateByBytes } from './utils/text.js';

// ==================== 配置区域 ====================
const BILI_UID = process.env.BILI_UID || '2137589551'; // 李大霄UID（主UP主，走 JSON 归档流程）
const DATA_PATH = path.resolve('public/data/videos.json');

// 额外解读的UP主：只做文字解读 + 企微推送，不写入 videos.json
// 格式：EXTRA_UPS="1039025435,584685158"（可用 Secret 覆盖）
const EXTRA_UPS = (process.env.EXTRA_UPS || '1039025435,584685158,520819684,290548469')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// 额外UP主的显示名（企微推送用），未配置则显示 UID
const EXTRA_UP_NAMES = {
  '1039025435': '战国时代_姜汁汽水',  // 地缘 + 财经，长视频
  '584685158': '正解局',             // 产业 / 城市 / 宏观，高频
  '520819684': '小Lin说',            // 国际宏观，深度，更新慢
  '290548469': '冲浪普拉斯',          // 公司财报 / 商业模式
  '485083371': '烈火眼镜',           // 盘面趋势（基金从业资质），备用
  '20763555': '银行螺丝钉',           // 指数估值 / 定投，备用
  '508709785': '温义飞今天插旗了吗',   // 财经评论，备用
  '322005137': '史诗级韭菜'           // 经济分析 / 投资框架，备用
};

// 额外UP主视频时长上限（秒）。地缘/财经类视频通常较长，默认 120 分钟
const EXTRA_UP_MAX_DURATION = Number(process.env.EXTRA_UP_MAX_DURATION || 7200);
// 额外UP主每次运行最多处理的视频数。定时器每30分钟触发一次，每次处理1个足够，避免单次任务过久
const EXTRA_UP_MAX_PER_RUN = Number(process.env.EXTRA_UP_MAX_PER_RUN || 1);
// 单条转录文本送 LLM 的上限（字符），超长视频防止请求过大/过慢
const TRANSCRIPT_MAX_CHARS = Number(process.env.TRANSCRIPT_MAX_CHARS || 80000);

// faster-whisper 模型大小：base 最省时间，长视频可换 small / medium 提升准确率
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'base';

const TARGETS = [
  {
    uid: BILI_UID,
    name: process.env.BILI_MAIN_NAME || '李大霄',
    mode: 'json',           // 生成结构化 JSON 并写入 public/data/videos.json
    maxDuration: Number(process.env.BILI_MAX_DURATION || 900),
    maxPerRun: 5,
    statePath: null         // 去重依赖 videos.json 中的 bvid
  },
  ...EXTRA_UPS.map(uid => ({
    uid,
    name: process.env[`BILI_UP_NAME_${uid}`] || EXTRA_UP_NAMES[uid] || `UP_${uid}`,
    mode: 'text',           // 只生成文字解读，推送企微
    maxDuration: EXTRA_UP_MAX_DURATION,
    maxPerRun: EXTRA_UP_MAX_PER_RUN,
    statePath: path.resolve('public/data', `up_${uid}_state.json`),
    // 可选：额外UP主单独推送到另一个企微群（不配则用主 WECHAT_WEBHOOK）
    webhook: process.env.EXTRA_WECHAT_WEBHOOK || ''
  }))
];

// Cookie配置：GitHub Actions无浏览器，需通过BILI_COOKIE环境变量传入
const BILI_COOKIE = process.env.BILI_COOKIE || ''; // 直接Cookie字符串
const BROWSER = process.env.BILI_BROWSER || 'edge';

// 企微配置
const WECHAT_WEBHOOK = process.env.WECHAT_WEBHOOK || '';

// yt-dlp Cookie参数：有BILI_COOKIE时写入文件，否则从浏览器提取
let YT_DLP_COOKIE_ARGS;
const cookieFilePath = path.resolve('temp', 'bili_cookies_ytdlp.txt');
if (BILI_COOKIE) {
  // GitHub Actions模式：将Cookie字符串转为Netscape格式文件
  const tempDir = path.resolve('temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  const netscapeLines = BILI_COOKIE.split('; ').map(c => {
    const [name, ...vals] = c.split('=');
    return `.bilibili.com	TRUE	/	TRUE	0	${name}	${vals.join('=')}`;
  });
  fs.writeFileSync(cookieFilePath, '# Netscape HTTP Cookie File\n' + netscapeLines.join('\n'));
  YT_DLP_COOKIE_ARGS = `--cookies "${cookieFilePath}"`;
} else {
  YT_DLP_COOKIE_ARGS = `--cookies-from-browser ${BROWSER}`;
}

const YT_DLP_ARGS = YT_DLP_COOKIE_ARGS;

// ==================== 主入口 ====================
const mode = process.argv[2];

async function main() {
  try {
    if (mode === '--check-new') {
      // LLM 连通性自检，避免白白跑完下载+语音转录才发现请求打不通
      console.log('正在进行 LLM 连通性自检...');
      await checkLLMHealth();

      for (const target of TARGETS) {
        console.log(`\n========== [${target.name}] UID ${target.uid} (${target.mode === 'json' ? 'JSON归档' : '文字解读'}) ==========`);
        try {
          await checkAndProcessNewVideos(target);
        } catch (error) {
          console.error(`[${target.name}] 处理失败:`, error.message);
        }
        await sleep(3000);
      }
    } else if (mode === '--text-from-file') {
      // 本地调试：跳过下载/转录，直接用现成文本测试文字解读
      // 用法: node scripts/analyze-video.js --text-from-file temp/xxx.txt [--push BV号]
      const file = process.argv[3];
      if (!file || !fs.existsSync(file)) {
        console.log('用法: node scripts/analyze-video.js --text-from-file <转录文本.txt> [--push <BV号>]');
        process.exit(1);
      }
      const target = TARGETS[1] || { ...TARGETS[0], mode: 'text' };
      const text = fs.readFileSync(file, 'utf-8');
      const result = await interpretTranscriptAsText(text, path.basename(file), '', target);
      if (result) {
        console.log('\n--- 解读结果 ---\n' + result);
        const pushIdx = process.argv.indexOf('--push');
        if (pushIdx !== -1) {
          await pushWechatPlain(path.basename(file), process.argv[pushIdx + 1] || '', result, target);
        }
      }
    } else if (mode === '--list-targets') {
      // 查看当前会跑哪些 UP 主：node scripts/analyze-video.js --list-targets
      TARGETS.forEach(t => {
        console.log(`${t.name.padEnd(20, ' ')} uid=${t.uid}  模式=${t.mode === 'json' ? 'JSON归档' : '文字解读'}  时长上限=${Math.round(t.maxDuration / 60)}分钟  每次最多=${t.maxPerRun}个`);
      });
    } else if (mode?.includes('bilibili.com')) {
      // 加 --text 可手动测试文字解读模式：node scripts/analyze-video.js <链接> --text
      const asText = process.argv[3] === '--text';
      const target = asText ? { ...(TARGETS[1] || TARGETS[0]), mode: 'text' } : TARGETS[0];
      await processSingleVideo(mode, null, null, null, target);
    } else {
      console.log('用法:');
      console.log('  node scripts/analyze-video.js <B站视频链接>');
      console.log('  node scripts/analyze-video.js --check-new');
      process.exit(1);
    }
  } catch (error) {
    console.error('流程失败:', error.message);
    process.exit(1);
  }
}

// ==================== 自动检测新视频 ====================
async function checkAndProcessNewVideos(target) {
  console.log('正在检测新视频（通过 yt-dlp）...');

  // 用 yt-dlp 获取UP主视频列表
  // flat-playlist 模式下B站不返回标题，只取ID，标题在下载时获取
  const spaceUrl = `https://space.bilibili.com/${target.uid}/video`;
  let output;
  try {
    output = execSync(
      `yt-dlp ${YT_DLP_ARGS} --flat-playlist --print "%(id)s" --playlist-end 5 "${spaceUrl}"`,
      { encoding: 'utf-8', timeout: 60000 }
    ).trim();
  } catch (error) {
    console.error('获取视频列表失败，请确认 yt-dlp 已安装且网络正常');
    console.error('提示: yt-dlp 可能需要更新: pip install -U yt-dlp');
    console.error('提示: 如果Cookie读取失败，尝试在 .env 中设置 BILI_BROWSER=chrome');
    return;
  }

  if (!output) {
    console.log('未获取到视频列表');
    return;
  }

  // 解析输出: 每行一个BV号，并用B站API获取标题和时长
  const videos = [];
  for (const bvid of output.split('\n').filter(Boolean)) {
    let title = null;
    let duration = null;
    let formattedDate = null;
    try {
      const cookieStr = extractBrowserCookies();
      const videoRes = await axios.get(
        `https://api.bilibili.com/x/web-interface/view?bvid=${bvid.trim()}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.bilibili.com',
            'Cookie': cookieStr
          },
          timeout: 10000
        }
      );
      title = videoRes.data?.data?.title;
      duration = videoRes.data?.data?.duration; // 时长（秒）
      const pubdate = videoRes.data?.data?.pubdate || videoRes.data?.data?.ctime; // 获取时间戳（UTC）
      // 将时间戳转换为 YYYY-MM-DD HH:MM 格式（北京时间 UTC+8）
      if (pubdate) {
        // B站时间戳是UTC，需要加上8小时转换为北京时间
        const dateObj = new Date((pubdate + 8 * 3600) * 1000);
        const year = dateObj.getUTCFullYear();
        const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getUTCDate()).padStart(2, '0');
        const hours = String(dateObj.getUTCHours()).padStart(2, '0');
        const minutes = String(dateObj.getUTCMinutes()).padStart(2, '0');
        formattedDate = `${year}-${month}-${day} ${hours}:${minutes}`;
      }
    } catch {
      // 标题或日期获取失败，保持null
    }
    // 过滤超长视频
    if (duration && duration > target.maxDuration) {
      console.log(`跳过超长视频: ${bvid.trim()} - ${title || '无标题'} (${Math.floor(duration / 60)}分${duration % 60}秒，上限${Math.floor(target.maxDuration / 60)}分钟)`);
      continue;
    }
    videos.push({ bvid: bvid.trim(), title, duration, date: formattedDate });
  }

  console.log(`获取到 ${videos.length} 个视频`);

  // 读取已处理的视频BV号
  const processedBVs = readProcessedBVs(target);

  let processedCount = 0;
  for (const video of videos) {
    if (processedBVs.includes(video.bvid)) {
      console.log(`跳过已处理: ${video.bvid}`);
      continue;
    }

    if (processedCount >= target.maxPerRun) {
      console.log(`⚠️ 本次运行已达处理上限(${target.maxPerRun}个)，剩余视频留待下次: ${video.bvid}`);
      break;
    }

    const videoUrl = `https://www.bilibili.com/video/${video.bvid}`;
    console.log(`\n发现新视频: ${video.bvid} - ${video.title || '无标题'}`);
    await processSingleVideo(videoUrl, video.title, video.bvid, video.date, target, video.duration);
    processedCount++;

    // 避免请求过快
    await sleep(3000);
  }

  console.log(`\n[${target.name}] 处理完成，新增 ${processedCount} 个视频`);
}

// 已处理的BV号：json模式读 videos.json，文字模式读独立状态文件
function readProcessedBVs(target) {
  if (target.mode === 'json') {
    try {
      const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
      return data.map(v => v.bvid || '').filter(Boolean);
    } catch {
      return [];
    }
  }

  return readProcessedState(target.statePath).processed.map(v => v.bvid).filter(Boolean);
}

// 记录已处理（仅文字模式需要，避免重复推送）
function markProcessed(target, video) {
  if (target.mode === 'json') return;
  const state = readProcessedState(target.statePath);
  state.processed = state.processed.filter(v => v.bvid !== video.bvid);
  state.processed.unshift({ ...video, pushedAt: new Date().toISOString() });
  state.updatedAt = new Date().toISOString();
  // 只保留最近100条
  state.processed = state.processed.slice(0, 100);
  fs.mkdirSync(path.dirname(target.statePath), { recursive: true });
  fs.writeFileSync(target.statePath, JSON.stringify(state, null, 2), 'utf-8');
}

function readProcessedState(statePath) {
  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    if (Array.isArray(state)) return { processed: state.map(v => (typeof v === 'string' ? { bvid: v } : v)) };
    return { processed: state.processed || [] };
  } catch {
    return { processed: [] };
  }
}

// ==================== 处理单个视频 ====================
async function processSingleVideo(videoUrl, knownTitle = null, bvid = null, knownDate = null, target = TARGETS[0], durationSec = 0) {
  try {
    // 1. 获取标题
    let videoTitle = knownTitle;
    if (!videoTitle) {
      try {
        videoTitle = execSync(
          `yt-dlp ${YT_DLP_ARGS} --print "%(title)s" "${videoUrl}"`,
          { encoding: 'utf-8', timeout: 30000 }
        ).trim();
      } catch {
        videoTitle = null;
      }
    }

    // 2. 获取字幕（优先B站AI字幕，失败则使用语音转录）
    console.log('正在获取字幕...');
    let transcript = await downloadBilibiliSubtitle(videoUrl);
    
    if (!transcript) {
      console.log('B站AI字幕不可用，改用 faster-whisper 语音转录...');
      transcript = await downloadAudioAndTranscribe(videoUrl, durationSec);
    }

    if (!transcript) {
      console.error('字幕获取失败，跳过此视频');
      return;
    }

    // 3. AI 分析
    if (target.mode === 'json') {
      console.log('正在AI分析...');
      const analysisJson = await analyzeTranscript(transcript, videoTitle, bvid, knownDate);

      // 4. 写入数据
      const data = fs.existsSync(DATA_PATH)
        ? JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'))
        : [];
      if (analysisJson) {
        data.unshift(analysisJson);
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
        console.log('✅ 成功添加:', analysisJson.title || videoTitle || '未命名');
        // 企微通知
        await pushWechat(analysisJson.title || videoTitle || '未命名', bvid, analysisJson.structured?.operation_advice || '无操作建议');
      } else {
        console.error('处理失败');
      }
    } else {
      // 文字解读模式：不生成 JSON，只推送企微
      console.log('正在AI解读（文字模式）...');
      const plainText = await interpretTranscriptAsText(transcript, videoTitle, bvid, target);

      if (!plainText) {
        console.error('解读失败，跳过推送');
        return;
      }

      const pushed = await pushWechatPlain(videoTitle, bvid, plainText, target);
      if (pushed) {
        markProcessed(target, { bvid, title: videoTitle, date: knownDate });
        console.log('✅ 解读已推送并记录');
      } else {
        console.error('⚠️ 推送失败，本次不记录，下次运行会重试');
      }
    }

  } catch (error) {
    console.error('处理失败:', error.message);
  }
}

// ==================== B站AI字幕获取 ====================
// 流程：B站video API获取cid → 调player wbi v2接口 → 获取subtitle_url → 下载字幕JSON
async function downloadBilibiliSubtitle(videoUrl) {
  try {
    const bvid = videoUrl.match(/BV\w+/)?.[0];
    if (!bvid) {
      console.log('无法提取BV号，将使用语音转录');
      return null;
    }

    // 1. 用B站video API获取cid
    console.log('正在获取视频信息...');
    const cookieStr = extractBrowserCookies();
    const videoRes = await axios.get(
      `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.bilibili.com',
          'Cookie': cookieStr
        },
        timeout: 15000
      }
    );

    if (videoRes.data?.code !== 0) {
      console.log('获取视频信息失败:', videoRes.data?.message);
      return null;
    }

    const cid = videoRes.data?.data?.cid || videoRes.data?.data?.pages?.[0]?.cid;
    if (!cid) {
      console.log('无法获取cid，将使用语音转录');
      return null;
    }

    // 2. 调用B站Player WBI v2接口获取字幕列表
    console.log('正在获取字幕列表...');
    const playerUrl = `https://api.bilibili.com/x/player/wbi/v2?cid=${cid}&bvid=${bvid}`;
    const playerRes = await axios.get(playerUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.bilibili.com',
        'Cookie': cookieStr
      },
      timeout: 15000
    });

    const subtitleData = playerRes.data?.data?.subtitle;
    const subtitles = subtitleData?.subtitles || [];

    if (subtitles.length === 0) {
      console.log('B站无AI字幕，将使用语音转录');
      return null;
    }

    // 优先取AI中文字幕 (ai-zh)，其次任意中文字幕
    const zhSub = subtitles.find(s => s.lan === 'ai-zh') || subtitles.find(s => s.lan?.includes('zh')) || subtitles[0];
    let subUrl = zhSub.subtitle_url || zhSub.subtitle_url_v2;

    if (!subUrl) {
      console.log('B站字幕URL为空，将使用语音转录');
      return null;
    }

    // 补全URL（B站返回的URL可能以 // 开头）
    if (subUrl.startsWith('//')) subUrl = 'https:' + subUrl;

    // 3. 下载字幕JSON
    console.log('正在下载字幕内容...');
    const subRes = await axios.get(subUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.bilibili.com'
      },
      timeout: 15000
    });

    // 4. 解析字幕: { body: [{ content: "文字", from: 0.04, to: 0.62 }, ...] }
    const body = subRes.data?.body;
    if (!body || body.length === 0) {
      console.log('B站字幕内容为空，将使用语音转录');
      return null;
    }

    const text = body
      .map(item => (item.content || '').replace(/<[^>]+>/g, '').trim())
      .filter(Boolean)
      .join('，');
    if (text.length < 20) {
      console.log('B站字幕内容过少，将使用语音转录');
      return null;
    }

    console.log(`✅ 使用B站AI字幕（${text.length}字）`);
    return text;
  } catch (error) {
    console.log('B站字幕获取失败:', error.message?.slice(0, 100));
    return null;
  }
}

// 获取B站Cookie字符串（用于axios请求B站API）
function extractBrowserCookies() {
  // 优先使用环境变量直接传入的Cookie
  if (BILI_COOKIE) return BILI_COOKIE;

  // 本地模式：从浏览器导出Cookie
  const tempDir = path.resolve('temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
  const cookieFile = path.join(tempDir, 'bili_cookies.txt');

  try {
    execSync(`yt-dlp ${YT_DLP_COOKIE_ARGS} --cookies "${cookieFile}" --skip-download "https://www.bilibili.com"`,
      { encoding: 'utf-8', timeout: 15000, stdio: 'pipe' });
  } catch {
    // 忽略错误，Cookie文件可能已部分生成
  }

  try {
    if (!fs.existsSync(cookieFile)) return '';

    const cookieContent = fs.readFileSync(cookieFile, 'utf-8');
    const cookies = cookieContent
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#') && line.includes('bilibili'))
      .map(line => {
        const parts = line.split('\t');
        if (parts.length >= 7) {
          const name = parts[5].trim();
          const value = parts[6].trim();
          return `${name}=${value}`;
        }
        return '';
      })
      .filter(Boolean)
      .join('; ');

    fs.unlinkSync(cookieFile);
    return cookies;
  } catch {
    return '';
  }
}

// ==================== AI 分析 ====================
async function analyzeTranscript(text, knownTitle = null, bvid = null, knownDate = null) {
  // 使用传入的日期，如果没有则使用当前时间：YYYY-MM-DD HH:MM
  const date = knownDate || (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  })();

  console.log('测试AI分析...');
  printLLMConfig();

  const prompt = `你的角色定位是文字内容精确解析员，前提摘要：我发给你的文字内容是李大霄的视频内容，需要你根据文字内容解析出他深层表达的意思，请注意，李大霄在抖音有百万粉丝，他不能明面唱空，不能明面直接给出投资建议。你要挖掘他想表达的真正意思，请将以下视频转录文本分析并输出为指定格式的 JSON:

  输出格式：
  {
    "_id": \`lishaoxiao_${date.replace(/-/g, '')}\`,
    "id": \`${bvid}\`,
    "bvid": \`${bvid}\`,
    "title": \`${knownTitle}\`,
    "date": \`${date}\`,
    "sentiment_score": "integer, 情绪评分，0-100，50为中性，越高越乐观",
    "disclaimer_level": "integer, 免责/防火墙等级，1-5，越高越强调'仅供参考/外围市场'",
    "summary": "string, 200字以内的核心摘要，包含关键数据、观点、策略",
    "tags": ["string数组", "8个以内关键词标签"],
    
    "structured": {
      "core_views": ["string数组", "逐条列出原文中的核心观点/数据，每条带具体数字"],
      "sectors": ["string数组", "涉及的行业板块，如证券、银行、石油石化等"],
      "operation_advice": "string, 操作策略建议，提炼弦外之音，明确多空态度",
      "risk_tips": ["string数组", "风险警示要点，每条独立成句"]
    },
    
    "deep_analysis": {
      "strategy": "string, 分析其论证策略：用了什么修辞/类比/心理战术来传达观点",
      
      "hidden_meanings": [
        {
          "surface": "string, 原文表面表述（引用原话或高度还原）",
          "deep": "string, 深层含义解读：他真正想说什么？暗示什么？建立什么形象？",
          "quote": "string, 原文中最能代表该隐含意思的一句话"
        }
      ],
      
      "logic_pieces": [
        {
          "title": "string, 逻辑链条名称，如'负利率历史类比'、'估值分化论'",
          "content": "string, 该逻辑链的完整推理过程，用箭头→连接"
        }
      ],
      
      "data_analysis": {
        "points": ["string数组", "原文中提到的所有具体数据，带单位和涨跌幅"],
        "subtext": "string, 数据背后的潜台词：数据呈现什么特征？作者想借此说明什么？"
      },
      
      "signals": ["string数组", "从中提取的所有投资信号，格式：'信号名称：具体内容'"],
      
      "final_conclusion": "string, 综合结论，300字以内，涵盖观点、策略、风险提示"
    },
    
    "hit_status": "string, 固定值'pending'",
    
    "logic_factors": [
      {
        "factor_name": "string, 因子名称，如'全球高位'、'业绩分化'",
        "factor_value": "string, 因子具体数值或状态描述",
        "weight": "float, 权重0-1，越高影响越大",
        "direction": "string, 取值仅限：'看涨'/'看跌'/'中性偏多'/'中性偏空'/'中性'",
        "description": "string, 该因子对市场的具体影响逻辑"
      }
    ]
  }

  文本内容：
  ${text}`;

  try {
    const result = await chatJSON(
      "你是一个严格遵循指令的文本解析专家，必须输出完整、详细、不省略任何字段的JSON。",
      prompt,
      {
        temperature: 0.2,
        maxTokens: 32768,  // 思考模型的思考token也计入max_tokens，需留足余量
        timeout: 3000000
      }
    );

    console.log('\n✅ AI分析成功！');
    console.log(JSON.stringify(result, null, 2).slice(0, 1000));
    return result;
  } catch (error) {
    console.error('\n❌ AI分析失败:', error.message);
    return null;
  }
}

// ==================== 文字解读模式（不生成 JSON，直接推送）====================
/**
 * 对转录文本做“人话解读”，返回纯文本（不是JSON）
 */
async function interpretTranscriptAsText(text, knownTitle = null, bvid = null, target) {
  console.log(`正在解读「${target.name}」的视频（文字模式）...`);

  // 超长视频（如 2 小时以上）的转录文本可能过大，头尾截取保留最相关的部分
  let sourceText = text;
  if (sourceText.length > TRANSCRIPT_MAX_CHARS) {
    const headLen = Math.floor(TRANSCRIPT_MAX_CHARS * 0.6);
    const tailLen = TRANSCRIPT_MAX_CHARS - headLen;
    console.log(`⚠️ 转录文本过长(${text.length}字)，截取前${headLen}字+后${tailLen}字送分析`);
    sourceText = `${text.slice(0, headLen)}\n\n……（中间省略 ${text.length - TRANSCRIPT_MAX_CHARS} 字）……\n\n${text.slice(-tailLen)}`;
  }

  const prompt = `你是资深宏观 / 地缘财经内容分析师。下面是B站UP主「${target.name}」的视频《${knownTitle || '未知标题'}》的语音转录文本（口语化，可能存在同音字和错别字，请自行纠错后理解）。

请输出一份可以直接发到企业微信的中文解读。要求：
- 不要 JSON，不要 markdown 代码块，用纯文本 + 换行
- 严格按下面的小节输出，每节都要有内容，没有信息就写「未提及」
- 保留原文关键表述和具体数字，但要做成人话，不要照抄口语

【一句话结论】他这次到底在讲什么，倾向偏多还是偏空
【核心观点】3-5条，每条以「·」开头
【关键数据与信息】文中出现的具体数字 / 事件 / 时间点
【推演链条】他是怎么得出结论的：事实→推演→资产含义
【涉及资产】提到的市场、板块、品种，以及对应偏向
【值得警惕】他提到的风险，以及他可能回避或忽略的风险
【可信度提示】指出可能的错误数据、情绪化渲染或需要自行核实的部分

其他要求：总长控制在 700 字以内（企业微信推送上限较短，宁短勿长）；只基于转录文本，不要编造事实；保持中立，不要给出具体买卖建议。

转录文本：
${sourceText}`;

  try {
    const content = await chat(
      [
        { role: 'system', content: '你是客观、克制的宏观与地缘财经分析师，擅长把口语化内容提炼成结构化文字笔记，从不编造事实。' },
        { role: 'user', content: prompt }
      ],
      { temperature: 0.4, maxTokens: 4096, timeout: 600000 }
    );

    const result = content?.choices?.[0]?.message?.content?.trim();
    if (!result) {
      console.error('❌ 解读内容为空');
      return null;
    }
    console.log(`✅ 解读完成（${result.length} 字）`);
    console.log(result.slice(0, 300) + '...');
    return result;
  } catch (error) {
    console.error('\n❌ 解读失败:', error.message);
    return null;
  }
}

// ==================== 企微推送 ====================
// 企微 markdown 消息上限 4096 字节，留出余量
const WECHAT_MARKDOWN_LIMIT = 3800;

/** 发送 markdown 消息到企微机器人 */
async function sendWechatMarkdown(content, webhook = WECHAT_WEBHOOK) {
  if (!webhook) {
    console.log('⚠️ 未配置 WECHAT_WEBHOOK，跳过推送');
    return false;
  }
  try {
    await axios.post(
      webhook,
      { msgtype: 'markdown', markdown: { content: truncateByBytes(content, WECHAT_MARKDOWN_LIMIT) } },
      { timeout: 15000 }
    );
    console.log('📲 企微推送成功');
    return true;
  } catch (error) {
    console.error('❌ 企微推送失败:', error.response?.data || error.message);
    return false;
  }
}

/** 文字解读推送：标题 + 原视频链接 + 解读正文 */
async function pushWechatPlain(title, bvid, body, target) {
  const header = `**【${target.name}】${title || '新视频'}**\n[点击观看原视频](https://www.bilibili.com/video/${bvid})\n\n`;
  return sendWechatMarkdown(header + body, target.webhook || WECHAT_WEBHOOK);
}

/** 李大霄 JSON 模式推送：带站内分析页链接 */
async function pushWechat(title, bvid, operationAdvice) {
  const url = `https://xiaopage.1213962718.workers.dev/#/analysis/${bvid}`;
  return sendWechatMarkdown(`[${title}](${url})\n${operationAdvice}`);
}


// ==================== 音频下载 ====================
// B站风控（HTTP 412）会拦掉 yt-dlp 的取流请求，这里做两级下载：
// 1) yt-dlp 取最小音频流（体积小、速度快）
// 2) 失败时改用 B站官方 playurl 接口拿直链自己下载（实测该接口对同样的 Cookie 更宽松）

const BILI_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function biliHeaders(videoUrl) {
  return {
    'User-Agent': BILI_UA,
    'Referer': videoUrl || 'https://www.bilibili.com',
    'Cookie': extractBrowserCookies()
  };
}

/** 打印 execSync 失败的真实原因（stdout/stderr），否则日志里只剩一堆命令行参数 */
function logExecError(prefix, error) {
  const stderr = String(error?.stderr || '').trim();
  const stdout = String(error?.stdout || '').trim();
  if (error?.killed || error?.signal === 'SIGTERM') {
    console.error(`${prefix} 命令超时被终止`);
  }
  if (stderr) console.error(`${prefix} stderr:\n${stderr.slice(-1500)}`);
  else if (stdout) console.error(`${prefix} stdout:\n${stdout.slice(-800)}`);
  else console.error(`${prefix} ${error?.message?.slice(0, 300)}`);
}

/** 方式1：yt-dlp 下载最佳音频流，返回文件路径或 null */
function downloadAudioWithYtDlp(videoUrl, basePath, timeout) {
  const cmd = `yt-dlp ${YT_DLP_COOKIE_ARGS} -f "ba/b" --no-playlist --retries 5 --fragment-retries 5 --no-warnings -o "${basePath}.%(ext)s" "${videoUrl}"`;
  try {
    execSync(cmd, { encoding: 'utf-8', timeout, stdio: 'pipe' });
  } catch (error) {
    console.warn('⚠️ yt-dlp 下载音频失败');
    logExecError('yt-dlp', error);
    return null;
  }
  const files = fs.readdirSync(path.dirname(basePath));
  const hit = files.find(f => f.startsWith(path.basename(basePath)));
  return hit ? path.join(path.dirname(basePath), hit) : null;
}

/** 方式2：走 B站官方 playurl 接口拿直链，自己下载（yt-dlp 被 412 拦截时的兜底） */
async function downloadAudioViaBiliApi(videoUrl, basePath, timeout = 300000) {
  const bvid = videoUrl.match(/BV\w+/)?.[0];
  if (!bvid) return null;

  const headers = biliHeaders(videoUrl);
  try {
    const viewRes = await axios.get(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, { headers, timeout: 15000 });
    const cid = viewRes.data?.data?.cid || viewRes.data?.data?.pages?.[0]?.cid;
    if (!cid) {
      console.warn('⚠️ 官方接口兜底失败：拿不到 cid');
      return null;
    }

    const playRes = await axios.get('https://api.bilibili.com/x/player/playurl', {
      params: { bvid, cid, fnval: 16, fnver: 0, fourk: 1, qn: 16, platform: 'pc' },
      headers,
      timeout: 20000
    });

    if (playRes.data?.code !== 0) {
      console.warn('⚠️ 官方接口兜底失败:', playRes.data?.code, playRes.data?.message);
      return null;
    }

    const data = playRes.data?.data || {};
    const dashAudio = (data.dash?.audio || []).sort((a, b) => (b.bandwidth || 0) - (a.bandwidth || 0))[0];
    // dash 音频优先；没有则退回 durl（音视频混合流，qn=16 时体积也很小）
    const media = dashAudio ? { url: dashAudio.baseUrl, ext: 'm4a' } : (data.durl?.[0]?.url ? { url: data.durl[0].url, ext: 'mp4' } : null);

    if (!media) {
      console.warn('⚠️ 官方接口兜底失败：没有可取流地址');
      return null;
    }

    const ext = media.url.includes('.flv') ? 'flv' : media.ext;
    const filePath = `${basePath}.${ext}`;
    console.log(`正在通过官方接口下载音频（${dashAudio ? 'dash' : 'durl'}）...`);

    const res = await axios.get(media.url, {
      headers,                    // 直链 CDN 同样需要 Cookie + Referer
      responseType: 'stream',
      timeout,
      maxRedirects: 5,
      validateStatus: s => s < 400
    });

    const contentType = String(res.headers['content-type'] || '');
    if (contentType.includes('mpegurl') || contentType.includes('m3u8') || contentType.startsWith('text/')) {
      console.warn(`⚠️ 官方接口兜底失败：返回的不是媒体文件（${contentType}）`);
      res.data.destroy?.();
      return null;
    }

    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(filePath);
      res.data.pipe(ws);
      ws.on('finish', resolve);
      ws.on('error', reject);
      res.data.on('error', reject);
    });

    const size = fs.statSync(filePath).size;
    if (size < 10000) {
      console.warn(`⚠️ 官方接口兜底失败：文件过小(${size} bytes)`);
      try { fs.unlinkSync(filePath); } catch {}
      return null;
    }
    console.log(`✅ 官方接口下载成功（${(size / 1048576).toFixed(1)} MB）`);
    return filePath;
  } catch (error) {
    console.warn('⚠️ 官方接口兜底失败:', error.response?.status || error.message, JSON.stringify(error.response?.data)?.slice(0, 200));
    return null;
  }
}

/**
 * 下载音频并调用本地 faster-whisper 识别
 * @param {string} videoUrl
 * @param {number} durationSec 视频时长（秒），用于动态放宽超时；未知时按 10 分钟估算
 */
async function downloadAudioAndTranscribe(videoUrl, durationSec = 0) {
  const tempDir = path.resolve('temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const estSec = durationSec || 600;
  // 长视频下载/识别都更慢，动态放宽超时上限
  const downloadTimeout = Math.max(300000, Math.ceil(estSec / 3) * 1000);
  const asrTimeout = Math.max(600000, Math.ceil(estSec * 0.7) * 1000);

  const basePath = path.join(tempDir, `audio_${Date.now()}`);
  let audioPath = null;

  try {
    console.log('正在下载音频...');
    audioPath = downloadAudioWithYtDlp(videoUrl, basePath, downloadTimeout);
    if (!audioPath) {
      console.log('↪️ 改用 B站官方接口下载...');
      audioPath = await downloadAudioViaBiliApi(videoUrl, basePath, downloadTimeout);
    }
    if (!audioPath) throw new Error('音频下载失败（yt-dlp 与官方接口均失败）');

    console.log(`音频已下载: ${audioPath}`);

    // 调用 Python 脚本识别
    console.log(`正在使用 faster-whisper(${WHISPER_MODEL}) 识别（最长等待 ${Math.round(asrTimeout / 60000)} 分钟）...`);
    const scriptPath = path.resolve('scripts', 'transcribe.py');
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    let output;
    try {
      output = execSync(
        `${pythonCmd} "${scriptPath}" "${audioPath}" "${WHISPER_MODEL}"`,
        {
          encoding: 'utf-8',
          timeout: asrTimeout,
          stdio: 'pipe',
          env: { ...process.env, PYTHONUNBUFFERED: '1' }
        }
      );
    } catch (error) {
      console.error('❌ faster-whisper 识别失败:');
      logExecError('faster-whisper', error);
      return null;
    }

    const result = JSON.parse(output.trim());
    if (result.text && result.text.length > 20) {
      console.log(`✅ faster-whisper 识别成功（${result.text.length} 字）`);
      return result.text;
    }

    console.log('⚠️ 识别结果过短');
    return null;

  } catch (error) {
    console.error('❌ 音频处理失败:', error.message?.slice(0, 300));
    return null;
  } finally {
    // 清理临时音频
    try {
      const files = fs.readdirSync(tempDir);
      files.filter(f => f.startsWith(path.basename(basePath))).forEach(f => {
        try { fs.unlinkSync(path.join(tempDir, f)); } catch {}
      });
    } catch {}
  }
}


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main();
