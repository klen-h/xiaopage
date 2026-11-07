/**
 * 解读数据口径审计（只读 / 秒级 / 零网络 / 零 LLM 调用 / 不写任何文件）
 *
 * 用法：
 *   node scripts/audit-views.js            # 人读报告
 *   node scripts/audit-views.js --json     # 机器读（含字段契约，供下游 T+20 脚本取用）
 *
 * 【为什么必须固化成脚本】2026-11-07 提示词重写后，videos.json 里新旧两代口径
 * 混在一起。「有没有 market」只是**隐式版本**，全量重跑 522 条之后无法回答：
 *   跑成了几条？哪几条还是旧的？有没有 LLM 返回半截字段却被写进去了？
 * ⇒ 把「怎么判定一条是新口径」写死在这里，重跑**前**用来盘点、
 *   重跑**后**用同一把尺子验收，避免判据只存在聊天记录里。
 *
 * 【退出码】0 = 数据自洽；1 = 出现 partial（半截字段）/ invalid / lite 漂移。
 *   ⚠️ v1 与 v2 **混合不算失败** —— 那是迁移中的合法状态，报告如实列数量即可。
 *      真正危险的是 partial 和派生文件漂移：这两种是静默脏数据。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { currentSchema, checkFrozen, readLock, versionStats,
         V2_FINGERPRINT, LITE_V2_FINGERPRINT,
         classify } from './utils/schema-version.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'public/data/videos.json');
const LITE = path.join(ROOT, 'public/data/views-lite.json');
const TRANSCRIPTS = path.join(ROOT, 'public/data/transcripts');

// ── 口径契约（下游请以 --json 输出为准，别再靠提示词注释手抄）──────────────
const SCHEMA_VERSION_V2 = '2026-11-07';

// 口径判据（V2_FINGERPRINT / LITE_V2_FINGERPRINT / classify）已抽到
// utils/schema-version.js 作**单一事实源**，与 plan-rerun.js 共用，避免漂移。

// 字面字段 = 原文里有据可查；推断字段 = 模型生成的解读。
// ★ 下游 T+20 统计脚本的正文拼接**只允许**取 `recommended_for_t20`。
//   旧版把 operation_advice / risk_tips / final_conclusion 拼进统计文本，
//   在新口径下会把「模型推断」当成「他说过的话」：
//     · advice_literal / operation_advice 现在是原话摘录（实测有「做个好人…」）
//     · final_conclusion 变成 "(1) 他明说了什么 (2) 原文未表态 (3) 适用市场" 三段式
//   ⇒ 字段名和类型全没变，纯语义漂移，**零报错**。
const LITERAL_FIELDS = [
  'date', 'title', 'bvid',
  'market_literal', 'market_evidence',
  'direction_quote', 'code_words[].term', 'code_words[].quote',
  'summary', 'tags',
  'structured.core_views', 'structured.sectors',
  'structured.advice_literal', 'structured.operation_advice',
  'structured.risk_tips',
  'transcript_ref', 'transcript_source',
];
const INFERENCE_FIELDS = [
  'sentiment_score', 'sentiment_note', 'sentiment_by_market',
  'market', 'direction', 'confidence',
  'disclaimer_level', 'disclaimer_note', 'disclaimer_stacking',
  'structured.advice_inference',
  'deep_analysis.final_conclusion', 'deep_analysis.hidden_meanings',
  'deep_analysis.data_analysis.subtext', 'deep_analysis.signals',
  'logic_factors',
];
// 跨版本语义**稳定**的字面字段（v1 也保证是原文内容）。
// ⚠️ 刻意排除 summary / tags / risk_tips：v1 提示词允许"提炼/警示要点"，
//    含模型推断；只有 v2 才明写"只包含原文有依据的内容"。跨 v1/v2 统计别用。
const RECOMMENDED_FOR_T20 = [
  'date', 'title', 'bvid',
  'structured.core_views', 'structured.sectors',
  'structured.advice_literal', 'structured.operation_advice',
  'direction_quote', 'market_literal', 'code_words[].quote',
];
// lite 是裁剪后的派生文件，可读的字面字段只有这些（别按 videos.json 的清单去取）。
const LITE_LITERAL_FIELDS = [
  'date', 'title', 'bvid',
  'structured.core_views', 'structured.sectors',
  'structured.operation_advice', 'structured.risk_tips',
];

function readArray(p) {
  if (!fs.existsSync(p)) throw new Error(`文件不存在: ${p}`);
  const d = JSON.parse(fs.readFileSync(p, 'utf-8'));
  if (!Array.isArray(d)) throw new Error(`不是 JSON 数组: ${p}`);
  return d;
}

function tally(rows, fingerprint) {
  const out = { total: rows.length, v2: 0, v1: 0, partial: 0, invalid: 0,
                partial_ids: [] };
  for (const e of rows) {
    const v = classify(e, fingerprint);
    out[v]++;
    if (v === 'partial' && out.partial_ids.length < 20) {
      out.partial_ids.push(e?.bvid || e?._id || '(无 id)');
    }
  }
  return out;
}

function main() {
  const asJson = process.argv.includes('--json');
  const videos = readArray(SRC);
  const lite = readArray(LITE);
  const vt = tally(videos, V2_FINGERPRINT);
  const lt = tally(lite, LITE_V2_FINGERPRINT);

  // 原文存档覆盖 —— 全量重跑的**前置条件**。
  // archiveTranscripts 默认 allowWhisper=false（无 AI 字幕就跳过），
  // 而 reanalyze 缺原文时才自己 fallback whisper（每条几分钟）。
  let files = [];
  try {
    files = fs.readdirSync(TRANSCRIPTS).filter(f => f.endsWith('.txt'));
  } catch {
    // 目录不存在 = 0 条存档
  }
  const archived = videos.filter(e => e.transcript_ref).length;
  const subtitleRef = videos.filter(
    e => e.subtitle || e.subtitle_url || e.ai_subtitle).length;

  // lite 与源对齐（派生文件漂移检查）
  const mismatches = [];
  for (let i = 0; i < lite.length; i++) {
    const a = lite[i];
    const b = videos[i];
    if (!b) {
      mismatches.push({ i, why: '源缺少对应条目' });
      continue;
    }
    if (String(a.date || '') !== String(b.date || '') ||
        String(a.bvid || '') !== String(b.bvid || '')) {
      mismatches.push({ i, why: 'date/bvid 不一致',
                        lite: `${a.date}/${a.bvid}`, src: `${b.date}/${b.bvid}` });
    }
    const st = (b.structured && typeof b.structured === 'object') ? b.structured : {};
    const expected = String(st.advice_literal || st.operation_advice || '').slice(0, 200);
    const actual = String((a.structured || {}).operation_advice || '');
    if (expected !== actual) {
      mismatches.push({ i, why: 'operation_advice 与源不一致', bvid: a.bvid });
    }
  }

  const dates = videos.map(e => String(e.date || '')).filter(Boolean).sort();
  const cur = currentSchema();
  const frozen = checkFrozen();
  const vstats = versionStats(videos, e => classify(e, V2_FINGERPRINT) === 'v2',
                              cur.schema_version);
  const lstats = versionStats(lite, e => classify(e, LITE_V2_FINGERPRINT) === 'v2',
                              cur.schema_version);

  const result = {
    generated_at: new Date().toISOString(),
    schema_version_v2: SCHEMA_VERSION_V2,
    schema: {
      current: cur.schema_version,
      content_fingerprint: cur.content_fingerprint,
      frozen,
      lock: readLock(),
      videos: vstats,
      lite: lstats,
    },
    fingerprint: { videos: V2_FINGERPRINT, lite: LITE_V2_FINGERPRINT },
    videos: {
      ...vt,
      date_min: dates[0] || null,
      date_max: dates[dates.length - 1] || null,
      transcript_archived: archived,
      transcript_files: files.length,
      subtitle_ref_in_source: subtitleRef,
      // ★ 2026-11-07：重跑缺口还要算上「v2 但没有 / 带旧 schema_version」的条目。
      //   冻结前算出的那 10 条 v2 就没带版本标记，不一起重跑会永远无法追溯口径。
      rerun_gap: vt.v1 + vt.partial + vt.invalid
        + vstats.unversioned + vstats.stale,
    },
    lite: lt,
    lite_mismatch_count: mismatches.length,
    lite_mismatches: mismatches.slice(0, 20),
    contract: {
      literal_fields: LITERAL_FIELDS,
      inference_fields: INFERENCE_FIELDS,
      recommended_for_t20: RECOMMENDED_FOR_T20,
      lite_literal_fields: LITE_LITERAL_FIELDS,
      caveats: [
        'summary / tags / risk_tips 在 v1 口径下可能含模型推断，跨 v1/v2 样本统计请排除',
        'structured.operation_advice 与 advice_literal 在 v2 下内容等价（兼容字段），取名时优先 advice_literal',
        'deep_analysis.final_conclusion 在 v2 是三段式结论，绝不可拼进统计正文',
        'lite 是派生文件，字段是 videos.json 的子集；下游只读 lite 时用 lite_literal_fields',
      ],
    },
  };

  const dirty = (vt.partial + vt.invalid + lt.partial + lt.invalid +
                 mismatches.length) > 0;
  // ★ --assert-frozen = 重跑前的闸门。规则若已漂移，跑完 522 条只会得到
  //   「字段集合相同、口径已变」的第三版数据，audit 抓不到 ⇒ 几十小时白烧。
  const assertFrozen = process.argv.includes('--assert-frozen');
  const gateFailed = assertFrozen && !frozen.ok;

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(dirty || gateFailed ? 1 : 0);
  }

  const v = result.videos;
  const s = result.schema;
  console.log('=== 解读数据口径审计（只读）===');
  console.log(`videos.json  ${v.total} 条 | ${v.date_min} ~ ${v.date_max}`);
  console.log(`  口径 v2      ${v.v2}`);
  console.log(`  口径 v1      ${v.v1}`);
  console.log(`  partial      ${v.partial}   <- 半截数据（最危险）`);
  console.log(`  invalid      ${v.invalid}`);
  console.log(`  原文存档     ${v.transcript_archived} 条（文件 ${v.transcript_files} 个）`
    + ` | 源内字幕引用字段 ${v.subtitle_ref_in_source} 条`);
  console.log(`  ★ 全量重跑缺口 ${v.rerun_gap} 条`);
  console.log(`views-lite.json ${lt.total} 条 | v2 ${lt.v2} / v1 ${lt.v1}`
    + ` / partial ${lt.partial} / invalid ${lt.invalid}`);
  console.log(`  与源对齐     ${mismatches.length} 处不一致`);
  console.log(`字段契约：字面 ${LITERAL_FIELDS.length} / 推断 ${INFERENCE_FIELDS.length}`
    + ` / 推荐给 T+20 ${RECOMMENDED_FOR_T20.length} / lite 可用 ${LITE_LITERAL_FIELDS.length}`);
  console.log('  --json 输出完整契约（下游 T+20 脚本请以此为准）');
  console.log(`规则版本   ${s.current} | 内容指纹 ${s.content_fingerprint}`);
  console.log(`冻结状态   ${s.frozen.ok ? 'OK（与基线一致，可重跑）'
    : 'FAIL: ' + s.frozen.reason}`);
  console.log(`  videos 带版本：当前 ${s.videos.current} / 未标记 ${s.videos.unversioned}`
    + ` / 陈旧 ${s.videos.stale}`);
  console.log(`  lite   带版本：当前 ${s.lite.current} / 未标记 ${s.lite.unversioned}`
    + ` / 陈旧 ${s.lite.stale}`);
  if (gateFailed) {
    console.log('  ⇒ --assert-frozen 闸门失败：重跑前必须先处理规则漂移');
  }
  if (v.v1 > 0 && v.v2 > 0) {
    console.log(`结论：数据自洽，但处于新旧口径混用状态（v1 ${v.v1} 条）。`
      + '混合本身不算失败，迁移完成后应归零。');
  } else {
    console.log('结论：数据自洽，口径已统一。');
  }
  process.exit(dirty || gateFailed ? 1 : 0);
}

main();
