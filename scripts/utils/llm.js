/**
 * LLM 统一调用层（OpenAI 兼容接口）
 *
 * 解决的问题：
 * 1. BASE_URL 配置不规范导致 404（末尾多余斜杠、误把 /chat/completions 写进 BASE_URL、漏写协议等）
 * 2. 中转站 / 模型下线导致 404（model not found）时没有可读的诊断信息
 * 3. 免费模型 TPM/RPM 限流（429）需要退避重试
 * 4. 鉴权失败（401/403）时反复重试浪费时间
 *
 * 环境变量：
 *   LLM_API_KEY          必填
 *   LLM_BASE_URL         选填，默认 https://token.sensenova.cn/v1
 *   LLM_MODEL            选填，默认 deepseek-v4-pro
 *   LLM_FALLBACK_MODELS  选填，逗号分隔的备选模型名（主模型 404 / 不可用时依次尝试）
 *   LLM_NO_JSON_FORMAT   设为 1 时不发送 response_format（部分模型不支持 json_object）
 */

import axios from 'axios';

const DEFAULT_BASE_URL = 'https://token.sensenova.cn/v1';
// 注意：中转站的模型会不定期下线/改名。旧值 deepseek-v4-pro 已下线，
// 调用会返回 404 model is not found。故障时用 `node scripts/check-llm.js` 查看实时可用模型。
//
// ★★ 2026-10-29（用户："模型写死在代码里，在 github 配置太麻烦了"）：
//   原默认 `deepseek-v4-flash` 在当前套餐下**不可用**，实测（同一把 key 逐模型）：
//     deepseek-v4-flash        429 Throttling.BurstRate / 也有 insufficient_quota
//     deepseek-flash           429 ModelAccountRpmRateLimitExceeded
//     deepseek-v4.1-flash      403 model is not available in the current token plan
//     kimi-k3                  400 temperature 只允许 1（本文件默认 0.2 会直接失败）
//     glm-5.2                  200 OK   ← 改成这个
//     sensenova-6.8-flash-lite 200 OK   ← 作为备选
//   ⚠️ 免费中转的配额**按模型算，而且每天会变**（10-28 时 glm-5.2 还是 429、deepseek-flash 是 200）
//   ⇒ 不要把某一次实测当永久结论；换模型只改这一行即可（模型名不是密钥，入库安全）。
const DEFAULT_MODEL = 'glm-5.2';
// 内置备选：仅当 LLM_FALLBACK_MODELS / LLM_MODEL 未覆盖时追加到候选链尾。
// 为什么需要：`chat()` 里 429 只会 `break` 到下一个候选，若候选只有 1 个，用完就直接抛错
//   （`AUTO_FALLBACK` 只在 404「模型下线」时触发，**429 不触发**）。
const BUILTIN_FALLBACK_MODELS = ['sensenova-6.8-flash-lite'];
// ★★ 2026-10-30：**已知失效的模型，即便 env/Secrets 里配了也不用**。
//   实测（同一把 key 逐模型）：deepseek-v4-flash 429 / deepseek-v4.1-flash 403。
//   为什么必须替换而不是"排在后面"：Secrets 里的 `LLM_MODEL` 会被当成首选，
//   一个配额耗尽的模型会先吃掉 **30+60+120+240=450 秒** 的退避才轮到下一个
//   （用户日志里就是这样：5 次重试全打在同一个模型上，最后 ECONNRESET）。
//   ⚠️ 与 stock-scoring 的 `_MODEL_KNOWN_DEAD` 保持同一份名单，两处要一起改。
const KNOWN_DEAD_MODELS = ['deepseek-v4-flash', 'deepseek-v4.1-flash'];

/** 规范化 BASE_URL，避免 double slash / 缺协议 / 多写路径导致 404 */
function normalizeBaseUrl(raw) {
  let url = (raw || DEFAULT_BASE_URL).trim().replace(/[\r\n]+/g, '');
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  url = url.replace(/\/+$/, '');
  url = url.replace(/\/chat\/completions$/i, '');
  // history warning: /v1beta etc intentionally kept
  return url;
}

