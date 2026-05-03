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

// ==================== 配置区域 ====================
const LLM_API_KEY = process.env.LLM_API_KEY;
// LLM配置：默认用硅基流动SiliconFlow（国内免费），也可换成其他OpenAI兼容API
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.siliconflow.cn/v1';
const LLM_MODEL = process.env.LLM_MODEL || 'deepseek-ai/DeepSeek-V3';
const BILI_UID = process.env.BILI_UID || '2137589551'; // 李大霄UID，可改成别的UP主
const DATA_PATH = path.resolve('public/data/videos.json');

// faster-whisper 配置
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'base';
const WHISPER_MODEL_CACHE = path.resolve('temp', 'models');

// Cookie配置：GitHub Actions无浏览器，需通过BILI_COOKIE环境变量传入
const BILI_COOKIE = process.env.BILI_COOKIE || ''; // 直接Cookie字符串
const BROWSER = process.env.BILI_BROWSER || 'edge';

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
      await checkAndProcessNewVideos();
    } else if (mode?.includes('bilibili.com')) {
      await processSingleVideo(mode);
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
async function checkAndProcessNewVideos() {
  console.log('正在检测新视频（通过 yt-dlp）...');

  // 用 yt-dlp 获取UP主视频列表
  // flat-playlist 模式下B站不返回标题，只取ID，标题在下载时获取
  const spaceUrl = `https://space.bilibili.com/${BILI_UID}/video`;
  let output;
  try {
    output = execSync(
      `yt-dlp ${YT_DLP_ARGS} --flat-playlist --print "%(id)s" --playlist-end 30 "${spaceUrl}"`,
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
    // 过滤时长超过15分钟（900秒）的视频
    if (duration && duration > 900) {
      console.log(`跳过超长视频: ${bvid.trim()} - ${title || '无标题'} (${Math.floor(duration / 60)}分${duration % 60}秒)`);
      continue;
    }
    videos.push({ bvid: bvid.trim(), title, duration, date: formattedDate });
  }

  console.log(`获取到 ${videos.length} 个视频`);

  // 读取已处理的视频BV号
  let processedBVs = [];
  try {
    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    processedBVs = data.map(v => v.bvid || '').filter(Boolean);
  } catch {
    processedBVs = [];
  }

  let processedCount = 0;
  for (const video of videos) {
    if (processedBVs.includes(video.bvid)) {
      console.log(`跳过已处理: ${video.bvid}`);
      continue;
    }

    const videoUrl = `https://www.bilibili.com/video/${video.bvid}`;
    console.log(`\n发现新视频: ${video.bvid} - ${video.title || '无标题'}`);
    await processSingleVideo(videoUrl, video.title, video.bvid, video.date);
    processedCount++;

    // 避免请求过快
    await sleep(3000);
  }

  console.log(`\n处理完成，新增 ${processedCount} 个视频`);
}

// ==================== 处理单个视频 ====================
async function processSingleVideo(videoUrl, knownTitle = null, bvid = null, knownDate = null) {
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

    // 2. 获取字幕（优先B站AI字幕，失败则使用阿里云语音识别）
    console.log('正在获取字幕...');
    let transcript = await downloadBilibiliSubtitle(videoUrl);
    
    if (!transcript) {
      console.log('B站AI字幕不可用，尝试阿里云语音识别...');
      transcript = await downloadAudioAndTranscribe(videoUrl);
    }

    if (!transcript) {
      console.error('字幕获取失败，跳过此视频');
      return;
    }

    // 3. AI分析
    console.log('正在AI分析...');
    const analysisJson = await analyzeTranscript(transcript, videoTitle, bvid, knownDate);

    // 4. 写入数据
    const data = fs.existsSync(DATA_PATH)
      ? JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'))
      : [];
    if(analysisJson) {
      data.unshift(analysisJson);
      fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
      console.log('✅ 成功添加:', analysisJson.title || videoTitle || '未命名'); 
    } else {
      console.error('处理失败');
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
  console.log('API URL:', LLM_BASE_URL);
  console.log('Model:', LLM_MODEL);
  console.log('Key前10位:', LLM_API_KEY?.slice(0, 10));

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
    const response = await axios.post(
      `${LLM_BASE_URL}/chat/completions`,
      {
        model: LLM_MODEL,
        messages: [
          { role: "system", content: "你是一个严格遵循指令的文本解析专家，必须输出完整、详细、不省略任何字段的JSON。" },
          { role: "user", content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 8192,
        response_format: { type: "json_object" }   // 可以保留
      },
      {
        headers: { 'Authorization': `Bearer ${LLM_API_KEY}` },
        timeout: 3000000
      }
    );

    console.log('\n✅ AI分析成功！');
    console.log(response.data.choices[0].message.content);
    return JSON.parse(response.data.choices[0].message.content);
  } catch (error) {
    console.error('\n❌ AI分析失败:', error);
    if (error.code) console.error('错误码:', error.code);
  }
}

// ==================== faster-whisper 语音识别（Node 调 Python）====================

/**
 * 下载音频并调用本地 faster-whisper 识别
 */
async function downloadAudioAndTranscribe(videoUrl) {
  const tempDir = path.resolve('temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  
  // 用 m4a 格式，不需要 ffmpeg 转码
  const basePath = path.join(tempDir, `audio_${Date.now()}`);
  
  try {
    console.log('正在下载音频...');
    
    // 下载最佳音频流（B站通常是 m4a/aac）
    const cmd = `yt-dlp ${YT_DLP_COOKIE_ARGS} -f "ba" --no-playlist -o "${basePath}.%(ext)s" "${videoUrl}"`;
    execSync(cmd, { encoding: 'utf-8', timeout: 120000, stdio: 'pipe' });
    
    // 找到实际下载的文件
    const files = fs.readdirSync(tempDir);
    const audioFile = files.find(f => f.startsWith(path.basename(basePath)));
    if (!audioFile) throw new Error('音频下载失败');
    
    const audioPath = path.join(tempDir, audioFile);
    console.log(`音频已下载: ${audioPath}`);
    
    // 调用 Python 脚本识别
    console.log('正在使用 faster-whisper 识别...');
    const scriptPath = path.resolve('scripts', 'transcribe.py');
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const output = execSync(
      `${pythonCmd} "${scriptPath}" "${audioPath}" "base"`,
      { 
        encoding: 'utf-8', 
        timeout: 300000,
        stdio: 'pipe',
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      }
    );
    
    const result = JSON.parse(output.trim());
    
    // 清理音频文件
    try { fs.unlinkSync(audioPath); } catch {}
    
    if (result.text && result.text.length > 20) {
      console.log(`✅ faster-whisper 识别成功（${result.text.length} 字）`);
      return result.text;
    }
    
    console.log('⚠️ 识别结果过短');
    return null;
    
  } catch (error) {
    console.error('❌ faster-whisper 识别失败:', error.message?.slice(0, 200));
    // 清理
    try {
      const files = fs.readdirSync(tempDir);
      files.filter(f => f.startsWith(path.basename(basePath))).forEach(f => {
        fs.unlinkSync(path.join(tempDir, f));
      });
    } catch {}
    return null;
  }
}


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main();
