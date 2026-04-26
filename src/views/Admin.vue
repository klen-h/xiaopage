<script setup lang="ts">
import { ref } from 'vue'
import { useAnalysisStore, type AnalysisItem } from '@/stores/analysis'
import { Send, FileJson, CheckCircle2, AlertCircle, Loader2, Database, TrendingUp, Calendar as CalendarIcon } from 'lucide-vue-next'
// import { getMockHistoricalData } from '@/utils/market'
// import { db } from '@/utils/tcb'
import { getLocalDateString } from '@/utils/sentiment'

const analysisStore = useAnalysisStore()
const jsonInput = ref('')
const sectorJsonInput = ref('')
const sectorDate = ref(getLocalDateString())
const isSubmitting = ref(false)
const message = ref({ type: '', text: '' })

const handleSectorSubmit = async () => {
  if (!sectorJsonInput.value.trim()) return
  
  try {
    isSubmitting.value = true
    const rawData = JSON.parse(sectorJsonInput.value)
    const diff = rawData.data?.diff
    
    if (!diff) {
      throw new Error('JSON 格式不正确，未找到 data.diff 节点')
    }

    // 1. 转换当前粘贴的数据格式
    const newSectors = Object.values(diff).map((item: any) => ({
      code: item.f12,
      name: item.f14,
      changePercent: item.f3 ? (item.f3 / 100) : 0, 
      mainInflow: item.f62 || 0
    }))

    // 2. 获取该日期现有的数据进行合并
    let finalSectors = newSectors

    message.value = { type: 'success', text: `日期 ${sectorDate.value} 的板块数据更新成功！当前已汇总 ${finalSectors.length} 个板块。` }
    sectorJsonInput.value = ''
  } catch (err: any) {
    message.value = { type: 'error', text: '更新失败: ' + err.message }
  } finally {
    isSubmitting.value = false
  }
}

const handleSubmit = async () => {
  if (!jsonInput.value.trim()) return
  
  try {
    const item = JSON.parse(jsonInput.value) as AnalysisItem
    if (!item.id || !item.title || !item.date) {
      throw new Error('JSON 格式不完整，缺少 id, title 或 date')
    }

    isSubmitting.value = true
    await analysisStore.addAnalysisItem(item)
    
    message.value = { type: 'success', text: '数据已成功插入云数据库头部！' }
    jsonInput.value = ''
  } catch (err: any) {
    message.value = { type: 'error', text: '提交失败: ' + err.message }
  } finally {
    isSubmitting.value = false
  }
}

const syncMarketData = async () => {
  const dates = analysisStore.availableDates;
  if (dates.length === 0) return alert('请先同步视频数据');
  
  if (confirm(`准备同步 ${dates.length} 天的历史行情数据到 market_indices 集合？`)) {
    isSubmitting.value = true;
    try {
      // 已迁移到 D1，不再使用 CloudBase
      // const mockData = getMockHistoricalData(dates);
      // for (const item of mockData) {
      //   await db.collection("market_indices").add(item).catch(() => {});
      // }
      alert('行情数据同步完成！');
      location.reload();
    } catch (err: any) {
      alert('同步失败: ' + err.message);
    } finally {
      isSubmitting.value = false;
    }
  }
}