export const LLM_API_KEY = (process.env.LLM_API_KEY || '').trim();
export const LLM_BASE_URL = normalizeBaseUrl(process.env.LLM_BASE_URL);
export const LLM_MODEL = (process.env.LLM_MODEL || DEFAULT_MODEL).trim();
export const LLM_FALLBACK_MODELS = (process.env.LLM_FALLBACK_MODELS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
// 配置的模型失效时，是否自动从该厂商的可用模型里挑一个继续跑（LLM_AUTO_FALLBACK=0 关闭）
const AUTO_FALLBACK = process.env.LLM_AUTO_FALLBACK !== '0';
// 自动兜底时的优先顺序
// ★ 2026-10-29：原顺序把**当前不可用**的模型排在前面（deepseek-v4-flash 429 /
//   deepseek-v4.1-flash 403 / kimi-k3 400 温度限制），等于"兜底兜到坑里"。
//   改为按当日实测可用性排序；注意配额每天变，失效时重跑 `node scripts/check-llm.js`。
const AUTO_FALLBACK_PREFERENCE = ['glm-5.2', 'sensenova-6.8-flash-lite', 'deepseek-flash'];

const NO_JSON_FORMAT = process.env.LLM_NO_JSON_FORMAT === '1';

export const CHAT_URL = `${LLM_BASE_URL}/chat/completions`;
export const MODELS_URL = `${LLM_BASE_URL}/models`;

const authConfig = (timeout) => ({
  headers: {
    'Authorization': `Bearer ${LLM_API_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: timeout ?? 600000
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function maskKey(key) {
  if (!key) return '(未设置)';
  return `${key.slice(0, 6)}***${key.slice(-4)} (长度${key.length})`;
}

/** 打印当前 LLM 配置（密钥做脱敏） */
export function printLLMConfig() {
  console.log('=== LLM 配置 ===');
  console.log('Base URL :', LLM_BASE_URL);
  console.log('Endpoint :', CHAT_URL);
  console.log('Model    :', LLM_MODEL);
  if (LLM_FALLBACK_MODELS.length) console.log('备选模型 :', LLM_FALLBACK_MODELS.join(', '));
  console.log('API Key  :', maskKey(LLM_API_KEY));
  console.log('JSON模式 :', NO_JSON_FORMAT ? '关闭' : '开启');
}

/** 从 axios 错误中提取可读信息 */
export function describeAxiosError(error) {
  const status = error?.response?.status;
  const data = error?.response?.data;
  let body = '';
  if (typeof data === 'string') body = data;
  else if (data) {
    try { body = JSON.stringify(data); } catch { body = String(data); }
  }
  return {
    status,
    code: data?.error?.code || data?.code || '',
    message: data?.error?.message || data?.message || error?.message || '',
    body: String(body).slice(0, 600)
  };
}

function isModelUnavailable(info) {
  if (info.status === 404) return true;
  const text = `${info.code} ${info.message} ${info.body}`.toLowerCase();
  return text.includes('model') && (text.includes('not found') || text.includes('not exist') || text.includes('unknown') || text.includes('invalid') || text.includes('无') || text.includes('不存在'));
}

function isAuthError(info) {
  return info.status === 401 || info.status === 403;
}

function isRateLimited(info) {
  return info.status === 429 || String(info.code || '').includes('429');
}

/**
 * 429 里"等一等就能好"和"等多久都没用"是两回事，必须分开。
 *
 * ★ 2026-10-30（用户日志：连续 5 次 429、退避 450 秒、最后 ECONNRESET）：
 *   `insufficient_quota`（配额耗尽）、`ModelAccountRpmRateLimitExceeded`（账号级）、
 *   `Throttling.BurstRate`（套餐级）这三类**不会因为睡眠而恢复**
 *   ⇒ 继续退避只是把时间烧在同一个死模型上，应当**立刻换下一个候选**。
 *   只有泛化的 `tpm/rpm` 瞬时限流才值得短退避重试。
 */
function isQuotaExhausted(info) {
  const t = `${info.code || ''} ${info.message || ''} ${info.body || ''}`.toLowerCase();
  return t.includes('insufficient_quota')
    || t.includes('rpmratelimitexceeded')
    || t.includes('burst');
}

function isRetryable(info, error) {
  if (isAuthError(info)) return false;
  if (isRateLimited(info)) return true;
  if (info.status >= 500) return true;
  if (!error?.response) return true; // 网络错误 / 超时
  return false;
}

/** 计算退避秒数：优先用服务端 Retry-After，否则指数退避（30s → … → 上限 300s） */
function backoffSeconds(error, attempt) {
  const retryAfter = Number(error?.response?.headers?.['retry-after']);
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter, 600);
  const ms = Number(error?.response?.headers?.['x-ratelimit-reset-ms']);
  if (Number.isFinite(ms) && ms > 0) return Math.min(Math.ceil(ms / 1000), 600);
  return Math.min(30 * 2 ** (attempt - 1), 300);
}

// 全局最小请求间隔：中转免费额度是 TPM/RPM 限制，避免一轮里 5 个视频连环调用触发 429
const MIN_INTERVAL_MS = Number(process.env.LLM_MIN_INTERVAL_MS || 8000);
let lastCallStart = 0;
async function respectMinInterval() {
  const waitMs = lastCallStart + MIN_INTERVAL_MS - Date.now();
  if (waitMs > 0) await sleep(waitMs);
  lastCallStart = Date.now();
}

/**
 * 配置的模型全部失效时，从厂商可用模型里挑出替补（排除 lite 轻量模型）
 */
async function discoverFallbackModels(usedModels) {
  const available = await listModels();
  if (!available.length) return [];
  const used = new Set(usedModels);
  const preferred = AUTO_FALLBACK_PREFERENCE.filter(m => available.includes(m) && !used.has(m));
  const others = available.filter(m => !used.has(m) && !preferred.includes(m) && !/lite|embed|rerank|vision/i.test(m));
  return [...preferred, ...others].slice(0, 3);
}

/**
 * 发送一次 /chat/completions 请求（模型不可用时会依次尝试备选模型）
 * @returns {Promise<object>} OpenAI 格式的响应体
 */
export async function chat(messages, options = {}) {
  const {
    model: primaryModel,
    temperature = 0.2,
    maxTokens = 16384,
    jsonMode = false,
    timeout = 600000,
    maxRetries = Number(process.env.LLM_MAX_RETRIES || 5)
  } = options;

  if (!LLM_API_KEY) {
    throw new Error('缺少 LLM_API_KEY：请在环境变量 / Secrets 中配置 LLM_API_KEY');
  }

  // ★ 2026-10-29：链尾追加内置备选。原实现只有 `[LLM_MODEL, ...LLM_FALLBACK_MODELS]`，
  //   而 `LLM_FALLBACK_MODELS` 默认来自 env（多数环境为空）⇒ 429 时"无模型可切"，
  //   直接抛「所有候选模型均不可用」。内置备选保证至少有一条退路。
  // ★ 2026-10-30：主模型若在 KNOWN_DEAD_MODELS 里，**直接替换**而非排后 ——
  //   否则会先耗掉 450 秒退避才轮到可用模型（用户日志里的实际情况）。
  let primary = primaryModel || LLM_MODEL;
  if (KNOWN_DEAD_MODELS.includes(primary)) {
    console.warn(`⚠️ 主模型 ${primary} 已知不可用（429/403），改用 ${DEFAULT_MODEL}`);
    primary = DEFAULT_MODEL;
  }
  const candidates = [primary, ...LLM_FALLBACK_MODELS,
                      ...BUILTIN_FALLBACK_MODELS].filter(Boolean);
  const seen = new Set();
  const models = candidates.filter(m => !seen.has(m) && seen.add(m));
  let exhaustedIndex = 0; // 已尝试光 candidates 的前 N 个后，才考虑自动兜底

  let lastError = null;

  for (const model of models) {
    exhaustedIndex++;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const body = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens
      };
      if (jsonMode && !NO_JSON_FORMAT) body.response_format = { type: 'json_object' };

      try {
        await respectMinInterval();
        const res = await axios.post(CHAT_URL, body, authConfig(timeout));
        return res.data;
      } catch (error) {
        lastError = error;
        const info = describeAxiosError(error);

        if (isAuthError(info)) {
          throw new Error(`LLM 鉴权失败(${info.status})：${info.message || info.body}。请检查 LLM_API_KEY 是否过期/余额不足`);
        }

        if (isModelUnavailable(info)) {
          console.warn(`⚠️ 模型不可用: ${model} (HTTP ${info.status}) ${info.message || info.body}`);

          // 候选列表全部失效时，自动从厂商当前可用模型里补一个继续跑
          if (AUTO_FALLBACK && exhaustedIndex >= models.length) {
            const extras = await discoverFallbackModels(models);
            if (extras.length) {
              console.warn(`↪️ 自动切换到可用模型: ${extras.join(', ')}`);
              models.push(...extras);
            }
          }
          break; // 换下一个候选模型
        }

        // 限流：退避重试；本模型重试用尽后换下一个候选模型（不同模型额度通常独立）
        // ★ 2026-10-30：**区分"等一等会好"和"等多久都没用"**。
        //   原实现对任何 429 都重试 5 次（30+60+120+240=450 秒），而配额耗尽型
        //   （insufficient_quota / ModelAccountRpmRateLimitExceeded / BurstRate）
        //   睡眠不会带来任何恢复 ⇒ 450 秒纯浪费，最后还是一样的错。
        //   现在：配额耗尽型立即换模型；普通 tpm/rpm 只退避 2 次（30+60=90 秒）。
        if (isRateLimited(info)) {
          const quotaDead = isQuotaExhausted(info);
          const maxAttempts = quotaDead ? 1 : Math.min(maxRetries, 2);
          if (attempt < maxAttempts) {
            const waitSec = backoffSeconds(error, attempt);
            console.warn(`⚠️ LLM 限流(429)，${waitSec}秒后第${attempt + 1}/${maxAttempts}次重试...`);
            await sleep(waitSec * 1000);
            continue;
          }
          console.warn(quotaDead
            ? `⚠️ 模型 ${model} 配额已耗尽（${info.code || 'insufficient_quota'}），立即切换下一个模型`
            : `⚠️ 模型 ${model} 持续限流(429)，切换到其他模型`);
          break;
        }

        if (isRetryable(info, error) && attempt < maxRetries) {
          const waitSec = backoffSeconds(error, attempt);
          console.warn(`⚠️ LLM 请求失败(HTTP ${info.status || 'network'})，${waitSec}秒后第${attempt + 1}次重试...`);
          await sleep(waitSec * 1000);
          continue;
        }

        throw new Error(`LLM 请求失败(HTTP ${info.status ?? 'network'})：${info.message || info.body || error.message}`);
      }
    }
  }

  // 所有候选模型都不可用
  const info = describeAxiosError(lastError);
  let hint = '';
  try {
    const available = await listModels();
    if (available.length) hint = `\n可用模型列表：${available.slice(0, 20).join(', ')}`;
  } catch {
    hint = '\n无法获取 /models 列表，BASE_URL 可能已失效';
  }
  const reason = isRateLimited(info)
    ? '\n原因：所有候选模型都命中 429 限流（通常是免费额度的 TPM/RPM 用尽）。\n' +
      '可尝试：1) 调大 LLM_MIN_INTERVAL_MS（默认 8000ms）降低调用频率；2) 精简单次请求（降低 max_tokens）；3) 升级套餐或换可用的模型/中转。'
    : '\n请检查：1) LLM_BASE_URL 是否为该厂商正确的 OpenAI 兼容地址（通常以 /v1 结尾）；2) LLM_MODEL 是否已下线/改名；3) 中转配额是否过期。';

  throw new Error(
    `所有候选模型均不可用（${models.join(', ')}）。\n` +
    `最后错误：HTTP ${info.status ?? 'network'} ${info.message || info.body}` +
    reason + hint
  );
}

/**
 * 调用 LLM 并解析 JSON 结果（自动剥离 ```json 代码块）
 * @returns {Promise<object|null>}
 */
export async function chatJSON(systemPrompt, userPrompt, options = {}) {
  const data = await chat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    { jsonMode: true, ...options }
  );

  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM 返回内容为空');
  return JSON.parse(cleanJSON(content));
}

/** 剥离模型可能包裹的 markdown 代码块 */
export function cleanJSON(text) {
  let s = String(text).trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) s = s.slice(start, end + 1);
  return s;
}

/** 拉取可用模型列表，失败返回空数组 */
export async function listModels() {
  try {
    const res = await axios.get(MODELS_URL, { ...authConfig(30000) });
    const list = res.data?.data || res.data?.models || [];
    return list.map(m => (typeof m === 'string' ? m : m.id)).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * 连通性自检：给 GitHub Actions 用，失败会抛出可读错误，避免白跑一遍 Whisper 才发现问题
 */
export async function checkLLMHealth() {
  printLLMConfig();

  if (!LLM_API_KEY) {
    throw new Error('缺少 LLM_API_KEY：请在仓库 Secrets 中配置 LLM_API_KEY');
  }

  // 1. 先看 /models 是否可达，用来区分「地址/额度问题」和「模型名问题」
  const models = await listModels();
  if (models.length) {
    console.log(`模型接口可达，共 ${models.length} 个模型`);
    if (!models.includes(LLM_MODEL)) {
      console.warn(`⚠️ 配置的模型「${LLM_MODEL}」不在可用列表中，请求可能返回 404`);
      console.warn(`   前20个可用模型: ${models.slice(0, 20).join(', ')}`);
    }
  } else {
    console.warn(`⚠️ 无法访问 ${MODELS_URL}（部分厂商不开放该接口，将以实际对话请求为准）`);
  }

  // 2. 真实发一条最小请求
  try {
    await chat([{ role: 'user', content: 'ping' }], { maxTokens: 16, timeout: 60000, maxRetries: 1 });
  } catch (error) {
    throw new Error(`${error.message}\n提示：请确认 LLM_BASE_URL 是该厂商正确的 OpenAI 兼容地址（通常以 /v1 结尾，不要带 /chat/completions），且 LLM_MODEL / LLM_API_KEY 未过期。`);
  }
  console.log('✅ LLM 连通性自检通过');
}
