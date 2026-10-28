/**
 * 生成「外部消费用」的精简解读文件：public/data/views-lite.json
 *
 * 【为什么要做】
 *   `videos.json` 是本站自己的完整数据源（含 `deep_analysis` 全文 / `logic_factors` 全量），
 *   实测 484 条 = **6.10MB**，其中：
 *     deep_analysis  3367.6KB (55%)
 *     logic_factors   885.3KB (14.5%)
 *     structured      831.3KB (13.6%)
 *   stock-scoring 工作台只消费其中很小一部分（卡片文案 final_conclusion、情绪分、
 *   板块、操作建议、3 条因子），却要为此下载 6.4MB —— 国内网络实测 59 秒，
 *   还占 Render 出网流量。
 *   ⇒ 另出一份**只含消费侧字段 + 只留最近 N 条**的 lite 文件（约 150KB，降 97%）。
 *
 * 【纪律】
 *   · **不改** `videos.json`（本站页面用它渲染完整分析，裁剪会丢功能）；
 *   · lite 是**派生文件**，任何时候可由本脚本从 `videos.json` 重建（幂等）；
 *   · 字段裁剪口径必须与消费方 `stock-scoring/backend/app/lidaxiao_views.py::_slim` 对齐，
 *     多留字段 = 白传流量，少留字段 = 消费方拿到空值。
 *
 * 用法：
 *   node scripts/build-views-lite.js              # 默认 keep=60
 *   node scripts/build-views-lite.js --keep 30
 */
import fs from 'fs';
import path from 'path';

const SRC = path.resolve('public/data/videos.json');
const DST = path.resolve('public/data/views-lite.json');
const DEFAULT_KEEP = 60;

/** 单条 → 消费侧最小集（对齐 stock-scoring `_slim`）。 */
function lite(e) {
  const st = e.structured && typeof e.structured === 'object' ? e.structured : {};
  const da = e.deep_analysis && typeof e.deep_analysis === 'object' ? e.deep_analysis : {};
  const arr = (v, n) => (Array.isArray(v) ? v.slice(0, n) : []);
  const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : (v || ''));
  return {
    _id: e._id ?? null,
    bvid: e.bvid ?? null,
    title: str(e.title, 200),
    date: e.date ?? '',
    sentiment_score: e.sentiment_score ?? null,
    disclaimer_level: e.disclaimer_level ?? null,
    // ↓ 消费方入库但卡面不渲染（摘要仍有用：日报/折叠区取它）
    summary: str(e.summary, 300),
    tags: arr(e.tags, 10),
    structured: {
      core_views: arr(st.core_views, 3),
      sectors: arr(st.sectors, 10),
      operation_advice: str(st.operation_advice, 200),
      risk_tips: arr(st.risk_tips, 3),
    },
    // ★ 只留一句结论（原文 6.96KB/条 的 deep_analysis 是体积大头）
    deep_analysis: { final_conclusion: str(da.final_conclusion, 300) },
    // ★ 3 条因子，且只留消费方入库的三个字段（去掉 factor_value / description）
    logic_factors: (Array.isArray(e.logic_factors) ? e.logic_factors : [])
      .slice(0, 3)
      .map((f) => ({
        factor_name: f?.factor_name ?? '',
        weight: f?.weight ?? null,
        direction: f?.direction ?? '',
      })),
    hit_status: e.hit_status ?? null,
  };
}

export function buildViewsLite({ src = SRC, dst = DST, keep = DEFAULT_KEEP } = {}) {
  if (!fs.existsSync(src)) {
    console.error(`[views-lite] 源文件不存在: ${src}`);
    return null;
  }
  const data = JSON.parse(fs.readFileSync(src, 'utf-8'));
  if (!Array.isArray(data)) {
    console.error('[views-lite] 源文件不是数组');
    return null;
  }
  // videos.json 已是"新的在前"（unshift 写入）⇒ 直接取前 keep 条
  const picked = data.slice(0, Math.max(1, keep)).map(lite);
  // 无缩进：这是**机器读**的文件（站点页面用 videos.json），缩进只白占 ~10% 体积；
  // 需要人看时 `node -e "JSON.stringify(require(...),null,2)"` 即可。
  fs.writeFileSync(dst, JSON.stringify(picked), 'utf-8');

  const srcKb = fs.statSync(src).size / 1024;
  const dstKb = fs.statSync(dst).size / 1024;
  const pct = srcKb > 0 ? ((1 - dstKb / srcKb) * 100).toFixed(1) : '0';
  console.log(`[views-lite] ${data.length} 条 → 取前 ${picked.length} 条；`
    + `${srcKb.toFixed(0)}KB → ${dstKb.toFixed(1)}KB（-${pct}%）`);
  return { total: data.length, kept: picked.length, srcKb, dstKb };
}

// CLI 直跑（被 import 时不执行）
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('build-views-lite.js')) {
  const i = process.argv.indexOf('--keep');
  const keep = i > 0 ? parseInt(process.argv[i + 1], 10) || DEFAULT_KEEP : DEFAULT_KEEP;
  buildViewsLite({ keep });
}
