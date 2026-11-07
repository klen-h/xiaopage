/**
 * 李大霄"黑话"挖词器。
 *
 * 【为什么要用脚本挖，而不是人工列】
 *   黑话表一旦靠回忆列，就等于把"我认为他其实在说什么"塞进提示词 ——
 *   这正是上一版提示词出问题的地方（"他不能明面唱空，你要挖掘真意"），
 *   只是从"模型的猜测"换成"人的猜测"，同样无法追责、无法复现。
 *   所以词表的入口必须是**可统计的证据**：某词在多少条不同视频里出现、
 *   同现的是哪个市场名、当时模型给的方向是什么。人工只负责最后一步"定性"。
 *
 * 【语料来源与已知偏差】
 *   语料取 videos.json 里 `deep_analysis.hidden_meanings[].quote/surface` + `core_views`
 *   等字段，共约 2472 条原话片段。注意：这些 quote 是**旧提示词筛出来的**
 *   （旧 prompt 要求"每条表面表述配一个深层含义"），天然偏向"有弦外之音"的句子。
 *   因此本脚本只能给出"候选 + 频次"，不能证明出现率；要真正统计口头禅，
 *   得先把转录稿落盘（目前 videos.json 不存转录）。
 *
 * 【用法】
 *   node scripts/lexicon-mine.js                    # 候选短语排行（默认前 80）
 *   node scripts/lexicon-mine.js --top 150
 *   node scripts/lexicon-mine.js --grep 外围         # 某个词的全部上下文
 *   node scripts/lexicon-mine.js --json              # 机器可读（喂给词典维护流程）
 */
import fs from 'fs';
import path from 'path';

const DATA_PATH = path.resolve('public/data/videos.json');

// 中文虚词/代词开头或结尾的组合基本不是行话，用来压掉 n-gram 噪声
const BAD_HEAD = /^[的了是我他她它这那在就也都和与有不很还又才把被给让从对把个吗呢吧啊哦嗯]/;
const BAD_TAIL = /[的了是就也都和与不很还又才把被给让从对个吗呢吧啊哦嗯]$/;
const HAS_CJK = /[\u4e00-\u9fa5]/;

