/**
 * 李大霄视频分析的**唯一**提示词来源。
 *
 * 为什么单独抽出来：`analyze-video.js`（线上）和 `test-ai.js`（本地验证）原本各抄了一份
 * 几乎相同的提示词。改一处、漏一处，就会出现"本地测出来正常、线上仍是旧口径"的情况，
 * 而这类偏差在数据里看不出来（JSON 结构完全一样）。现在两边都从这里取。
 *
 * ★ 2026-11-07 重写。旧版开头是：
 *     "李大霄…不能明面唱空，不能明面直接给出投资建议。你要挖掘他想表达的真正意思"
 *   这句话会**系统性地污染全部输出**，三个原因：
 *
 *   ① 前提事实错误。李大霄是 A 股最知名的**死多头**——"钻石底""婴儿底""地球顶"都是他喊的。
 *      他不是"被逼不能说空"，而是一贯看多。用"被压抑的真实意图"这套框架去读一个公开多头，
 *      结果必然是把中性内容读成看空。
 *   ② 强制产出方向。旧版 `operation_advice` 写的是"提炼弦外之音，明确多空态度"，
 *      `hidden_meanings` 又要求每条表面表述都配一个"深层含义"。模型不会输出"这段没表态"，
 *      它会造一个方向、造 N 条潜意识——原文有几条观点，就编出几条深层含义。
 *   ③ 缺市场维度。旧版没有要求标注 A 股 / 美股 / 港股。于是同一个 `sentiment_score`
 *      在不同日期量的是**不同市场**：11-05 讲 A 股政策底打 70，11-06 讲美股债务上限打 20，
 *      看起来"反复无常"，实际是字段没区分对象。这直接污染了下游"某表态后 T+20 收益"的统计
 *      （统计文本还拼了 operation_advice / risk_tips / final_conclusion 三个**模型推断**字段）。
 *
 *   新原则：**字面是主干，推断是可选附件，且推断必须挂原话引用。**
 *
 * ★ 同日第二版：黑话（固定表述）改为**词表驱动**，见 scripts/lexicon.json。
 *   为什么不在提示词里写死结论：上一版这里硬编码过一句"他说'外围市场'时指的不是 A 股"，
 *   这是在提示词里塞领域判断 —— 既不可追溯（谁说的？依据哪条视频？），
 *   也无法被推翻（改结论要改代码）。现在改成数据：词表里每条都必须挂原话引用和核验状态，
 *   有争议的写法进 `disputed` 字段并列共存，改词表比重跑数据便宜得多。
 *   ⚠️ 词表只解决"这个词指向哪个市场"，**不允许**做"他说的 A 其实是 B"的反转 ——
 *   那等于把上一版的猜测从模型手里挪到人手里，误差一样会被固化。
 *
 * 下游字段依赖（改这里之前先看）：
 *   · build-views-lite.js  → 取 sentiment_score / structured.operation_advice / final_conclusion
 *   · src/stores/analysis.ts、src/utils/sentiment.ts → 按 sentiment_score 分 6 档渲染
 *   · schema.sql / sync-to-d1.js → 只落 sentiment_score + structured(JSON) 整包
 *   ⇒ 因此 `operation_advice` 必须继续输出（作为 advice_literal 的等值兼容字段）。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const LEXICON_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'lexicon.json'
);

let _lexiconCache = null;

/** 读取黑话词表。缺失/损坏时降级为空词表 —— 绝不能因为这个文件让整条流水线挂掉。 */
function loadLexicon() {
  if (_lexiconCache !== null) return _lexiconCache;
  try {
    _lexiconCache = JSON.parse(fs.readFileSync(LEXICON_PATH, 'utf-8'));
  } catch (e) {
    console.warn('[lexicon] 词表读取失败，按空词表处理:', e?.message || e);
    _lexiconCache = { terms: [], model_fabricated: [] };
  }
  return _lexiconCache;
}

