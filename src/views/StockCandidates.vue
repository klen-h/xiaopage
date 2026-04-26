<script setup lang="ts">
import { ref, computed } from 'vue'
// import { fetchAutomationData } from '@/api/github'
// import candidatesDebug from '../../lishaoxia-value-detector/data/stocks/candidates_debug.json'

import { 
  Search, 
  Activity, 
  BarChart3, 
  // RefreshCw, 
  ChevronRight,
  // TrendingUp,
  // TrendingDown,
  Info
} from 'lucide-vue-next'
// import { presetStocks } from '@/constants/stocks'

const searchQuery = ref('')
const isLoading = ref(false)
const error = ref('')
const debugData = ref<any>(null)
const activeType = ref<'VALUE' | 'GROWTH'>('VALUE')

// 加载初筛调试数据
// const loadDebugData = async () => {
//   isLoading.value = true
//   error.value = ''
//   try {
//     const data = candidatesDebug
//     if (data) {
//       console.log(data.update_time)
//       debugData.value = data
//     } else {
//       error.value = '未能加载到初筛数据，请检查脚本运行状态。'
//     }
//   } catch (err) {
//     console.error('获取数据失败:', err)
//     error.value = '获取数据失败，请稍后再试。'
//   } finally {
//     isLoading.value = false
//   }
// }

// onMounted(() => {
//   loadDebugData()
// })

// 放宽条件的过滤逻辑 (李大霄式备选池)
const filteredStocks = computed(() => {
  if (!debugData.value) return []
  
  const stocks = activeType.value === 'VALUE' 
    ? debugData.value.value_candidates 
    : debugData.value.growth_candidates
    
  if (!stocks) return []

  return stocks.filter((s: any) => {
    // 搜索过滤
    const matchesSearch = s.name.includes(searchQuery.value) || s.code.includes(searchQuery.value)
    if (!matchesSearch) return false

    // ========== 李大霄"好股票"筛选条件 ==========
    
    // 基础质量门槛（所有类型通用）
    const isLargeCap = s.total_mv > 50000000000  // 总市值 > 500亿（大盘蓝筹）
    const hasLiquidity = s.circ_mv > 10000000000  // 流通市值 > 100亿
    const reasonableTurnover = s.turnover > 0.05  // 换手率 > 0.05%（有活跃度）
    const positiveMomentum = s['60日涨跌幅'] > -10  // 60日跌幅不超过10%（避免崩盘股）
    
    // 基础条件不满足直接排除（远离"黑五类"中的差股票）
    if (!isLargeCap || !hasLiquidity || !reasonableTurnover) return false

    if (activeType.value === 'VALUE') {
      // ========== 价值型：李大霄"钻石底"标准 ==========
      // 极度低估 + 高安全边际 + 稳定分红预期
      const lowPE = s.pe < 12           // PE < 12（比你的15更严格，接近钻石底标准）
      const lowPB = s.pb < 1.2          // PB < 1.2（破净边缘，极高安全边际）
      const stablePrice = s['年初至今涨跌幅'] > 5  // 年度正收益（趋势稳健）
      const lowVolatility = s.振幅 < 5  // 振幅 < 5%（避免过度波动）
      
      // 价值型核心：低估值 + 大市值 + 稳健趋势
      return lowPE && lowPB && stablePrice && lowVolatility && positiveMomentum
      
    } else {
      // ========== 成长型：李大霄"优质成长"标准 ==========
      // 合理估值成长 + 龙头地位 + 业绩支撑
      const reasonablePE = s.pe < 20     // PE < 20（成长股也要估值合理，拒绝伪成长）
      const leaderStatus = s.total_mv > 100000000000  // 总市值 > 1000亿（行业龙头）
      const strongMomentum = s['60日涨跌幅'] > 15      // 60日涨幅 > 15%（资金认可）
      const yearlyGain = s['年初至今涨跌幅'] > 10    // 年初至今 > 10%（年度强势）
      
      // 成长型核心：合理估值 + 龙头地位 + 强势趋势
      return reasonablePE && leaderStatus && strongMomentum && yearlyGain
    }
  }).sort((a: any, b: any) => {
    // 排序逻辑：价值型按股息率（隐含），成长型按市值+涨幅综合
    if (activeType.value === 'VALUE') {
      // 价值型：按PB升序（越低越好），再按市值
      return a.pb - b.pb || b.total_mv - a.total_mv
    } else {
      // 成长型：按60日涨幅降序，再按市值
      return b['60日涨跌幅'] - a['60日涨跌幅'] || b.total_mv - a.total_mv
    }
  })
})

const getStockColor = (change: number) => {
  if (change > 0) return 'text-red-500'
  if (change < 0) return 'text-green-500'
  return 'text-gray-500'
}

const formatMV = (mv: number) => {
  return (mv / 1e8).toFixed(0) + '亿'
}
</script>