function loadVideos() {
  if (!fs.existsSync(DATA_PATH)) {
    console.error(`数据文件不存在: ${DATA_PATH}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
}

/**
 * 收集每条视频的"原话片段"。
 *
 * ★ 只取 hidden_meanings[].quote / .surface —— 这是全库里**唯一**声称是原文引用的字段。
 *   第一版把 core_views / signals / operation_advice / summary 也算了进去，
 *   结果排行前 30 名有一半是模型的元话语（"信号""暗示""弦外之音""投资者应""强烈"）——
 *   挖出来的是"分析文的写法"，不是"李大霄的口头禅"。用那种表去教模型识别黑话，
 *   等于把模型的套话当成他的黑话，误差反而被固化。
 *
 *   遗留偏差（必须知道）：这些 quote 是**旧提示词筛出来的**，旧 prompt 要求
 *   "每条表面表述配一个深层含义"，所以保留下来的句子天然偏"有弦外之音"。
 *   要统计真实口头禅，必须先把转录稿落盘（当前 videos.json 不存转录）。
 */
function collectSnippets(videos) {
  return videos.map((v) => {
    const da = v.deep_analysis || {};
    const quotes = (da.hidden_meanings || []).flatMap((h) => [h?.quote, h?.surface]).filter(Boolean);
    const texts = quotes.filter((s) => typeof s === 'string' && s.length > 0);
    return { bvid: v.bvid, date: v.date, title: v.title, score: v.sentiment_score, direction: v.direction, texts };
  }).filter((s) => s.texts.length > 0);
}

/** 中文 n-gram 计数：统计"多少条不同视频里出现过"，比总次数更接近口头禅。 */
function ngramStats(snippets, minLen = 2, maxLen = 5) {
  const df = new Map();          // gram -> Set(bvid)
  const sample = new Map();      // gram -> 首次出现的上下文
  for (const s of snippets) {
    const seen = new Set();
    for (const t of s.texts) {
      // 只保留连续中文段，避免跨标点拼出假词
      for (const seg of t.split(/[^\u4e00-\u9fa5]+/)) {
        if (seg.length < minLen) continue;
        for (let n = minLen; n <= maxLen; n++) {
          for (let i = 0; i + n <= seg.length; i++) {
            const g = seg.slice(i, i + n);
            if (BAD_HEAD.test(g) || BAD_TAIL.test(g)) continue;
            if (!seen.has(g)) {
              if (!df.has(g)) df.set(g, new Set());
              df.get(g).add(s.bvid);
              seen.add(g);
            }
            if (!sample.has(g)) sample.set(g, { ctx: t.slice(Math.max(0, i - 20), i + n + 20), date: s.date });
          }
        }
      }
    }
  }
  const total = snippets.length;
  const raw = [...df.entries()]
    .map(([term, set]) => ({ term, df: set.size, ratio: set.size / total, sample: sample.get(term) }))
    .filter((x) => HAS_CJK.test(x.term))
    .sort((a, b) => b.df - a.df || b.term.length - a.term.length);

  // 去滑窗冗余："星之火""之火也能""火也能温" 都是"星星之火也能温暖"的子串，
  // 它们 df 几乎相同（因为总是一起出现）。凡是"是某个已选词子串且 df 相差 ≤3" 的丢弃，
  // 只留最长的那个完整词组 —— 否则排行会被同一句反复刷屏。
  const lcs = (a, b) => {
    let best = 0;
    for (let i = 0; i < a.length; i++) {
      for (let j = 0; j < b.length; j++) {
        let k = 0;
        while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
        if (k > best) best = k;
      }
    }
    return best;
  };
  const kept = [];
  for (const cand of raw) {
    // 注意是"重叠"不是"包含"：'星之火也能' 与 '星星之火' 谁都不包含谁，
    // 但共享 3 字且 df 几乎相同 ⇒ 同一句的滑窗变体，只留更长/更靠前的那个。
    const dup = kept.find((k) => lcs(k.term, cand.term) >= Math.min(3, cand.term.length)
      && Math.abs(k.df - cand.df) <= 3);
    if (dup) continue;
    kept.push(cand);
  }
  return kept;
}

function printGrep(snippets, keywordArg, limit = 25) {
  // 支持一次查多个词：--grep 外围,好股票,余钱 （省得来回跑，也便于横向比较同现关系）
  const keywords = String(keywordArg || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  for (const keyword of keywords) {
    const hits = snippets.filter((s) => s.texts.some((t) => t.includes(keyword)));
    console.log(`\n════ 含「${keyword}」的视频：${hits.length} / ${snippets.length} ════`);
    for (const s of hits.slice(0, limit)) {
      console.log(`—— ${s.date} score=${s.score ?? '—'} dir=${s.direction ?? '—'} ${s.title || ''}`);
      for (const t of s.texts) {
        let i = t.indexOf(keyword);
        while (i !== -1) {
          console.log(`   …${t.slice(Math.max(0, i - 55), i + keyword.length + 55)}…`);
          i = t.indexOf(keyword, i + 1);
          if (i > 600) break;
        }
      }
    }
  }
}

const args = process.argv.slice(2);
const topIdx = args.indexOf('--top');
const grepIdx = args.indexOf('--grep');
const limitIdx = args.indexOf('--limit');
const videos = loadVideos();
const snippets = collectSnippets(videos);

if (grepIdx !== -1) {
  printGrep(snippets, args[grepIdx + 1], Number(limitIdx !== -1 ? args[limitIdx + 1] : 25) || 25);
} else {
  const top = Number(topIdx !== -1 ? args[topIdx + 1] : 80) || 80;
  const stats = ngramStats(snippets).filter((x) => x.df >= 8).slice(0, top);

  if (args.includes('--json')) {
    console.log(JSON.stringify(stats, null, 2));
  } else {
    console.log(`语料 ${snippets.length} 条视频，候选短语（按"出现于多少条不同视频"排序）：\n`);
    for (const s of stats) {
      console.log(`${String(s.df).padStart(4)}  ${(s.ratio * 100).toFixed(0).padStart(3)}%  ${s.term}`);
      if (s.sample) console.log(`            ↳ ${s.sample.date}｜${s.sample.ctx.replace(/\n/g, ' ')}`);
    }
    console.log('\n提示：df 高 ≠ 一定是黑话（"长期""理性"也会很高）。'
      + '\n     定性必须配合上下文：node scripts/lexicon-mine.js --grep <词>');
  }
}
