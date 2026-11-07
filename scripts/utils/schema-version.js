/**
 * 解读口径版本 + 冻结指纹（纯本地：零网络 / 零 LLM / 只读，除 --write 外不写文件）
 *
 * 【为什么要冻结】2026-11-07 全量重跑 522 条的代价是几十小时 + 522 次 LLM 调用。
 *  `lexicon.json` 的 `how_to_update` 明写「改完必须重跑 --reanalyze，因为词表变了
 *  口径就变了」—— 也就是说规则还在迭代。若不先冻结就开跑，中途改一次词表，
 *  就会产出「字段集合完全相同、值口径却不同」的第三版数据，audit 抓不到、也无法追溯。
 *
 * 【两个标识分工】
 *   · schema_version（语义版本，人维护）= PROMPT_VERSION + lexicon.version
 *     ⇒ **写进每条数据**，用于追溯「这条是哪版规则算的」。
 *       只有改判据/输出结构/计分口径才递增，改注释不动它（避免白重跑）。
 *   · content_fingerprint（内容指纹，自动）= 两个规则文件的 SHA256 组合
 *     ⇒ **只做漂移检测**，连注释改动都能发现（保守但不会漏）。
 *       指纹变了而语义版本没变 ⇒ 强制人工确认：改的是注释还是判据？
 *
 * 用法见 scripts/schema-freeze.js。
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { PROMPT_VERSION } from './analysis-prompt.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PROMPT_FILE = path.join(ROOT, 'utils', 'analysis-prompt.js');
export const LEXICON_FILE = path.join(ROOT, 'lexicon.json');
export const LOCK_FILE = path.join(ROOT, 'schema-lock.json');

// 报告里用的相对路径（相对仓库根），便于人读
const LABELS = {
  [PROMPT_FILE]: 'scripts/utils/analysis-prompt.js',
  [LEXICON_FILE]: 'scripts/lexicon.json',
};

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

let _cache = null;

/** 当前规则的版本 + 指纹（进程内缓存一次，避免每条数据都重算 hash）。 */
export function currentSchema() {
  if (_cache) return _cache;
  const lex = JSON.parse(fs.readFileSync(LEXICON_FILE, 'utf-8'));
  const promptSha = sha256(PROMPT_FILE);
  const lexSha = sha256(LEXICON_FILE);
  const lexVersion = String(lex.version || 'unversioned');
  const files = {};
  files[LABELS[PROMPT_FILE]] = { sha256: promptSha };
  files[LABELS[LEXICON_FILE]] = { sha256: lexSha };
  _cache = {
    schema_version: `${PROMPT_VERSION}+${lexVersion}`,
    prompt_version: PROMPT_VERSION,
    lexicon_version: lexVersion,
    content_fingerprint: crypto.createHash('sha256')
      .update(promptSha + lexSha).digest('hex').slice(0, 16),
    files,
  };
  return _cache;
}

export function readLock() {
  if (!fs.existsSync(LOCK_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(LOCK_FILE, 'utf-8'));
  } catch {
    return null;      // 损坏的 lock 等价于「未冻结」，让 --write 重建
  }
}

/** 生成/更新冻结基线。这是本模块唯一写文件的地方。 */
export function writeLock() {
  const cur = currentSchema();
  const data = {
    frozen_at: new Date().toISOString(),
    schema_version: cur.schema_version,
    content_fingerprint: cur.content_fingerprint,
    prompt_version: cur.prompt_version,
    lexicon_version: cur.lexicon_version,
    files: cur.files,
    note: '冻结基线：改判据/输出结构必须递增 PROMPT_VERSION 或 lexicon.version 并全量重跑；'
      + '仅改注释也要重新执行 schema-freeze.js --write 更新指纹。',
  };
  fs.writeFileSync(LOCK_FILE, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  return data;
}

/**
 * 漂移检测（不写任何文件）。
 * @returns {{ok:boolean, reason:string, changed_files:string[], version_changed:boolean,
 *            lock_schema_version?:string, current_schema_version:string}}
 */
export function checkFrozen() {
  const cur = currentSchema();
  const lock = readLock();
  if (!lock) {
    return { ok: false, reason: '未冻结：schema-lock.json 不存在，先跑 --write',
             changed_files: [], version_changed: false,
             current_schema_version: cur.schema_version };
  }
  const changed = [];
  for (const [label, meta] of Object.entries(cur.files)) {
    if (!lock.files || lock.files[label]?.sha256 !== meta.sha256) changed.push(label);
  }
  const versionChanged = lock.schema_version !== cur.schema_version;
  if (!changed.length) {
    return { ok: true, reason: '规则文件与冻结基线一致',
             changed_files: [], version_changed: false,
             lock_schema_version: lock.schema_version,
             current_schema_version: cur.schema_version };
  }
  return {
    ok: false,
    reason: versionChanged
      ? '规则已改版（语义版本变化）⇒ 必须全量重跑后重新冻结'
      : '规则文件有改动但语义版本未递增 ⇒ 请确认改的是注释还是判据，再 --write',
    changed_files: changed,
    version_changed: versionChanged,
    lock_schema_version: lock.schema_version,
    current_schema_version: cur.schema_version,
  };
}

/**
 * 数据侧版本分布（供 audit 验收重跑结果）。
 * 只统计 v2 条目 —— v1 本来就没有 schema_version，把它算成「未标记」没意义。
 * @param {Array} rows 数据条目
 * @param {(e:object)=>boolean} isV2 版本判据（由 audit 传入，避免这里耦合指纹定义）
 * @param {string} currentVersion 当前语义版本
 */
export function versionStats(rows, isV2, currentVersion) {
  const distribution = {};
  let unversioned = 0;
  let stale = 0;
  let current = 0;
  for (const e of rows || []) {
    if (!isV2(e)) continue;
    const v = e && e.schema_version ? String(e.schema_version) : null;
    const k = v || '(none)';
    distribution[k] = (distribution[k] || 0) + 1;
    if (!v) unversioned++;
    else if (v !== currentVersion) stale++;
    else current++;
  }
  return { distribution, unversioned, stale, current };
}

// ── 口径判据的**单一事实源**（audit-views.js / plan-rerun.js 共用） ──────────
// ★ 别在两个脚本里各写一份：一旦漂移，audit 说"已完成"、计划说"待重跑"，
//   全量重跑会反复跑同一批，或漏掉一批，且都静默。
// ★ 组合指纹而非单字段：LLM 偶尔漏输出一个字段，单字段判据会把新口径误判成旧。
export const V2_FINGERPRINT = ['market', 'market_literal', 'sentiment_by_market'];
// lite 是裁剪过的派生文件，字段更少，必须用另一套指纹。
export const LITE_V2_FINGERPRINT = ['market', 'direction'];

/** @returns {'v2'|'v1'|'partial'|'invalid'} */
export function classify(e, fingerprint = V2_FINGERPRINT) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return 'invalid';
  const hit = fingerprint.filter(k => e[k] !== undefined && e[k] !== null).length;
  if (hit === fingerprint.length) return 'v2';
  if (hit === 0) return 'v1';
  return 'partial';
}
