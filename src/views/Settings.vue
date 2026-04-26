<script setup lang="ts">
import { ref } from 'vue'
import { 
  Bell, 
  Database, 
  // Shield, 
  Smartphone, 
  Mail, 
  // Globe, 
  // ChevronRight,
  // User,
  Zap,
  CheckCircle,
  AlertCircle
} from 'lucide-vue-next'

const notifications = ref({
  email: true,
  push: false,
  wechat: true,
  high_priority: true
})

const dataSources = ref([
  { id: 'bilibili', name: 'Bilibili', status: 'connected', last_sync: '10 mins ago', icon: 'https://www.bilibili.com/favicon.ico' },
  { id: 'douyin', name: '抖音', status: 'connected', last_sync: '2 hours ago', icon: 'https://www.douyin.com/favicon.ico' },
  { id: 'weibo', name: '微博视频', status: 'disconnected', last_sync: 'Never', icon: 'https://weibo.com/favicon.ico' },
])

const aiModel = ref('gpt-4-turbo')
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
    <!-- User Profile Card -->
    <div class="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex items-center justify-between">
      <div class="flex items-center space-x-6">
        <div class="w-20 h-20 rounded-2xl bg-primary-100 flex items-center justify-center text-primary-600 text-3xl font-bold shadow-inner">
          用
        </div>
        <div>
          <h2 class="text-2xl font-bold text-gray-900">演示用户</h2>
          <p class="text-gray-500 mt-1">演示版本 - 权限：系统管理员</p>
          <div class="mt-2 flex items-center space-x-2">
            <span class="px-2 py-0.5 bg-green-50 text-green-600 text-[10px] font-bold rounded uppercase border border-green-100">已认证</span>
            <span class="px-2 py-0.5 bg-primary-50 text-primary-600 text-[10px] font-bold rounded uppercase border border-primary-100">VIP 账户</span>
          </div>
        </div>
      </div>
      <button class="px-6 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-sm font-bold transition-all border border-gray-200">
        编辑资料
      </button>
    </div>

    <!-- Main Settings Sections -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <!-- Notification Config -->
      <section class="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col">
        <div class="flex items-center space-x-3 mb-8">
          <div class="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600">
            <Bell class="w-5 h-5" />
          </div>
          <h3 class="text-xl font-bold text-gray-900">通知提醒设置</h3>
        </div>
        <div class="space-y-6 flex-1">
          <div v-for="(_, key) in notifications" :key="key" class="flex items-center justify-between group">
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors">
                <component :is="key === 'email' ? Mail : key === 'push' ? Smartphone : key === 'wechat' ? Zap : Bell" class="w-4 h-4" />
              </div>
              <span class="text-sm font-medium text-gray-700 capitalize">{{ key.replace('_', ' ') }}</span>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="notifications[key]" class="sr-only peer">
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>
        </div>
      </section>

      <!-- Data Sources -->
      <section class="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 flex flex-col">
        <div class="flex items-center space-x-3 mb-8">
          <div class="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
            <Database class="w-5 h-5" />
          </div>
          <h3 class="text-xl font-bold text-gray-900">数据源配置</h3>
        </div>
        <div class="space-y-4 flex-1">
          <div v-for="source in dataSources" :key="source.id" class="p-4 rounded-2xl border border-gray-100 bg-gray-50/50 flex items-center justify-between hover:bg-white hover:shadow-md transition-all group">
            <div class="flex items-center space-x-4">
              <div class="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm border border-gray-100 overflow-hidden">
                <img :src="source.icon" class="w-6 h-6 grayscale group-hover:grayscale-0 transition-all" />
              </div>
              <div>
                <p class="text-sm font-bold text-gray-800">{{ source.name }}</p>
                <p class="text-[10px] text-gray-400">上次同步: {{ source.last_sync }}</p>
              </div>
            </div>
            <div class="flex items-center space-x-2">
              <span :class="['w-2 h-2 rounded-full', source.status === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500']"></span>
              <span :class="['text-[10px] font-bold uppercase tracking-widest', source.status === 'connected' ? 'text-green-600' : 'text-red-600']">{{ source.status }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Data Input Specification (New) -->
    <section class="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
      <div class="flex items-center space-x-3 mb-8">
        <div class="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
          <BookOpen class="w-5 h-5" />
        </div>
        <h3 class="text-xl font-bold text-gray-900">视频解析录入规范</h3>
      </div>
      <div class="prose prose-sm max-w-none text-gray-600">
        <p class="mb-4 font-medium">为了确保您的深度洞察能被准确识别并完美渲染，请提供以下 JSON 格式的 AnalysisItem 数据：</p>
        <div class="bg-gray-900 rounded-2xl p-6 overflow-x-auto">
          <pre class="text-primary-300 text-xs leading-relaxed">
{
  "id": "unique_id",
  "title": "视频标题",
  "date": "2026-04-04",
  "sentiment": "悲观/中性/乐观",
  "sentiment_score": 50,
  "disclaimer_level": 3,
  "summary": "一句话核心总结",
  "tags": ["标签1", "标签2"],
  "structured": {
    "core_views": ["观点1", "观点2"],
    "sectors": ["板块1", "板块2"],
    "operation_advice": "操作建议",
    "risk_tips": ["风险点1"]
  },
  "deep_analysis": {
    "strategy": "核心博弈框架说明",
    "hidden_meanings": [
      {
        "surface": "字面意思",
        "deep": "深层意图",
        "quote": "原句（可选）"
      }
    ],
    "logic_pieces": [
      { "title": "零件1标题", "content": "零件1内容" }
    ],
    "data_analysis": {
      "points": ["具体数据1", "数据2"],
      "subtext": "数据潜台词说明"
    },
    "signals": ["信号1", "信号2"],
    "final_conclusion": "最终去包装结论"
  }
}
          </pre>
        </div>
      </div>
    </section>

    <!-- AI Model Selection -->
    <section class="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
      <div class="flex items-center space-x-3 mb-8">
        <div class="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
          <Zap class="w-5 h-5" />
        </div>
        <h3 class="text-xl font-bold text-gray-900">AI 模型与分析引擎</h3>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button 
          v-for="model in [
            { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', desc: '最强解析力 (推荐)' },
            { id: 'claude-3-opus', name: 'Claude 3 Opus', desc: '长文本理解专家' },
            { id: 'gemini-pro', name: 'Gemini 1.5 Pro', desc: '快速语义提取' }
          ]" 
          :key="model.id"
          @click="aiModel = model.id"
          :class="[
            'p-6 rounded-2xl border-2 text-left transition-all',
            aiModel === model.id 
              ? 'border-primary-600 bg-primary-50 ring-4 ring-primary-500/10' 
              : 'border-gray-100 bg-gray-50 hover:border-gray-200'
          ]"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="font-bold text-gray-900">{{ model.name }}</span>
            <CheckCircle v-if="aiModel === model.id" class="w-5 h-5 text-primary-600" />
          </div>
          <p class="text-xs text-gray-500 leading-relaxed">{{ model.desc }}</p>
        </button>
      </div>
      <div class="mt-8 p-6 bg-purple-50 rounded-2xl border border-purple-100 flex items-start space-x-4">
        <AlertCircle class="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
        <div class="text-sm text-purple-800 leading-relaxed">
          <p class="font-bold mb-1">提示：</p>
          解析引擎默认使用 GPT-4 进行深层语义分析。如需切换模型，请确保相应的 API Key 已正确配置在环境变量中。
        </div>
      </div>
    </section>
  </div>
</template>
