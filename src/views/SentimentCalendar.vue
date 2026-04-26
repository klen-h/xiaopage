<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAnalysisStore } from '@/stores/analysis'
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Zap, 
  Target,
  Info,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Activity
} from 'lucide-vue-next'
import { 
  getSentimentLabel, 
  getSentimentColorClass, 
  getSentimentHexColor,
  getSentimentDescription
} from '@/utils/sentiment'

const router = useRouter()
const analysisStore = useAnalysisStore()

const currentDate = ref(new Date())
const selectedDateStr = ref('')

const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

const daysInMonth = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  const firstDay = new Date(year, month, 1).getDay() // 0 (Sun) to 6 (Sat)
  const days = new Date(year, month + 1, 0).getDate()
  
  // 转换周首日为周一 (0=Mon, 6=Sun)
  const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1
  
  const result = []
  // 填充上月空白
  for (let i = 0; i < adjustedFirstDay; i++) {
    result.push({ day: null, dateStr: null })
  }
  // 填充本月日期
  for (let i = 1; i <= days; i++) {
    // const d = new Date(year, month, i)
    const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`
    result.push({ day: i, dateStr })
  }
  return result
})

const getDayData = (dateStr: string | null) => {
  if (!dateStr) return null
  const videos = analysisStore.getVideosByDate(dateStr)
  if (videos.length === 0) return null
  
  const avgScore = Math.round(videos.reduce((acc, v) => acc + v.sentiment_score, 0) / videos.length)
  const allSectors = [...new Set(videos.flatMap(v => v.structured.sectors || []))]
  const allLogics = [...new Set(videos.flatMap(v => v.structured.operation_advice ? [v.structured.operation_advice] : []))]
  
  // 获取指数表现
  const market = analysisStore.marketIndices.find(m => m.date === dateStr)
  
  return {
    score: avgScore,
    videos,
    sectors: allSectors,
    logics: allLogics,
    market
  }
}

const prevMonth = () => {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, 1)
}

const nextMonth = () => {
  currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 1)
}

const selectDay = (dateStr: string | null) => {
  if (dateStr && getDayData(dateStr)) {
    selectedDateStr.value = dateStr
  }
}

// 自动选择本月有数据的最后一天
const autoSelectLastAvailableDay = () => {
  const availableDays = daysInMonth.value
    .filter(d => d.dateStr && getDayData(d.dateStr))
    .map(d => d.dateStr as string)
  
  if (availableDays.length > 0) {
    selectedDateStr.value = availableDays[availableDays.length - 1]
  } else {
    selectedDateStr.value = ''
  }
}

watch(currentDate, () => {
  autoSelectLastAvailableDay()
}, { immediate: true })

const selectedDayData = computed(() => getDayData(selectedDateStr.value))

const goToDashboard = (date: string) => {
  router.push({ path: '/', query: { date } })
}

const formatMarketChange = (change: number | undefined) => {
  if (change === undefined) return ''
  const prefix = change > 0 ? '+' : ''
  return `${prefix}${change}%`
}
</script>

<template>
  <div class="space-y-6 lg:space-y-8 animate-in fade-in duration-500 pb-10 max-w-7xl mx-auto px-4">
    <!-- Header -->
    <header class="bg-white rounded-2xl lg:rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div class="flex items-center space-x-4">
        <div class="w-12 h-12 bg-primary-50 rounded-2xl flex items-center justify-center text-primary-600">
          <CalendarIcon class="w-6 h-6" />
        </div>
        <div>
          <h1 class="text-2xl font-black text-gray-900">情绪演化日历</h1>
          <p class="text-sm text-gray-500 font-medium">像大师一样复盘，从时间维度洞察情绪周期</p>
        </div>
      </div>

      <div class="flex items-center space-x-4 bg-gray-50 p-2 rounded-2xl border border-gray-100">
        <button @click="prevMonth" class="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all">
          <ChevronLeft class="w-5 h-5 text-gray-600" />
        </button>
        <div class="px-4 text-center min-w-[120px]">
          <span class="text-lg font-black text-gray-900">{{ currentDate.getFullYear() }}年 {{ monthNames[currentDate.getMonth()] }}</span>
        </div>
        <button @click="nextMonth" class="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all">
          <ChevronRight class="w-5 h-5 text-gray-600" />
        </button>
      </div>
    </header>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <!-- Left: Calendar Grid -->
      <div class="lg:col-span-8 space-y-6">
        <div class="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-6">
          <!-- Week Headers -->
          <div class="grid grid-cols-7 mb-4">
            <div v-for="w in ['一', '二', '三', '四', '五', '六', '日']" :key="w" class="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest py-2">
              周{{ w }}
            </div>
          </div>

          <!-- Days Grid -->
          <div class="grid grid-cols-7 gap-2 lg:gap-4">
            <div 
              v-for="(day, idx) in daysInMonth" 
              :key="idx"
              class="aspect-square relative"
            >
              <template v-if="day.day">
                <button 
                  @click="selectDay(day.dateStr)"
                  :disabled="!getDayData(day.dateStr)"
                  :class="[
                    'w-full h-full rounded-xl lg:rounded-2xl border transition-all flex flex-col items-center justify-center group relative overflow-hidden',
                    selectedDateStr === day.dateStr ? 'ring-2 ring-primary-500 ring-offset-2 scale-[0.98]' : '',
                    getDayData(day.dateStr) 
                      ? 'bg-white border-gray-100 hover:shadow-md hover:scale-[1.02] cursor-pointer' 
                      : 'bg-gray-50 border-transparent opacity-30 cursor-not-allowed'
                  ]"
                >
                  <!-- Heat Background -->
                  <div 
                    v-if="getDayData(day.dateStr)"
                    class="absolute inset-0 opacity-10"
                    :style="{ backgroundColor: getSentimentHexColor(getDayData(day.dateStr)!.score) }"
                  ></div>
                  
                  <span :class="['text-xs lg:text-sm font-black z-10', selectedDateStr === day.dateStr ? 'text-primary-600' : 'text-gray-500']">
                    {{ day.day }}
                  </span>
                  
                  <!-- Small Indicator -->
                  <div 
                    v-if="getDayData(day.dateStr)"
                    :class="['w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full mt-1 z-10', getSentimentColorClass(getDayData(day.dateStr)!.score)]"
                  ></div>
                </button>
              </template>
            </div>
          </div>
        </div>

        <!-- Legend -->
        <div class="bg-white rounded-2xl p-4 border border-gray-100 flex flex-wrap items-center justify-center gap-6">
          <div class="flex items-center space-x-2">
            <div class="w-3 h-3 rounded-full bg-red-500"></div>
            <span class="text-[10px] font-bold text-gray-500">乐观 (贪婪)</span>
          </div>
          <div class="flex items-center space-x-2">
            <div class="w-3 h-3 rounded-full bg-orange-500"></div>
            <span class="text-[10px] font-bold text-gray-500">偏暖</span>
          </div>
          <div class="flex items-center space-x-2">
            <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span class="text-[10px] font-bold text-gray-500">中性</span>
          </div>
          <div class="flex items-center space-x-2">
            <div class="w-3 h-3 rounded-full bg-blue-500"></div>
            <span class="text-[10px] font-bold text-gray-500">谨慎 (恐慌)</span>
          </div>
          <div class="flex items-center space-x-2">
            <div class="w-3 h-3 rounded-full bg-gray-200"></div>
            <span class="text-[10px] font-bold text-gray-500">休市/无解析</span>
          </div>
        </div>

        <!-- Strategy Logic Deduction (Repositioned below calendar) -->
        <div v-if="selectedDayData && selectedDayData.logics.length > 0" class="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 lg:p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div class="flex items-center space-x-3">
            <div class="p-2 bg-orange-50 text-orange-600 rounded-xl">
              <Zap class="w-5 h-5" />
            </div>
            <div>
              <h3 class="text-lg font-black text-gray-900 uppercase tracking-widest">策略逻辑推演</h3>
              <p class="text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5">{{ selectedDateStr }} 核心操作建议</p>
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div 
              v-for="(logic, idx) in selectedDayData.logics" 
              :key="idx"
              class="p-5 bg-gray-50 border border-gray-100 text-gray-800 rounded-2xl text-sm font-bold shadow-sm leading-relaxed relative overflow-hidden flex items-start space-x-3"
            >
              <div class="w-1.5 h-1.5 rounded-full bg-orange-400 mt-2 flex-shrink-0"></div>
              <p>{{ logic }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Daily Insights -->
      <div class="lg:col-span-4">
        <div v-if="selectedDayData" class="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-500">
          <div class="p-6 lg:p-8 space-y-8 flex-1 overflow-y-auto">
            <!-- Selected Date Title -->
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-2xl font-black text-gray-900">{{ selectedDateStr }}</h2>
                <p class="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">当日情绪概览</p>
              </div>
              <button 
                @click="goToDashboard(selectedDateStr)"
                class="p-2 bg-primary-50 text-primary-600 rounded-xl hover:bg-primary-100 transition-colors"
                title="跳转至看板"
              >
                <ArrowRight class="w-5 h-5" />
              </button>
            </div>

            <!-- Sentiment Highlight -->
            <div class="p-6 rounded-2xl bg-gray-50 border border-gray-100 space-y-4">
              <div class="flex items-center justify-between">
                <span :class="['px-3 py-1 rounded-full text-xs font-black border', getSentimentColorClass(selectedDayData.score)]">
                  {{ getSentimentLabel(selectedDayData.score) }}
                </span>
                <span class="text-2xl font-black text-gray-900">{{ selectedDayData.score }}%</span>
              </div>
              <p class="text-sm text-gray-500 font-medium italic">"{{ getSentimentDescription(selectedDayData.score) }}"</p>
              
              <!-- Market Benchmark -->
              <div v-if="selectedDayData.market" class="flex items-center justify-between pt-4 border-t border-gray-200">
                <div class="flex items-center space-x-2 text-gray-400">
                  <Activity class="w-4 h-4" />
                  <span class="text-[10px] font-bold uppercase tracking-widest">当日上证指数</span>
                </div>
                <div :class="['flex items-center font-black', selectedDayData.market.changePercent > 0 ? 'text-red-500' : 'text-green-500']">
                  <component :is="selectedDayData.market.changePercent > 0 ? TrendingUp : TrendingDown" class="w-4 h-4 mr-1" />
                  ({{ formatMarketChange(selectedDayData.market.changePercent) }})
                </div>
              </div>
            </div>

            <!-- Sectors -->
            <div v-if="selectedDayData.sectors.length > 0" class="space-y-4">
              <div class="flex items-center space-x-2">
                <div class="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                  <Target class="w-4 h-4" />
                </div>
                <h3 class="text-sm font-black text-gray-900 uppercase tracking-widest">当日重点看好板块</h3>
              </div>
              <div class="flex flex-wrap gap-2">
                <span 
                  v-for="sector in selectedDayData.sectors" 
                  :key="sector"
                  class="px-3 py-1.5 bg-white border border-blue-100 text-blue-700 rounded-xl text-xs font-bold shadow-sm"
                >
                  {{ sector }}
                </span>
              </div>
            </div>
          </div>
          
          <!-- Bottom Action -->
          <div class="p-6 bg-gray-50 border-t border-gray-100">
            <button 
              @click="goToDashboard(selectedDateStr)"
              class="w-full py-4 bg-primary-600 text-white rounded-2xl font-black shadow-lg shadow-primary-900/20 hover:bg-primary-700 transition-all active:scale-[0.98] flex items-center justify-center space-x-2"
            >
              <span>查看当日深度解析</span>
              <ArrowRight class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="h-full bg-white rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center p-12 text-center space-y-6">
          <div class="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
            <Info class="w-10 h-10" />
          </div>
          <div>
            <h3 class="text-xl font-bold text-gray-400">选择日期查看心法</h3>
            <p class="text-sm text-gray-300 mt-2">点击左侧日历中带颜色的日期<br/>复盘当日大师情绪逻辑</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.aspect-square {
  aspect-ratio: 1 / 1;
}
</style>