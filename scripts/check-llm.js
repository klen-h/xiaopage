/**
 * LLM 连通性诊断（本地 & GitHub Actions 通用）
 *
 * 用法：
 *   node scripts/check-llm.js
 *
 * 会依次检查：
 *   1. LLM_API_KEY / LLM_BASE_URL / LLM_MODEL 是否已配置
 *   2. GET {BASE}/models 是否可达、配置的模型是否在列表中
 *   3. POST {BASE}/chat/completions 最小请求是否成功
 *
 * 退出码非 0 表示不可用。
 */

import 'dotenv/config';
import { CHAT_URL, MODELS_URL, checkLLMHealth, listModels, LLM_MODEL, LLM_FALLBACK_MODELS } from './utils/llm.js';

console.log('=== LLM 连通性诊断 ===');
console.log('chat endpoint:', CHAT_URL);
console.log('models endpoint:', MODELS_URL);
if (LLM_FALLBACK_MODELS.length) console.log('备选模型:', LLM_FALLBACK_MODELS.join(', '));
console.log('');

// 单独列出可用模型，方便挑选新的 LLM_MODEL
try {
  const models = await listModels();
  if (models.length) {
    console.log(`可用模型(${models.length}个):`);
    models.forEach(m => console.log('  -', m));
    console.log('');
    if (!models.includes(LLM_MODEL)) {
      console.warn(`⚠️ 当前 LLM_MODEL=${LLM_MODEL} 不在列表中，请改成上面任意一个，或设置 LLM_FALLBACK_MODELS`);
    }
  } else {
    console.warn('⚠️ /models 接口无数据或不可达，跳过模型名校验');
  }
} catch {
  console.warn('⚠️ /models 请求失败，跳过模型名校验');
}

try {
  await checkLLMHealth();
  console.log('\n🎉 诊断通过，可以正常调用 LLM');
} catch (error) {
  console.error('\n❌ 诊断失败:', error.message);
  process.exit(1);
}