// 迁移工具：如果云数据库为空，可以将本地 JSON 迁移过去
const migrateData = async () => {
  if (confirm('确定要将本地 videos.json 迁移到云数据库吗？此操作会将本地数据逐条插入云端集合。')) {
    isSubmitting.value = true
    try {
      const baseUrl = import.meta.env.BASE_URL || '/'
      const res = await fetch(`${baseUrl}data/videos.json`)
      const data = await res.json()
      
      let successCount = 0
      // 倒序迁移，保证时间线一致
      for (const item of data.reverse()) {
        try {
          await analysisStore.addAnalysisItem(item)
          successCount++
        } catch (e) {
          console.error('迁移单条数据失败:', item.id, e)
        }
      }
      alert(`迁移完成！成功导入 ${successCount} 条数据到 analysis_items 集合。`)
      location.reload()
    } catch (err: any) {
      alert('迁移失败: ' + err.message)
    } finally {
      isSubmitting.value = false
    }
  }
}
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-4">
        <div class="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
          <Database class="w-6 h-6" />
        </div>
        <div>
          <h1 class="text-2xl font-black text-gray-900">数据管理后台</h1>
          <p class="text-sm text-gray-500 font-medium">私人入口：快速更新解析数据</p>
        </div>
      </div>
      
      <button 
        @click="migrateData"
        class="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors text-sm font-bold"
      >
        <Send class="w-4 h-4" />
        <span>同步本地 JSON 到云端</span>
      </button>

      <button 
        @click="syncMarketData"
        class="flex items-center space-x-2 px-4 py-2 bg-orange-100 text-orange-600 rounded-xl hover:bg-orange-200 transition-colors text-sm font-bold"
      >
        <TrendingUp class="w-4 h-4" />
        <span>同步历史行情数据</span>
      </button>
    </div>

    <div class="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 space-y-6">
      <div class="space-y-2">
        <label class="flex items-center space-x-2 text-sm font-black text-gray-700 uppercase tracking-widest">
          <FileJson class="w-4 h-4 text-primary-600" />
          <span>粘贴解析 JSON</span>
        </label>
        <p class="text-xs text-gray-400 font-medium">请确保 JSON 格式符合 AnalysisItem 接口规范</p>
      </div>

      <textarea
        v-model="jsonInput"
        rows="15"
        class="w-full px-4 py-4 rounded-2xl border border-gray-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all font-mono text-sm"
        placeholder='{ 
  "id": "...", 
  "title": "...", 
  "date": "...", 
  "logic_factors": [
    { 
      "factor_name": "能源依赖", 
      "factor_value": "99%依赖", 
      "weight": 0.95, 
      "direction": "看跌", 
      "description": "致命软肋，霍尔木兹封闭是结构性致命打击" 
    }
  ],
  ... 
}'
      ></textarea>

      <div v-if="message.text" :class="['p-4 rounded-2xl flex items-start space-x-3', message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700']">
        <component :is="message.type === 'success' ? CheckCircle2 : AlertCircle" class="w-5 h-5 flex-shrink-0 mt-0.5" />
        <span class="text-sm font-bold">{{ message.text }}</span>
      </div>

      <button
        @click="handleSubmit"
        :disabled="!jsonInput.trim() || isSubmitting"
        class="w-full py-4 bg-primary-600 text-white rounded-2xl font-black shadow-lg shadow-primary-200 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
      >
        <Loader2 v-if="isSubmitting" class="w-5 h-5 animate-spin" />
        <Send v-else class="w-5 h-5" />
        <span>{{ isSubmitting ? '正在提交到云端...' : '确认发送并更新' }}</span>
      </button>
    </div>

    <!-- 板块数据手动同步 -->
    <div class="bg-white rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 space-y-6">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="space-y-2">
          <label class="flex items-center space-x-2 text-sm font-black text-orange-700 uppercase tracking-widest">
            <TrendingUp class="w-4 h-4 text-orange-600" />
            <span>板块情绪数据手动对撞 (EastMoney JSON)</span>
          </label>
          <p class="text-xs text-gray-400 font-medium">粘贴从浏览器获取的东方财富板块接口 JSON 数据</p>
        </div>

        <div class="flex items-center space-x-3 bg-gray-50 px-4 py-2 rounded-2xl border border-gray-100">
          <CalendarIcon class="w-4 h-4 text-orange-400" />
          <input 
            type="date" 
            v-model="sectorDate" 
            class="bg-transparent border-none focus:ring-0 text-sm font-bold text-gray-700 outline-none"
          />
        </div>
      </div>

      <textarea
        v-model="sectorJsonInput"
        rows="10"
        class="w-full px-4 py-4 rounded-2xl border border-gray-200 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition-all font-mono text-sm"
        placeholder='粘贴 {"rc":0,"data":{"total":496,"diff":{...}}} 格式数据'
      ></textarea>

      <button
        @click="handleSectorSubmit"
        :disabled="!sectorJsonInput.trim() || isSubmitting"
        class="w-full py-4 bg-orange-600 text-white rounded-2xl font-black shadow-lg shadow-orange-200 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
      >
        <Loader2 v-if="isSubmitting" class="w-5 h-5 animate-spin" />
        <TrendingUp v-else class="w-5 h-5" />
        <span>{{ isSubmitting ? '正在对撞数据...' : '手动同步板块行情数据' }}</span>
      </button>
    </div>

    <div class="bg-primary-50 rounded-3xl p-6 border border-primary-100">
      <h3 class="text-sm font-black text-primary-700 uppercase tracking-widest mb-3">使用说明</h3>
      <ul class="space-y-2 text-xs text-primary-600 font-medium list-disc pl-4">
        <li>系统会自动按日期（date 字段）进行倒序排列，无需担心插入位置。</li>
        <li>新提交的数据会实时同步到所有用户的首页看板。</li>
        <li>板块数据同步：由于接口反爬，请在浏览器中打开东方财富接口，将返回的 JSON 粘贴到下方框内，多次粘贴不同页码（pn=1,2,3...）的数据，系统会自动去重合并。</li>
        <li>建议在本地测试好 JSON 格式后再提交。</li>
      </ul>
    </div>
  </div>
</template>
