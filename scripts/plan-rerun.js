/**
 * 全量重跑分批计划（只读 / 零网络 / 零 LLM / 默认不写任何文件）
 *
 * 用法：
 *   node scripts/plan-rerun.js                     # 人读：盘点 + 分批 + 可执行命令
 *   node scripts/plan-rerun.js --batch-size 12    # 指定每批条数
 *   node scripts/plan-rerun.js --json             # 机器读（全部批次）
 *
 * ★★ 为什么**必须**用 BV 号串分批、不能用条数：
 *   `reanalyzeVideos(arg)` / `archiveTranscripts(arg)` 在 arg 非 BV 开头时走
 *   `data.slice(0, Number(arg))` —— 每次都取**最新 N 条**，而且完全不检查
 *   `schema_version`。用「10」分批会反复重跑最新 10 条，后面的永远跑不到。
 *
 * ★ 断点续跑靠**数据本身**：步骤 2 已在每条注入 `schema_version`。
 *   跑完一批后重新运行本脚本，带当前版本的条目自动从待重跑清单消失
 *   ⇒ 不需要持久化计划文件（计划会过期，数据不会）。
 *
 * ★ 硬约束（.github/workflows/check-bilibili.yml）：
 *   · timeout-minutes: 120；job 被 timeout 杀掉 ⇒ "提交更新"步骤不执行，
 *     runner 内改动**全部丢失** ⇒ 每批必须能在 120 分钟内跑完并 commit；
 *   · concurrency: group check-bilibili / cancel-in-progress: false
 *     ⇒ 多批只能串行（手动 dispatch 会自动排队）；
 *   · count 白名单 ^[0-9A-Za-z,]+$ ⇒ BV 号串合法，中文逗号不合法。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { currentSchema, checkFrozen, V2_FINGERPRINT,
         classify } from './utils/schema-version.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'public/data/videos.json');
const TRANSCRIPT_DIR = path.join(ROOT, 'public/data/transcripts');
// ★ 10 条/批：全需字幕的批次估算上限约 80 分钟，给 timeout-minutes:120 留 40 分钟余量。
//   （12 条时上限 96 分钟；长视频 whisper 一旦拖过 120 分钟，整批改动会全丢。）
const DEFAULT_BATCH_SIZE = 10;

function argInt(name, dflt) {
  const i = process.argv.indexOf(name);
  return i > 0 ? (parseInt(process.argv[i + 1], 10) || dflt) : dflt;
}

function main() {
  const asJson = process.argv.includes('--json');
  // --take [N]：只输出**下一批**，供逐批 dispatch 用（免得每次去翻 --json）
  const takeIdx = process.argv.indexOf('--take');
  const takeMode = takeIdx >= 0;
  const takeArg = takeIdx >= 0 ? process.argv[takeIdx + 1] : null;
  let batchSize = Math.max(1, (takeArg && /^\d+$/.test(takeArg))
    ? parseInt(takeArg, 10)
    : argInt('--batch-size', DEFAULT_BATCH_SIZE));
  const cur = currentSchema();
  const frozen = checkFrozen();
  const data = JSON.parse(fs.readFileSync(SRC, 'utf-8'));

  let done = 0;
  const blocked = [];
  const todo = [];
  for (const e of data) {
    const v = classify(e, V2_FINGERPRINT);
    const hasVersion = !!e && e.schema_version === cur.schema_version;
    if (v === 'v2' && hasVersion) { done++; continue; }
    const bvid = String(e?.bvid || '').trim();
    if (!/^BV[0-9A-Za-z]+$/i.test(bvid)) {
      blocked.push({
        reason: 'bvid 缺失/格式异常',
        _id: e?._id || e?.id || null,
        date: String(e?.date || ''),
        bvid: bvid || null,
        title: String(e?.title || '').slice(0, 40),
        has_transcript: !!e?.transcript_ref,
      });
      continue;
    }
    todo.push({
      bvid,
      date: String(e.date || ''),
      cached: fs.existsSync(path.join(TRANSCRIPT_DIR, `${bvid}.txt`)),
      reason: v === 'v2' ? 'v2-无版本/旧版本' : v,
    });
  }

  // 已存档的排前面（零转录、最快见效）；其余按日期新→旧（新视频更可能有 AI 字幕）
  todo.sort((a, b) => (Number(b.cached) - Number(a.cached))
    || b.date.localeCompare(a.date));

  const batches = [];
  for (let i = 0; i < todo.length; i += batchSize) {
    const items = todo.slice(i, i + batchSize);
    const nCached = items.filter(x => x.cached).length;
    const nSub = items.length - nCached;
    // 粗估（分钟）：已存档只花 1 次 LLM；无存档若 AI 字幕不可用要 whisper
    const lo = nCached * 0.5 + nSub * 0.7;
    const hi = nCached * 1.5 + nSub * 8;
    batches.push({
      no: batches.length + 1,
      count: items.length,
      cached: nCached,
      needs_subtitle: nSub,
      est_minutes: [Math.round(lo), Math.round(hi)],
      bvids: items.map(x => x.bvid),
      arg: items.map(x => x.bvid).join(','),
    });
  }

  const result = {
    generated_at: new Date().toISOString(),
    schema_version: cur.schema_version,
    frozen,
    total: data.length,
    done,
    todo: todo.length,
    blocked: blocked.length,
    // ★ 全量输出（不采样）：这些条目要人工补 bvid 或标 unverified 剔除，清单必须完整。
    blocked_items: blocked,
    cached: todo.filter(x => x.cached).length,
    needs_subtitle: todo.filter(x => !x.cached).length,
    reason_breakdown: todo.reduce((acc, x) => {
      acc[x.reason] = (acc[x.reason] || 0) + 1;
      return acc;
    }, {}),
    batch_size: batchSize,
    batch_count: batches.length,
    batches,
    caveats: [
      `口径差异：audit 的 rerun_gap 是「口径不合格条数」，本脚本 todo=${todo.length}`
        + ` 是「实际可重跑条数」，差额 ${blocked.length} = blocked`,
      `${blocked.length} 条 blocked 均为 bvid 缺失的 2026-04 早期条目（无视频源、无原文存档）：`
        + '补 bvid 或标 unverified 并从图表/统计剔除，不能留着旧口径假装是数据',
      '分批必须用 BV 号串：条数模式是 data.slice(0,N)，会反复重跑最新 N 条',
      'archive-transcripts 默认不开 --whisper，无 AI 字幕的老视频会被跳过；reanalyze 才自己 fallback whisper（慢）',
      '每批务必 <120 分钟且确认 Actions「提交更新」成功，否则 runner 内改动全丢',
      'concurrency 只串行；跑完一批后重新跑本脚本即可断点续跑',
    ],
  };

  // ★ --take：只输出下一批，避免每次都去翻 --json 里的长 BV 串
  if (takeMode) {
    const b = batches[0];
    if (!b) {
      console.log(asJson ? JSON.stringify({ done, todo: 0, blocked: blocked.length })
        : `没有待重跑条目（已完成 ${done} 条）`);
      process.exit(frozen.ok ? 0 : 1);
    }
    if (asJson) {
      console.log(JSON.stringify({
        batch: b, todo: todo.length, done,
        blocked: blocked.length, batch_count: batches.length,
        schema_version: cur.schema_version, frozen,
      }, null, 2));
      process.exit(frozen.ok ? 0 : 1);
    }
    console.log(`=== 下一批（第 ${b.no} 批 / 共 ${batches.length} 批）===`);
    console.log(`剩余待重跑 ${todo.length} 条 | cached ${b.cached}`
      + ` / 需字幕 ${b.needs_subtitle} | 约 ${b.est_minutes[0]}~${b.est_minutes[1]} 分钟`);
    console.log('');
    console.log(`Actions: run_mode=reanalyze  count="${b.arg}"`);
    if (b.needs_subtitle > 0) {
      console.log(`（含 ${b.needs_subtitle} 条无存档原文；如需先抓原文：`
        + `run_mode=archive-transcripts  count="${b.arg}"，whisper 按需开）`);
    }
    process.exit(frozen.ok ? 0 : 1);
  }

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(frozen.ok ? 0 : 1);
  }

  console.log('=== 全量重跑分批计划（只读）===');
  console.log(`规则版本   ${cur.schema_version} | 冻结 ${frozen.ok ? 'OK' : 'FAIL: ' + frozen.reason}`);
  console.log(`数据       ${result.total} 条 | 已完成 ${done} / 待重跑 ${todo.length}`
    + ` / 无法重跑 ${blocked.length}`);
  console.log(`  待重跑构成 ${JSON.stringify(result.reason_breakdown)}`);
  console.log(`  已存档原文 ${result.cached} 条（零转录）| 需抓字幕 ${result.needs_subtitle} 条`);
  const maxEst = batches.reduce((m, b) => Math.max(m, b.est_minutes[1]), 0);
  console.log(`分批       ${batches.length} 批 × ${batchSize} 条`
    + ` | 单批估算上限 ${maxEst} 分钟（闸门 120）`);
  console.log('');
  const shown = batches.slice(0, 3);
  for (const b of shown) {
    console.log(`第 ${b.no} 批：${b.count} 条 | cached ${b.cached} / 需字幕 ${b.needs_subtitle}`
      + ` | 约 ${b.est_minutes[0]}~${b.est_minutes[1]} 分钟`);
    console.log(`  Actions: run_mode=archive-transcripts  count="${b.arg}"`);
    console.log(`  Actions: run_mode=reanalyze           count="${b.arg}"`);
  }
  if (batches.length > shown.length) {
    console.log(`  ... 其余 ${batches.length - shown.length} 批见 --json`);
  }
  console.log('');
  console.log('执行顺序：每批先 archive-transcripts（抓原文）→ 确认 commit →'
    + ' 再 reanalyze（复用原文、只花 LLM）→ 确认 commit → 重新跑本脚本续跑下一批');
  console.log('注意：');
  for (const c of result.caveats) console.log('  · ' + c);
  process.exit(frozen.ok ? 0 : 1);
}

main();
