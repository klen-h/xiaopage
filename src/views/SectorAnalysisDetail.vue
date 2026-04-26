<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAnalysisStore } from '@/stores/analysis'
import { 
  ArrowLeft, 
  Activity, 
  Target,
  TrendingUp,
  // TrendingDown,
  Calendar,
  Search,
  Filter,
  Info,
  ArrowUpRight,
  BarChart3
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const analysisStore = useAnalysisStore()

const selectedDate = ref(route.query.date as string || '')
const searchQuery = ref('')
const filterStatus = ref<'全部' | '逻辑共振' | '等待对撞'>('全部')

// 获取所有有数据的日期 (从 store 获取)
const availableDates = computed(() => analysisStore.availableDates)
const availableDatesReversed = computed(() => [...analysisStore.availableDates].reverse())

// 默认选择最新日期
if (!selectedDate.value && availableDates.value.length > 0) {
  selectedDate.value = availableDates.value[availableDates.value.length - 1]
}

const videosForDay = computed(() => {
  if (!selectedDate.value) return []
  return analysisStore.getVideosByDate(selectedDate.value)
})

const sectorsWithPerformance = computed(() => {
  const daySectors = [...new Set(videosForDay.value.flatMap(v => v.structured.sectors || []))]
  return daySectors.map(name => {
    // 优先全等于，其次包含关系
    const performance = analysisStore.sectorPerformance.find(p => p.name === name) || 
                        analysisStore.sectorPerformance.find(p => p.name.includes(name) || name.includes(p.name))
    return {
      name,
      performance: performance || null,
      mentionCount: videosForDay.value.filter(v => v.structured.sectors?.includes(name)).length
    }
  }).sort((a, b) => (b.performance?.changePercent || 0) - (a.performance?.changePercent || 0))
})

const filteredSectors = computed(() => {
  return sectorsWithPerformance.value.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesStatus = filterStatus.value === '全部' || 
                         (filterStatus.value === '逻辑共振' && s.performance) || 
                         (filterStatus.value === '等待对撞' && !s.performance)
    return matchesSearch && matchesStatus
  })
})

const stats = computed(() => {
  const total = sectorsWithPerformance.value.length
  const resonance = sectorsWithPerformance.value.filter(s => s.performance).length
  const avgChange = resonance > 0 
    ? (sectorsWithPerformance.value.reduce((acc, s) => acc + (s.performance?.changePercent || 0), 0) / resonance).toFixed(2)
    : '0.00'
  
  return { total, resonance, avgChange }
})

const goBack = () => {
  router.back()
}

watch(selectedDate, (newDate) => {
  if (newDate) {
    analysisStore.fetchSectorDataByDate(newDate)
  }
}, { immediate: true })