<template>
  <div class="space-y-6 lg:space-y-8 animate-in fade-in duration-500 pb-10 max-w-6xl mx-auto px-4">
    <!-- Header -->
    <header class="bg-gradient-to-br from-blue-600 to-indigo-800 rounded-2xl lg:rounded-3xl p-6 lg:p-10 text-white overflow-hidden shadow-xl relative">
      <div class="absolute right-0 top-0 opacity-10 pointer-events-none">
        <Activity class="w-48 h-48 lg:w-80 lg:h-80 -mr-10 lg:-mr-20 -mt-10 lg:-mt-20 rotate-12" />
      </div>
      <div class="relative z-10 max-w-2xl">
        <div class="flex items-center space-x-3 mb-4">
          <div class="p-2 bg-white/20 backdrop-blur-md rounded-xl">
            <BarChart3 class="w-5 h-5 lg:w-6 lg:h-6 text-white" />
          </div>
          <span class="text-[10px] lg:text-sm font-black uppercase tracking-widest text-blue-100">初筛池备选 (严格筛选)</span>
        </div>
        <h1 class="text-2xl lg:text-4xl font-black mb-3 lg:mb-4">“大霄备选”全景图</h1>
        <p class="text-blue-100 text-sm lg:text-lg leading-relaxed font-medium">
          这里展示了脚本初筛后但尚未经过深度财务扫描的所有股票。条件已适当放宽，方便您寻找那些处于“钻石底”边缘的潜在大牛。
        </p>
      </div>
    </header>

    <!-- Controls -->
    <div class="flex flex-col md:flex-row gap-4 items-center justify-between">
      <div class="flex items-center space-x-1 bg-gray-100/50 p-1 rounded-xl w-fit">
        <button 
          @click="activeType = 'VALUE'"
          :class="[
            'px-6 py-2.5 rounded-lg text-xs font-black transition-all flex items-center space-x-2',
            activeType === 'VALUE' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
          ]"
        >
          <span>💎 价值候选 ({{ debugData?.value_candidates_count || 0 }})</span>
        </button>
        <button 
          @click="activeType = 'GROWTH'"
          :class="[
            'px-6 py-2.5 rounded-lg text-xs font-black transition-all flex items-center space-x-2',
            activeType === 'GROWTH' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
          ]"
        >
          <span>🚀 成长候选 ({{ debugData?.growth_candidates_count || 0 }})</span>
        </button>
      </div>

      <div class="relative w-full md:w-64 group">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="搜索名称/代码..."
          class="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-bold text-sm"
        >
      </div>

      <!-- <button 
        @click="loadDebugData"
        :disabled="isLoading"
        class="flex items-center space-x-2 px-4 py-2.5 bg-gray-50 text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-all text-xs"
      >
        <RefreshCw :class="['w-4 h-4', isLoading ? 'animate-spin' : '']" />
        <span>{{ isLoading ? '刷新中...' : '同步实时初筛' }}</span>
      </button> -->
    </div>

    <!-- Stats Info -->
    <div v-if="debugData" class="flex items-center space-x-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 text-blue-600 text-xs font-bold">
      <Info class="w-4 h-4" />
      <p>当前展示的是基于严格 PE/PB/市值 筛选后的优质标的。数据更新于: {{ new Date(debugData.update_time).toLocaleString() }}</p>
    </div>

    <!-- Error State -->
    <div v-if="error" class="p-6 bg-red-50 border border-red-100 rounded-2xl flex items-center space-x-3 text-red-600">
      <Activity class="w-5 h-5 flex-shrink-0" />
      <p class="font-bold text-sm">{{ error }}</p>
    </div>

    <!-- Stock Grid -->
    <div v-if="filteredStocks.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div 
        v-for="stock in filteredStocks" 
        :key="stock.code"
        class="bg-white border border-gray-100 rounded-2xl p-5 hover:border-blue-200 hover:shadow-lg transition-all group"
      >
        <div class="flex justify-between items-start mb-4">
          <div>
            <h3 class="text-lg font-black text-gray-900 group-hover:text-blue-600 transition-colors">{{ stock.name }}</h3>
            <p class="text-xs text-gray-400 font-bold tracking-widest">{{ stock.code }}</p>
          </div>
          <div class="text-right">
            <p class="text-xl font-black text-gray-900">{{ stock.price }}</p>
            <p :class="['text-xs font-bold', getStockColor(stock.change_pct)]">
              {{ stock.change_pct > 0 ? '+' : '' }}{{ stock.change_pct }}%
            </p>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-4 py-4 border-y border-gray-50">
          <div class="space-y-1">
            <p class="text-[10px] font-black text-gray-400 uppercase tracking-tighter">PE</p>
            <p class="text-sm font-bold text-gray-700">{{ stock.pe?.toFixed(1) || 'N/A' }}</p>
          </div>
          <div class="space-y-1">
            <p class="text-[10px] font-black text-gray-400 uppercase tracking-tighter">PB</p>
            <p class="text-sm font-bold text-gray-700">{{ stock.pb?.toFixed(2) || 'N/A' }}</p>
          </div>
          <div class="space-y-1">
            <p class="text-[10px] font-black text-gray-400 uppercase tracking-tighter">总市值</p>
            <p class="text-sm font-bold text-gray-700">{{ formatMV(stock.total_mv) }}</p>
          </div>
        </div>

        <div class="flex items-center justify-between mt-4">
          <div class="flex space-x-2">
            <span v-if="stock.pe < 15" class="px-2 py-0.5 bg-red-50 text-red-600 text-[9px] font-black rounded-full">极低PE</span>
            <span v-if="stock.pb < 1" class="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black rounded-full">破净</span>
          </div>
          <button class="text-gray-300 group-hover:text-blue-500 transition-colors">
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!isLoading" class="bg-white rounded-3xl border border-dashed border-gray-200 p-20 text-center space-y-6">
      <div class="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mx-auto">
        <BarChart3 class="w-10 h-10" />
      </div>
      <div>
        <h3 class="text-xl font-bold text-gray-400">暂无符合条件的备选股</h3>
        <p class="text-sm text-gray-300 mt-2">请尝试调整搜索关键词或等待下次数据更新。</p>
      </div>
    </div>
  </div>
</template>
