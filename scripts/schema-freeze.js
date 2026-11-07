/**
 * 口径冻结闸门（只读检查 / 显式 --write 才写基线文件）
 *
 * 用法：
 *   node scripts/schema-freeze.js             # 检查规则是否仍与冻结基线一致
 *   node scripts/schema-freeze.js --write     # 生成/更新 scripts/schema-lock.json
 *   node scripts/schema-freeze.js --json      # 机器读：当前版本 + 指纹 + 检查结果
 *
 * ★ 全量重跑（--reanalyze）之前**必须先跑本脚本**：
 *   若规则在冻结后被动过，跑完 522 条也会得到混着新规则的「第三版口径」，
 *   而字段集合完全一样，audit 抓不到 ⇒ 几十小时白烧。
 *
 * 退出码：0 = 已冻结且未漂移；1 = 未冻结 / 已漂移（重跑前必须处理）。
 */
import { currentSchema, readLock, writeLock, checkFrozen,
         LOCK_FILE } from './utils/schema-version.js';

const args = process.argv.slice(2);
const cur = currentSchema();

if (args.includes('--json')) {
  console.log(JSON.stringify({
    current: cur,
    lock: readLock(),
    check: checkFrozen(),
    lock_file: LOCK_FILE,
  }, null, 2));
  process.exit(checkFrozen().ok ? 0 : 1);
}

console.log('=== 口径冻结闸门 ===');
console.log('提示词版本 :', cur.prompt_version);
console.log('词表版本   :', cur.lexicon_version);
console.log('语义版本   :', cur.schema_version, '（写进每条数据的 schema_version）');
console.log('内容指纹   :', cur.content_fingerprint);

if (args.includes('--write')) {
  const data = writeLock();
  console.log('✅ 已写入冻结基线:', LOCK_FILE);
  console.log('   frozen_at =', data.frozen_at);
  console.log('   ⚠️ 此后改动判据/词表 => 本闸门会失败，须全量重跑后重新 --write');
  process.exit(0);
}

const r = checkFrozen();
console.log('基线文件   :', LOCK_FILE);
if (r.ok) {
  console.log('✅', r.reason, '=> 可以开始重跑');
  process.exit(0);
}

console.log('❌', r.reason);
if (r.changed_files.length) {
  console.log('   变动文件:', r.changed_files.join(', '));
}
console.log('   基线版本:', r.lock_schema_version || '(无)');
console.log('   当前版本:', r.current_schema_version);
console.log('   处理：确认规则定稿后跑  node scripts/schema-freeze.js --write');
process.exit(1);