const formatUpdateTime = (ts: number | null) => {
  if (!ts) return '从未同步'
  const date = new Date(ts)
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-500">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="space-y-1">
        <button @click="goBack" class="inline-flex items-center text-gray-500 hover:text-gray-900 transition-colors font-medium mb-2">
          <ArrowLeft class="w-4 h-4 mr-2" />
          返回看板
        </button>
        <div class="flex items-center space-x-3">
          <div class="p-2 bg-orange-100 rounded-xl">
            <Activity class="w-6 h-6 text-orange-600" />
          </div>
          <h1 class="text-2xl font-black text-gray-900 tracking-tight">板块情绪全景追踪</h1>
          <div v-if="analysisStore.sectorUpdateTime" class="hidden md:flex items-center px-2 py-1 bg-gray-100 text-gray-500 rounded-lg text-[10px] font-black uppercase tracking-widest">
            快照同步时间: {{ formatUpdateTime(analysisStore.sectorUpdateTime) }}
          </div>
        </div>
        <p class="text-gray-500 text-sm">对撞大霄看好板块与市场实时资金流向，识别逻辑共振主线</p>
      </div>

      <div class="flex items-center space-x-3 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100">
        <div class="flex items-center px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100">
          <Calendar class="w-4 h-4 text-gray-400 mr-2" />
          <select v-model="selectedDate" class="bg-transparent border-none focus:ring-0 text-sm font-bold text-gray-700 cursor-pointer">
            <option v-for="date in availableDatesReversed" :key="date" :value="date">{{ date }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Stats Overview -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
        <div class="p-3 bg-blue-50 text-blue-600 rounded-2xl">
          <Target class="w-6 h-6" />
        </div>
        <div>
          <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">追踪板块总数</p>
          <p class="text-2xl font-black text-gray-900">{{ stats.total }}</p>
        </div>
      </div>
      <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
        <div class="p-3 bg-orange-50 text-orange-600 rounded-2xl">
          <Zap class="w-6 h-6" />
        </div>
        <div>
          <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">逻辑共振板块</p>
          <p class="text-2xl font-black text-gray-900">{{ stats.resonance }}</p>
        </div>
      </div>
      <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
        <div class="p-3 bg-red-50 text-red-600 rounded-2xl">
          <TrendingUp class="w-6 h-6" />
        </div>
        <div>
          <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">平均涨跌幅</p>
          <p :class="['text-2xl font-black', Number(stats.avgChange) >= 0 ? 'text-red-600' : 'text-green-600']">
            {{ Number(stats.avgChange) >= 0 ? '+' : '' }}{{ stats.avgChange }}%
          </p>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
      <div class="relative w-full md:w-96">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input 
          v-model="searchQuery"
          type="text" 
          placeholder="搜索板块名称..." 
          class="w-full pl-10 pr-4 py-2 bg-gray-50 border-none focus:ring-2 focus:ring-primary-500 rounded-xl text-sm"
        />
      </div>
      
      <div class="flex items-center space-x-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
        <Filter class="w-4 h-4 text-gray-400 mr-1 shrink-0" />
        <button 
          @click="filterStatus = '全部'"
          :class="['px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all', filterStatus === '全部' ? 'bg-primary-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200']"
        >
          全部
        </button>
        <button 
          @click="filterStatus = '逻辑共振'"
          :class="['px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all', filterStatus === '逻辑共振' ? 'bg-orange-600 text-white shadow-md' : 'bg-orange-50 text-orange-600 hover:bg-orange-100']"
        >
          逻辑共振
        </button>
        <button 
          @click="filterStatus = '等待对撞'"
          :class="['px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all', filterStatus === '等待对撞' ? 'bg-gray-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200']"
        >
          等待对撞
        </button>
      </div>
    </div>

    <!-- Sector Cards Grid -->
    <div v-if="filteredSectors.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div 
        v-for="sector in filteredSectors" 
        :key="sector.name" 
        class="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all group flex flex-col"
      >
        <div class="flex items-start justify-between mb-6">
          <div class="flex items-center space-x-3">
            <div class="p-3 bg-gray-50 rounded-2xl group-hover:bg-primary-50 transition-colors">
              <Target class="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h3 class="text-lg font-black text-gray-900">{{ sector.name }}</h3>
              <div class="flex items-center space-x-2 mt-1">
                <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">提及其数: {{ sector.mentionCount }}</span>
              </div>
            </div>
          </div>
          <div v-if="sector.performance" :class="['px-3 py-1 rounded-lg text-sm font-black', sector.performance.changePercent >= 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600']">
            {{ sector.performance.changePercent >= 0 ? '+' : '' }}{{ sector.performance.changePercent }}%
          </div>
          <div v-else class="px-3 py-1 bg-gray-50 text-gray-400 rounded-lg text-[10px] font-black">
            等待对撞
          </div>
        </div>

        <div v-if="sector.performance" class="space-y-4 flex-1">
          <div class="grid grid-cols-2 gap-4">
            <div class="bg-gray-50 p-3 rounded-2xl">
              <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">主力资金</p>
              <p :class="['text-sm font-black', sector.performance.mainInflow >= 0 ? 'text-red-600' : 'text-green-600']">
                {{ (sector.performance.mainInflow / 100000000).toFixed(2) }} 亿
              </p>
            </div>
            <div class="bg-gray-50 p-3 rounded-2xl">
              <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">市场热度</p>
              <p class="text-sm font-black text-gray-900">活跃</p>
            </div>
          </div>
          
          <div class="space-y-2">
            <div class="flex justify-between text-[10px] font-black text-gray-400 uppercase">
              <span>涨跌幅强度</span>
              <span>{{ Math.abs(sector.performance.changePercent) }}%</span>
            </div>
            <div class="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                :class="['h-full transition-all duration-1000', sector.performance.changePercent >= 0 ? 'bg-red-500' : 'bg-green-500']"
                :style="{ width: Math.min(Math.abs(sector.performance.changePercent) * 10, 100) + '%' }"
              ></div>
            </div>
          </div>
        </div>
        
        <div v-else class="flex-1 flex flex-col items-center justify-center py-8 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
          <Info class="w-5 h-5 text-gray-300 mb-2" />
          <p class="text-[10px] font-bold text-gray-400 uppercase">暂未匹配到实时行情</p>
        </div>

        <div class="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
          <div class="flex items-center space-x-2 text-[10px] font-bold text-gray-400">
            <BarChart3 class="w-3 h-3" />
            <span>实时数据源: 东方财富</span>
          </div>
          <button class="text-[10px] font-black text-primary-600 hover:underline flex items-center">
            深度追踪
            <ArrowUpRight class="w-3 h-3 ml-0.5" />
          </button>
        </div>
      </div>
    </div>

    <div v-else class="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
      <div class="p-4 bg-gray-50 rounded-full mb-4">
        <Search class="w-8 h-8 text-gray-300" />
      </div>
      <p class="text-gray-500 font-bold">没有找到匹配的板块</p>
      <button @click="searchQuery = ''; filterStatus = '全部'" class="mt-4 text-sm font-black text-primary-600">重置搜索</button>
    </div>
  </div>
</template>
