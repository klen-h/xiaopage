<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAnalysisStore } from '@/stores/analysis'
import { 
  ArrowLeft, 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Search,
  Calendar,
  Filter,
  Info
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const analysisStore = useAnalysisStore()

// 选中的日期，默认为路由参数中的日期或最新日期
const selectedDate = ref(route.query.date as string || '')
const searchQuery = ref('')
const filterDirection = ref<'全部' | '看涨' | '看跌' | '中性'>('全部')

// 获取所有有数据的日期
const availableDates = computed(() => analysisStore.availableDates)

const availableDatesReversed = computed(() => [...analysisStore.availableDates].reverse())

// 如果没有选定日期，默认选最新的
if (!selectedDate.value && availableDates.value.length > 0) {
  selectedDate.value = availableDates.value[availableDates.value.length - 1]
}

// 获取选定日期的视频
const videosForDay = computed(() => {
  if (!selectedDate.value) return []
  return analysisStore.getVideosByDate(selectedDate.value)
})

// 提取选定日期的所有逻辑因子（去重）
const allLogicFactors = computed(() => {
  const factors: any[] = []
  const seen = new Set()
  
  videosForDay.value.forEach(video => {
    if (video.logic_factors) {
      video.logic_factors.forEach(factor => {
        const key = `${factor.factor_name}_${factor.direction}`
        if (!seen.has(key)) {
          factors.push({
            ...factor,
            videoTitle: video.title,
            videoId: video.id
          })
          seen.add(key)
        }
      })
    }
  })
  return factors.sort((a, b) => b.weight - a.weight)
})

// 过滤后的逻辑因子
const filteredLogicFactors = computed(() => {
  return allLogicFactors.value.filter(factor => {
    const matchesSearch = factor.factor_name.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
                         factor.description.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesDirection = filterDirection.value === '全部' || factor.direction === filterDirection.value
    return matchesSearch && matchesDirection
  })
})

// 统计信息
const stats = computed(() => {
  const total = allLogicFactors.value.length
  const bullish = allLogicFactors.value.filter(f => f.direction === '看涨').length
  const bearish = allLogicFactors.value.filter(f => f.direction === '看跌').length
  const neutral = allLogicFactors.value.filter(f => f.direction === '中性').length
  
  return { total, bullish, bearish, neutral }
})

const goBack = () => {
  router.back()
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
          <div class="p-2 bg-primary-100 rounded-xl">
            <Brain class="w-6 h-6 text-primary-600" />
          </div>
          <h1 class="text-2xl font-black text-gray-900 tracking-tight">思维地图全景</h1>
        </div>
        <p class="text-gray-500 text-sm">深度解析李大霄思维背后的逻辑因子与权重分布</p>
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
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">总计逻辑因子</p>
        <p class="text-2xl font-black text-gray-900">{{ stats.total }}</p>
      </div>
      <div class="bg-red-50 p-4 rounded-2xl border border-red-100 shadow-sm">
        <p class="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">看涨因子</p>
        <p class="text-2xl font-black text-red-600">{{ stats.bullish }}</p>
      </div>
      <div class="bg-green-50 p-4 rounded-2xl border border-green-100 shadow-sm">
        <p class="text-[10px] font-black text-green-400 uppercase tracking-widest mb-1">看跌因子</p>
        <p class="text-2xl font-black text-green-600">{{ stats.bearish }}</p>
      </div>
      <div class="bg-gray-50 p-4 rounded-2xl border border-gray-100 shadow-sm">
        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">中性因子</p>
        <p class="text-2xl font-black text-gray-900">{{ stats.neutral }}</p>
      </div>
    </div>

    <!-- Filters & Search -->
    <div class="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
      <div class="relative w-full md:w-96">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input 
          v-model="searchQuery"
          type="text" 
          placeholder="搜索逻辑因子或描述..." 
          class="w-full pl-10 pr-4 py-2 bg-gray-50 border-none focus:ring-2 focus:ring-primary-500 rounded-xl text-sm"
        />
      </div>
      
      <div class="flex items-center space-x-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
        <Filter class="w-4 h-4 text-gray-400 mr-1 shrink-0" />
        <button 
          @click="filterDirection = '全部'"
          :class="['px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all', filterDirection === '全部' ? 'bg-primary-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200']"
        >
          全部
        </button>
        <button 
          @click="filterDirection = '看涨'"
          :class="['px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all', filterDirection === '看涨' ? 'bg-red-600 text-white shadow-md' : 'bg-red-50 text-red-600 hover:bg-red-100']"
        >
          看涨
        </button>
        <button 
          @click="filterDirection = '看跌'"
          :class="['px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all', filterDirection === '看跌' ? 'bg-green-600 text-white shadow-md' : 'bg-green-50 text-green-600 hover:bg-green-100']"
        >
          看跌
        </button>
        <button 
          @click="filterDirection = '中性'"
          :class="['px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all', filterDirection === '中性' ? 'bg-gray-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200']"
        >
          中性
        </button>
      </div>
    </div>

    <!-- Logic Factors Grid -->
    <div v-if="filteredLogicFactors.length > 0" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      <div 
        v-for="(factor, idx) in filteredLogicFactors" 
        :key="idx" 
        class="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all group flex flex-col"
      >
        <div class="flex items-start justify-between mb-4">
          <div :class="[
            'p-2.5 rounded-2xl shrink-0',
            factor.direction === '看涨' ? 'bg-red-50 text-red-600' : 
            factor.direction === '看跌' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-600'
          ]">
            <TrendingUp v-if="factor.direction === '看涨'" class="w-5 h-5" />
            <TrendingDown v-else-if="factor.direction === '看跌'" class="w-5 h-5" />
            <Minus v-else class="w-5 h-5" />
          </div>
          <div class="flex flex-col items-end">
            <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">权重影响力</span>
            <div class="flex items-center space-x-2">
              <div class="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  :class="['h-full transition-all duration-1000', factor.direction === '看涨' ? 'bg-red-500' : (factor.direction === '看跌' ? 'bg-green-500' : 'bg-gray-500')]"
                  :style="{ width: (factor.weight * 100) + '%' }"
                ></div>
              </div>
              <span class="text-xs font-black text-gray-900">{{ (factor.weight * 100).toFixed(0) }}%</span>
            </div>
          </div>
        </div>

        <div class="space-y-3 flex-1">
          <div class="flex items-center space-x-2">
            <h3 class="text-lg font-black text-gray-900">{{ factor.factor_name }}</h3>
            <span :class="[
              'text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-tighter shrink-0',
              factor.direction === '看涨' ? 'bg-red-100 text-red-700' : 
              factor.direction === '看跌' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
            ]">
              {{ factor.direction }}
            </span>
          </div>

          <div class="inline-flex items-center px-2 py-1 bg-primary-50 text-primary-700 rounded-lg text-xs font-black">
            数值参考: {{ factor.factor_value }}
          </div>

          <p class="text-sm text-gray-600 leading-relaxed font-medium">
            {{ factor.description }}
          </p>
        </div>

        <div class="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
          <div class="flex items-center space-x-2 text-[10px] font-bold text-gray-400">
            <Info class="w-3 h-3" />
            <span>来源视频: {{ factor.videoTitle }}</span>
          </div>
          <router-link :to="`/analysis/${factor.videoId}`" class="text-[10px] font-black text-primary-600 hover:underline">
            查看视频解析
          </router-link>
        </div>
      </div>
    </div>

    <div v-else class="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
      <div class="p-4 bg-gray-50 rounded-full mb-4">
        <Search class="w-8 h-8 text-gray-300" />
      </div>
      <p class="text-gray-500 font-bold">没有找到匹配的逻辑因子</p>
      <button @click="searchQuery = ''; filterDirection = '全部'" class="mt-4 text-sm font-black text-primary-600">重置搜索</button>
    </div>
  </div>
</template>
