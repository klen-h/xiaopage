/**
 * 文本处理小工具
 */

/**
 * 按字节截断字符串（中文 1 字 = 3 字节），超长时追加截断提示
 * 用于企业微信 markdown 消息（上限 4096 字节）
 * @param {string} str
 * @param {number} maxBytes
 * @param {string} [suffix]
 */
export function truncateByBytes(str, maxBytes, suffix = '\n\n…（内容过长已截断）') {
  if (!str) return '';
  if (Buffer.byteLength(str, 'utf-8') <= maxBytes) return str;

  const budget = maxBytes - Buffer.byteLength(suffix, 'utf-8');
  if (budget <= 0) return suffix.trim();

  let out = '';
  let used = 0;
  // 用 for...of 按码点遍历，避免把 emoji / 生僻字截成乱码
  for (const ch of str) {
    const size = Buffer.byteLength(ch, 'utf-8');
    if (used + size > budget) break;
    out += ch;
    used += size;
  }
  return out + suffix;
}