/** 把词表渲染成提示词章节。空词表返回 ''，调用方据此不插入该段。 */
function buildLexiconSection() {
  const lex = loadLexicon();
  const terms = Array.isArray(lex.terms) ? lex.terms : [];
  if (!terms.length) return '';

  const lines = [
    '════════ 二、固定表述（黑话）：按词表判定指向，不要自由联想 ════════',
    '下面这批词他有固定用法，遇到时按 resolution 判定它指向哪个市场 / 属于哪类表述，',
    '并在 code_words 字段里留痕（字面 + 引用 + 指向三者都记）。',
    '严格限制：词表**只解决指向**，不解决反转。任何词都不得当成"他其实想说反话"的依据。',
    '',
  ];

  for (const t of terms) {
    lines.push(`· 「${t.term}」${t.literal ? `= ${t.literal}` : ''}`);
    if (t.resolution) lines.push(`   判定：${t.resolution}`);
    if (t.a_share_effect) lines.push(`   对 A 股：${t.a_share_effect}`);
    if (t.exception) lines.push(`   例外：${t.exception}`);
    if (t.clarification) lines.push(`   注意：${t.clarification}`);

    // 有规则就按规则渲染（命中即停），比一句结论可执行得多
    const rules = Array.isArray(t.resolution_rules) ? t.resolution_rules : [];
    if (rules.length) {
      lines.push('   按优先级从上到下匹配，命中即停：');
      for (const r of [...rules].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))) {
        lines.push(`     ${r.priority}. ${r.when}`);
        lines.push(`        ⇒ market 记 ${r.market}；market_literal 记 ${r.market_literal || r.market}`
          + `（置信 ${r.confidence ?? '—'}${r.status ? `，状态 ${r.status}` : ''}）`);
      }
    }

    const evs = (t.evidence || []).filter((e) => e?.quote && e.date !== '历史').slice(0, 3);
    for (const ev of evs) lines.push(`   他本人原话（${ev.date}）：「${ev.quote}」`);
  }

  const fabricated = Array.isArray(lex.model_fabricated) ? lex.model_fabricated : [];
  if (fabricated.length) {
    lines.push('');
    lines.push('以下词是模型 / 媒体用词，**不是他的原话**。禁止写进 core_views / advice_literal / quote / signals / summary：');
    for (const f of fabricated) lines.push(`· ${f.term}（${f.note}）`);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * ★ 提示词**语义版本**：只有改「判据 / 输出结构 / 计分口径」时才递增。
 *
 * 为什么必须显式维护、而不是对文件取 hash：
 *   全量重跑 522 条要花几十小时，若期间有人改了一个注释就换版本号，
 *   数据里的 `schema_version` 会全部判成陈旧 ⇒ 白重跑。
 *   反过来，改了判据却忘了递增版本号，会产生**字段集合完全相同、
 *   但值口径已变**的第三版数据 —— audit 的组合指纹抓不到，最危险。
 *   ⇒ 语义版本（人维护，写进数据） + 内容指纹（自动，检测任何文件改动）两者分工：
 *     内容指纹变了但语义版本没变 ⇒ 强制人工确认（改的是注释还是判据）。
 *
 * 递增规则：改 `buildAnalysisPrompt()` 的判据/输出字段 → 末位 +1；
 *   改 `lexicon.json` 的规则 → 递增该文件的 `version`，本常量可不动。
 */
export const PROMPT_VERSION = '2026-11-07.1';

export const ANALYSIS_SYSTEM_PROMPT =
  '你是严谨的财经转写文本核对员。必须输出完整 JSON、不省略任何字段；'
  + '但字段内容必须忠于原文：没有依据就写「原文未提及」或空数组 []，'
  + '禁止为了填满字段而编造推断或动机。';

/**
 * 构造分析提示词。
 * @param {object} p
 * @param {string} p.text       语音转录全文
 * @param {string} p.date       "YYYY-MM-DD HH:MM"
 * @param {string} [p.bvid]
 * @param {string} [p.knownTitle]
 * @returns {string}
 */
export function buildAnalysisPrompt({ text, date, bvid = '', knownTitle = '' }) {
  return `你的角色是**文本核对员 + 结构化转录员**，不是"话术侦探"，不是"动机猜测者"。
输入是李大霄（B站/抖音财经创作者）一条视频的语音转录稿。口语转写，可能有错别字和同音字，可自行纠正后理解。

════════ 一、硬约束（违反即视为无效输出）════════
1. 只记录他**明说**了什么。不要假设"他有话不敢直说"，也不要假设他想唱空或想唱多。
   背景知识：李大霄长期是公开的乐观派（"钻石底""婴儿底"等表述均出自他）。
   但这条**只用于避免你把他读反**，不能作为任何解读的依据。
2. 所有"解读/推断/潜台词"类内容，必须能引用到原文：给出 quote（尽量连续 ≥8 字的原话）。
   引不出原话 ⇒ 这条不写。整个字段都没有可引用内容 ⇒ 写「原文未提及」或空数组 []。
3. 禁止下列推理方式，一律不得产出：
   「他是公众人物，所以话里有话」
   「他要顾忌百万粉丝，所以真实意思是反向的」
   「他反复强调免责，说明他其实在看空」
4. 原文没有明确表态 ⇒ 写「未表态」。不得用"谨慎""中性偏空"之类的词把沉默包装成态度。
5. 数字照抄原文原值，不换算、不补全、不四舍五入、不虚构。
   原文数据本身可能有误——照抄，并在 data_analysis.caveats 里标注"原文如此，待核实"。

${buildLexiconSection()}════════ 三、判定这条在讲哪个市场（缺这一步，情绪分无法跨条比较）════════
market 取值仅限：'a_share' | 'us' | 'hk' | 'other' | 'mixed' | 'unstated'
判定依据是**原文明确提到的市场 / 指数 / 资产名**，不是标题，也不是话题联想：
  · 沪深300 / 上证 / 创业板 / A股 / 蓝筹                                      → a_share
  · 纳斯达克 / 标普 / 美联储 / 美债 / 美元 / 外围市场（见上节固定表述）         → us
  · 恒生 / 恒科 / 港股                                                        → hk
  · 日经 / 韩国 / 印度 / 欧洲 / 黄金 / 原油（且未与上面市场绑定）               → other
  · 同时讲两个及以上市场且分量相当                                             → mixed（必须逐个市场分别打分）
  · 全文找不到明确市场指向                                                     → unstated
遇到词表里的固定表述，先按词表的 resolution_rules **从上到下匹配、命中即停**，再判 market；
判不出就用 unstated，并在 code_words 里写清"指向不明"，**不要靠猜**。
★ 必须同时输出两个市场字段，不要合并：
  market         = 应用词表规则后的**实际**指向（他到底在讲哪个市场）
  market_literal = **只看字面**、不套词表规则时提到的市场
  两者不一致，说明这条用了免责挡箭牌 —— 这是需要留痕的正常情况，不是错误。
market_evidence：触发该判定的原话片段数组（可为空）。

════════ 四、情绪分必须按锚点算，不许凭感觉 ════════
对 market 涉及的**每个市场单独打分**，写进 sentiment_by_market（只写原文讲到、且有明确表态的市场）：
  · 基准 50 = 该市场段落只有事实陈述 / 数据播报 / 转述他人观点，没有他本人的判断
  · 每一条明确看多表述 +10；每一条明确看空表述 −10；单市场累计修正上限 ±30
  · 强度修正：出现"历史大底 / 反转 / 暴涨 / 崩盘"等强词 → 该条按 ±5 计（不叠加 ±10）
              出现"警惕 / 谨慎 / 回调 / 注意"等弱词 → 该条按 ±3 计
  · 逐条累加后夹取到 [0,100]
  · basis 必须写清：用了几条看多、几条看空、分别是哪些原话（可简写）
  · quote 给 1-2 句最能代表该分数的原话
某市场原文**没有明确多空表述** ⇒ 该市场不出现（不打分），direction 记「未表态」。
⚠️ 词表里标为「情绪安抚」「反讽」的表述（如"星星之火也能温暖""怒涨"）不是多空表述，
   不得计分，只能记进 strategy。

顶层 sentiment_score（兼容旧字段）：取 sentiment_by_market[market].score；
market 为 'unstated'，或该主市场未表态 ⇒ 一律填 50。
sentiment_note 必须始终填写：这个分数是怎么算出来的。

════════ 五、输出格式（严格 JSON，字段一个不缺；值可以是「原文未提及」/ [] / null）════════
{
  "_id": \`lishaoxiao_${date.replace(/-/g, '')}\`,
  "id": \`${bvid}\`,
  "bvid": \`${bvid}\`,
  "title": \`${knownTitle}\`,
  "date": \`${date}\`,

  "market": "取值 'a_share'|'us'|'hk'|'other'|'mixed'|'unstated'；**应用词表规则后**的实际指向",
  "market_literal": "取值同上；**只看字面**提到的市场，不套词表规则",
  "market_evidence": ["string数组", "原文中触发市场判定的原话片段"],
  "disclaimer_stacking": "integer，本条切割语的堆叠次数（『外围市场』重复次数 + 元话语次数 + 小说/书上内容次数）",
  "direction": "取值 '看多'|'看空'|'中性'|'未表态'",
  "direction_quote": ["string数组", "支撑该方向的原话；未表态则 []"],
  "confidence": "float 0-1，你对该条解读的可信度自评：原文说得越明确、数据越具体越高；只能靠推测填充的越低",

  "code_words": [
    {
      "term": "命中的固定表述（应来自词表；原文里的其他固定说法也可）",
      "quote": "该表述的原话片段",
      "resolved_market": "该表述在本条指向的市场；不涉及市场则写'不涉及'；判不出写'指向不明'",
      "note": "可选：为什么这样判定"
    }
  ],

  "sentiment_score": "integer 0-100，= sentiment_by_market[market].score；未表态一律 50",
  "sentiment_note": "string, 该分数的计分过程（几条看多 / 几条看空 / 依据哪几句）",
  "sentiment_by_market": {
    "★说明": "只写原文讲到、且有明确多空表态的市场；没讲到的市场不要出现对应键；全都没表态就给 {}",
    "a_share": { "score": "integer 0-100", "basis": "string, 计分依据", "quote": ["string数组", "代表原话"] }
  },

  "disclaimer_level": "integer 1-5，按『切割语堆叠』计分：1=全程无免责；2=单次出现'仅供参考 / 不构成投资建议'；3=单次提到'外围市场 / 不针对 A 股'；4=出现元话语（'再重复一次''我再说一遍'）或同段重复 ≥2 次；5=多层马甲（小说/书上的内容 → 美股 → 外围市场），或明确声明'我说的不是现实市场'。",
  "disclaimer_note": "string, disclaimer_level 的计分依据，需引用原话；无免责表述写「原文未提及」",

  "summary": "string, 200 字以内，只包含原文有依据的内容",
  "tags": ["string数组", "8 个以内关键词标签"],

  "structured": {
    "core_views": ["string数组", "逐条列出原文中明确说出的观点 / 数据，每条带具体数字；不要补充他没说的推论"],
    "sectors": ["string数组", "原文明确点名的行业板块；没点名则 []"],
    "advice_literal": "string, 他明说的操作 / 态度要点，尽量保留原词（如词表里的『余钱投资、理性投资、做个好人』应原样收录）；只说免责或没提操作 ⇒ 「原文未提及」",
    "advice_inference": "string|null, 可选。仅在能引用原话时给出，且必须以「依据：『原话』」开头；无依据填 null",
    "operation_advice": "string, 字段兼容用：必须与 advice_literal 内容完全一致（无则同写「原文未提及」）",
    "risk_tips": ["string数组", "他明确提到的风险，每条独立成句。他没提但客观存在的风险，写进 deep_analysis.data_analysis.caveats"]
  },

  "deep_analysis": {
    "strategy": "string, 论证结构描述（用了什么类比 / 数据 / 反问 / 反讽），只描述可观察的文本特征，不猜动机",
    "hidden_meanings": [
      {
        "surface": "string, 原文表述",
        "deep": "string, 可选解读：须说明是从哪句话推出来的，不得引入原文之外的背景假设",
        "quote": "string, 必须逐字出自原文"
      }
    ],
    "logic_pieces": [
      {
        "title": "string, 逻辑链条名称，如'负利率历史类比'、'估值分化论'",
        "content": "string, 完整推理过程，用箭头→连接"
      }
    ],
    "data_analysis": {
      "points": ["string数组", "原文所有具体数据，带单位和涨跌幅，照抄"],
      "subtext": "string, 可选：数据呈现什么特征；必须引用原话支撑，否则「原文未提及」",
      "caveats": ["string数组", "原文数据可能出错 / 口径不明 / 需要核实之处；没有则 []"]
    },
    "signals": ["string数组", "只写原文明确表达的信号，格式'信号名称：具体内容'；没有则 []"],
    "final_conclusion": "string, 300 字以内，分三部分写：(1) 他明说了什么 (2) 原文未表态的部分 (3) 本条适用的市场"
  },

  "hit_status": "string, 固定值'pending'",

  "logic_factors": [
    {
      "factor_name": "string, 因子名称，如'全球高位'、'业绩分化'",
      "factor_value": "string, 因子具体数值或状态描述（原文数字优先）",
      "weight": "float 0-1, 该因子在他这段论述中的分量（按篇幅 / 强调次数估）",
      "direction": "取值仅限：'看涨'/'看跌'/'中性偏多'/'中性偏空'/'中性'/'未表态'",
      "description": "string, 该因子对市场的具体影响逻辑",
      "quote": "string, 支撑该因子的原话片段；给不出则 direction 必须写'未表态'"
    }
  ]
}

════════ 六、填写底线（自检）════════
· hidden_meanings 允许为 []。宁可空着，也不要用"他其实想说…"凑条数。
· 任何方向性字段（direction / sentiment_* / logic_factors[].direction / advice_*）
  都必须在原文找得到依据；找不到就写「未表态」/ 50 / null。
· 禁止出现"弦外之音""他真正的意思是""暗示了他其实…"这类句式。
· 禁止把词表标为"模型/媒体用词"的词写进任何引述字段。
· 先判市场、先按词表定指向，再下方向结论。

文本内容：
${text}`;
}
