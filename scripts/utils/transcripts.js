/**
 * 原文（语音转录稿）存档。
 *
 * 【为什么单独存，不塞进 videos.json】
 *   前端 `src/api/d1.ts` 是直接 `fetch('/data/videos.json')` **整包下载**的。
 *   现在 532 条已经 6.4MB；每条再挂 5k~20k 字的转录稿，会涨到 30MB+，
 *   首屏直接崩（国内网络下 6.4MB 就已经很慢了，见 build-views-lite.js 头注释）。
 *   ⇒ 正文按 bvid 一文件存，videos.json 里只留引用和元信息。
 *
 * 【为什么放 public/data/transcripts/ 而不是仓库根 data/】
 *   `.github/workflows/check-bilibili.yml` 的提交步骤是 `git add public/data/`。
 *   放根目录 data/ 下的话，Actions 跑完不会 commit，原文当场丢失 ——
 *   而且这种丢失是静默的：日志里一切正常，本地也不报错。
 *
 * 【为什么值得存】
 *   ① 回测：能拿原话对照模型输出，判断"是他说错了还是模型读错了"。
 *   ② 重跑成本：一次转录要下载音频 + faster-whisper 跑几分钟。
 *      存了原文，`--reanalyze` 直接复用，只花一次 LLM 调用。
 *   ③ 提示词改版时，可以在不重新转录的前提下反复重跑、对比口径。
 *
 * 【体积】UTF-8 中文约 3 字节/字，5000 字 ≈ 15KB；532 条全存约 8~16MB。
 *   单文件不参与首屏（前端不请求），只影响部署产物总量。
 */
import fs from 'fs';
import path from 'path';

const TRANSCRIPT_DIR = path.resolve('public', 'data', 'transcripts');

/** bvid 只做白名单校验，防止拼路径时被注入 ../ */
function assertBvid(bvid) {
  if (!/^BV[0-9A-Za-z]+$/.test(String(bvid || ''))) {
    throw new Error(`非法 bvid: ${bvid}`);
  }
}

/** 存档路径（相对 public 根，便于前端直接 fetch） */
export function transcriptRef(bvid) {
  assertBvid(bvid);
  return `data/transcripts/${bvid}.txt`;
}

function absolutePath(bvid) {
  assertBvid(bvid);
  return path.join(TRANSCRIPT_DIR, `${bvid}.txt`);
}

/** 原文是否已存档 */
export function hasTranscript(bvid) {
  try {
    return fs.existsSync(absolutePath(bvid));
  } catch {
    return false;
  }
}

/**
 * 保存原文。已存在则覆盖（重跑时以最新转录为准）。
 * @returns {{ref: string, chars: number, path: string}}
 */
export function saveTranscript(bvid, text) {
  assertBvid(bvid);
  if (typeof text !== 'string' || text.length < 20) {
    throw new Error(`转录文本过短（${text?.length ?? 0} 字），不存档`);
  }
  fs.mkdirSync(TRANSCRIPT_DIR, { recursive: true });
  const abs = absolutePath(bvid);
  fs.writeFileSync(abs, text, 'utf-8');
  return { ref: transcriptRef(bvid), chars: text.length, path: abs };
}

/** 读取原文；不存在返回 null（调用方据此决定是否重新转录） */
export function loadTranscript(bvid) {
  try {
    const abs = absolutePath(bvid);
    if (!fs.existsSync(abs)) return null;
    const text = fs.readFileSync(abs, 'utf-8');
    return text.length >= 20 ? text : null;
  } catch {
    return null;
  }
}

/** 统计已存档数量（日志用） */
export function transcriptStats() {
  try {
    const files = fs.readdirSync(TRANSCRIPT_DIR).filter((f) => f.endsWith('.txt'));
    const bytes = files.reduce((sum, f) => {
      try {
        return sum + fs.statSync(path.join(TRANSCRIPT_DIR, f)).size;
      } catch {
        return sum;
      }
    }, 0);
    return { count: files.length, mb: bytes / 1048576 };
  } catch {
    return { count: 0, mb: 0 };
  }
}
