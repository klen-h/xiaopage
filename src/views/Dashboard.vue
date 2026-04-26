<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useAnalysisStore } from '@/stores/analysis'
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Zap, 
  AlertCircle, 
  Loader2, 
  MousePointer2,
  // Activity,
  // Target,
  Brain,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-vue-next'
import { 
  getSentimentLabel, 
  getSentimentColorClass, 
  getSentimentHexColor, 
  getSentimentDescription,
  getLocalDateString,
  getLocalTimestampString
} from '@/utils/sentiment'
import * as echarts from 'echarts'
import { cloudbase } from '@/utils/tcb'

const analysisStore = useAnalysisStore()
const gaugeRef = ref<HTMLElement | null>(null)
const pieRef = ref<HTMLElement | null>(null)
const trendRef = ref<HTMLElement | null>(null)
let myChart: echarts.ECharts | null = null
let pieChart: echarts.ECharts | null = null
let trendChart: echarts.ECharts | null = null

const DISPLAY_LIMIT = 3

const availableDates = computed(() => analysisStore.availableDates)
const currentDayIndex = ref(-1)

const operationOptions = ['加仓', '减仓', '持仓不动', '清仓', '满仓']
const operationColorMap: Record<string, string> = {
  '加仓': '#f43f5e',
  '减仓': '#10b981',
  '持仓不动': '#6366f1',
  '清仓': '#94a3b8',
  '满仓': '#f59e0b'
}
const userVoted = ref(false)
const realTodayDate = getLocalDateString()
console.log('今日本地日期:', realTodayDate);

const isToday = computed(() => selectedDate.value === realTodayDate)
const isTradingDay = computed(() => {
  const day = new Date().getDay()
  return day !== 0 && day !== 6 // 0 is Sunday, 6 is Saturday
})

const operationStats = ref<Record<string, number>>({
  '加仓': 0,
  '减仓': 0,
  '持仓不动': 0,
  '清仓': 0,
  '满仓': 0
})

// 当数据加载完成或更新时，自动设置到最新一天
watch(availableDates, (newDates) => {
  if (newDates.length > 0 && currentDayIndex.value === -1) {
    currentDayIndex.value = newDates.length - 1
  }
}, { immediate: true })

const selectedDate = computed(() => {
  if (currentDayIndex.value === -1 || !availableDates.value[currentDayIndex.value]) return '加载中...'
  return availableDates.value[currentDayIndex.value]
})

// 监听日期变化，刷新投票数据
watch(selectedDate, (newDate) => {
  if (newDate && newDate !== '加载中...') {
    fetchOperationStats(newDate)
    analysisStore.fetchSectorDataByDate(newDate)
  }
})

// 获取指定日期操作统计
const fetchOperationStats = async (date?: string) => {
  const targetDate = date || selectedDate.value
  if (targetDate === '加载中...') return

  try {
    const { data, error } = await cloudbase
      .rdb()
      .from("user_operations")
      .select("*")
      .eq("date", targetDate)

    if (!error && data) {
      console.log(`获取到的 ${targetDate} 操作数据:`, data);
      const stats = { '加仓': 0, '减仓': 0, '持仓不动': 0, '清仓': 0, '满仓': 0 };
      
      data.forEach((item: any) => {
        if (item.date === targetDate && stats.hasOwnProperty(item.operation)) {
          stats[item.operation as keyof typeof stats]++;
        }
      });
      
      operationStats.value = stats;
      // 在 nextTick 后更新图表，确保容器已渲染
      nextTick(() => updatePieChart());
    } else if (error) {
      console.error('获取操作统计失败 (API 错误):', error);
    }
  } catch (err) {
    console.error('获取操作统计发生异常:', err);
  }
}

// 提交用户操作
const handleVote = async (op: string) => {
  if (userVoted.value || !isToday.value || !isTradingDay.value) return;
  try {
    const timestamp = getLocalTimestampString();
    
    const { error } = await cloudbase
      .rdb()
      .from("user_operations")
      .insert({
        operation: op,
        date: realTodayDate,
        timestamp: timestamp
      });

    if (!error) {
      console.log("新增成功");
      userVoted.value = true;
      localStorage.setItem(`voted_${realTodayDate}`, 'true');
      await fetchOperationStats(realTodayDate);
    } else {
      console.error("提交操作失败 (API 错误):", error);
    }
  } catch (err) {
    console.error('提交操作发生异常:', err);
  }
}

const updatePieChart = () => {
  if (pieRef.value) {
    if (!pieChart) {
      pieChart = echarts.init(pieRef.value)
    }
    
    const data = Object.entries(operationStats.value)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ 
        name, 
        value,
        itemStyle: { color: operationColorMap[name] || '#94a3b8' }
      }));
    
    pieChart.setOption({
      tooltip: { 
        trigger: 'item', 
        formatter: '{b}: {c} ({d}%)',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        textStyle: { color: '#1f2937' },
        borderWidth: 0,
        shadowBlur: 10,
        shadowColor: 'rgba(0,0,0,0.1)'
      },
      legend: {
        bottom: '0%',
        left: 'center',
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { fontSize: 10, color: '#9ca3af' }
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '40%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          emphasis: { label: { show: false } },
          data: data
        }
      ]
    }, true) // true means not merge, refresh completely
  }
}

const initTrendChart = () => {
  if (trendRef.value) {
    if (!trendChart) {
      trendChart = echarts.init(trendRef.value)
    }
    
    // 获取当日的所有视频，按时间排序展示情绪变化
    const sortedVideos = [...videosForDay.value].sort((a, b) => a.date.localeCompare(b.date))
    
    if (sortedVideos.length === 0) return;

    const data = sortedVideos.map(v => {
      const time = v.date.includes(' ') ? v.date.split(' ')[1].substring(0, 5) : '未知'
      return { time, score: v.sentiment_score, title: v.title }
    })

    const scoreColor = getSentimentHexColor(daySentimentScore.value)
    
    trendChart.setOption({
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const item = data[params[0].dataIndex]
          return `${item.time}<br/>${item.title}<br/>情绪分: ${item.score}%`
        },
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        textStyle: { color: '#1f2937' },
        borderWidth: 0,
        shadowBlur: 10,
        shadowColor: 'rgba(0,0,0,0.1)'
      },
      grid: {
        top: '15%',
        left: '5%',
        right: '5%',
        bottom: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: data.map(d => d.time),
        axisLine: { lineStyle: { color: '#f3f4f6' } },
        axisLabel: { color: '#9ca3af', fontSize: 10 },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
        axisLabel: { color: '#9ca3af', fontSize: 10 }
      },
      series: [{
        data: data.map(d => d.score),
        type: 'line',
        smooth: true,
        symbolSize: 8,
        itemStyle: { color: scoreColor },
        lineStyle: { width: 3, color: scoreColor },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: scoreColor + '44' },
            { offset: 1, color: scoreColor + '00' }
          ])
        }
      }]
    }, true)
  }
}
const videosForDay = computed(() => {
  if (currentDayIndex.value === -1) return []
  return analysisStore.getVideosByDate(selectedDate.value)
})

const dayLogicFactors = computed(() => {
  const factors: any[] = []
  const seen = new Set()
  
  videosForDay.value.forEach(video => {
    if (video.logic_factors) {
      video.logic_factors.forEach(factor => {
        const key = `${factor.factor_name}_${factor.direction}`
        if (!seen.has(key)) {
          factors.push(factor)
          seen.add(key)
        }
      })
    }
  })
  return factors.sort((a, b) => b.weight - a.weight) // 按权重排序
})

const displayedLogicFactors = computed(() => {
  return dayLogicFactors.value.slice(0, DISPLAY_LIMIT)
})

const daySentimentScore = computed(() => {
  if (videosForDay.value.length === 0) return 50
  const sum = videosForDay.value.reduce((acc, video) => acc + video.sentiment_score, 0)
  return Math.round(sum / videosForDay.value.length)
})

const initChart = () => {
  if (gaugeRef.value) {
    if (!myChart) {
      myChart = echarts.init(gaugeRef.value)
    }
    
    const scoreColor = getSentimentHexColor(daySentimentScore.value)
    
    myChart.setOption({
      series: [
        {
          type: 'gauge',
          center: ['50%', '60%'],
          startAngle: 180,
          endAngle: 0,
          min: 0,
          max: 100,
          itemStyle: {
            color: scoreColor
          },
          progress: {
            show: true,
            width: 12
          },
          pointer: { show: false },
          axisLine: {
            lineStyle: {
              width: 12,
              color: [[1, '#f3f4f6']]
            }
          },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          detail: {
            valueAnimation: true,
            width: '100%',
            lineHeight: 40,
            borderRadius: 8,
            offsetCenter: [0, -10],
            fontSize: 28,
            fontWeight: 'bold',
            formatter: '{value}%',
            color: 'inherit'
          },
          data: [{ value: daySentimentScore.value }]
        }
      ]
    })
  }
}

onMounted(() => {
  userVoted.value = localStorage.getItem(`voted_${realTodayDate}`) === 'true';
  
  // 如果数据已经就绪（非首次进入），直接初始化
  if (videosForDay.value.length > 0) {
    nextTick(() => {
      initChart();
      initTrendChart();
      fetchOperationStats(selectedDate.value);
    })
  }
  window.addEventListener('resize', () => {
    myChart?.resize();
    pieChart?.resize();
    trendChart?.resize();
  })
})

// 核心修复：监听数据加载状态，当加载完成切换到 v-else 分支后，确保 DOM 渲染完成再初始化图表
watch([() => analysisStore.isLoading, daySentimentScore], async ([isLoading]) => {
  if (!isLoading) {
    await nextTick()
    initChart()
    initTrendChart()
    fetchOperationStats(selectedDate.value)
  }
}, { immediate: true })

const goToNextDay = () => {
  if (currentDayIndex.value < availableDates.value.length - 1) {
    currentDayIndex.value++
  }
}

const goToPrevDay = () => {
  if (currentDayIndex.value > 0) {
    currentDayIndex.value--
  }
}

// const formatUpdateTime = (ts: number | null) => {
//   if (!ts) return ''
//   const date = new Date(ts)
//   return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
// }

// 统一由 utils/sentiment 提供逻辑，移除组件内的冗余代码
// const sectorsWithPerformance = computed(() => {
//   const daySectors = [...new Set(videosForDay.value.flatMap(v => v.structured.sectors || []))]
//   return daySectors.map(name => {
//     // 优先全等于，其次包含关系
//     const performance = analysisStore.sectorPerformance.find(p => p.name === name) || 
//                         analysisStore.sectorPerformance.find(p => p.name.includes(name) || name.includes(p.name))
//     return {
//       name,
//       performance: performance || null
//     }
//   }).sort((a, b) => (b.performance?.changePercent || 0) - (a.performance?.changePercent || 0))
// })
</script>

<template>
  <div v-if="analysisStore.isLoading && analysisStore.videos.length === 0" class="flex flex-col items-center justify-center py-20 space-y-4">
    <Loader2 class="w-10 h-10 animate-spin text-primary-600" />
    <p class="text-gray-500 font-medium">正在获取最新解析数据...</p>
  </div>
  <div v-else-if="analysisStore.error" class="flex flex-col items-center justify-center py-20 space-y-4">
    <AlertCircle class="w-10 h-10 text-red-500" />
    <p class="text-red-500 font-medium">数据加载失败: {{ analysisStore.error }}</p>
    <button @click="analysisStore.fetchVideos()" class="px-4 py-2 bg-primary-600 text-white rounded-xl shadow-sm hover:bg-primary-700 transition-colors">
      重试
    </button>
  </div>
  <div v-else class="space-y-6 lg:space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto pb-10">
    <!-- Date Navigation Header -->
    <div class="bg-white rounded-2xl lg:rounded-3xl p-4 lg:p-6 shadow-sm border border-gray-100 flex items-center justify-between sticky top-[72px] lg:top-4 z-30">
      <div class="flex items-center space-x-3 lg:space-x-4">
        <div class="w-10 h-10 lg:w-12 lg:h-12 bg-primary-50 rounded-xl lg:rounded-2xl flex items-center justify-center text-primary-600">
          <Calendar class="w-5 h-5 lg:w-6 lg:h-6" />
        </div>
        <div>
          <h2 class="text-lg lg:text-xl font-black text-gray-900">{{ selectedDate }}</h2>
          <p class="text-[10px] lg:text-xs text-gray-400 font-bold uppercase tracking-widest">今日解析聚合报告</p>
        </div>
      </div>
      
      <div class="flex items-center space-x-2">
        <button 
          @click="goToPrevDay"
          :disabled="currentDayIndex === 0"
          title="前一天 (较旧)"
          class="p-2 lg:p-3 rounded-lg lg:rounded-xl border border-gray-100 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft class="w-4 h-4 lg:w-5 lg:h-5 text-gray-600" />
        </button>
        <button 
          @click="goToNextDay"
          :disabled="currentDayIndex === availableDates.length - 1"
          title="后一天 (较新)"
          class="p-2 lg:p-3 rounded-lg lg:rounded-xl border border-gray-100 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronRight class="w-4 h-4 lg:w-5 lg:h-5 text-gray-600" />
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
      <!-- Left: Day Summary & Sentiment -->
      <div class="lg:col-span-1 space-y-6">
        <div class="bg-white rounded-2xl lg:rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col items-center">
          <h3 class="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">当日情绪温度</h3>
          <div ref="gaugeRef" class="w-full h-40"></div>
          <div class="text-center mt-[-10px] space-y-2">
            <span :class="['px-3 py-1 rounded-full text-sm font-bold border block w-fit mx-auto', getSentimentColorClass(daySentimentScore)]">
              {{ getSentimentLabel(daySentimentScore) }}
            </span>
            <p class="text-[10px] text-gray-400 font-medium italic">"{{ getSentimentDescription(daySentimentScore) }}"</p>
          </div>
        </div>

        <!-- 当日情绪趋势 -->
        <div v-if="videosForDay.length > 1" class="bg-white rounded-2xl lg:rounded-3xl p-6 shadow-sm border border-gray-100">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-2 text-gray-900">
              <TrendingUp class="w-4 h-4 text-primary-600" />
              <h3 class="text-sm font-black uppercase tracking-widest">当日情绪变化</h3>
            </div>
          </div>
          <div ref="trendRef" class="w-full h-40"></div>
        </div>

        <!-- 用户操作投票 -->
        <div class="bg-white rounded-2xl lg:rounded-3xl p-6 shadow-sm border border-gray-100">
          <div class="flex items-center space-x-2 mb-4 text-gray-900">
            <MousePointer2 class="w-4 h-4 text-primary-600" />
            <h3 class="text-sm font-black uppercase tracking-widest">{{ isToday ? '今日你的操作？' : '当日用户操作占比' }}</h3>
          </div>
          
          <!-- 情况1: 今天是交易日且未投票 -->
          <div v-if="isToday && isTradingDay && !userVoted" class="grid grid-cols-1 gap-2">
            <button 
              v-for="op in operationOptions" 
              :key="op"
              @click="handleVote(op)"
              class="w-full py-2 px-4 rounded-xl text-sm font-bold border border-gray-100 hover:bg-primary-50 hover:border-primary-200 transition-all text-gray-600 hover:text-primary-600 text-left flex justify-between items-center group"
            >
              {{ op }}
              <ChevronRight class="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
          
          <!-- 情况2: 今天是周末/休市 -->
          <div v-else-if="isToday && !isTradingDay" class="space-y-4">
            <div class="bg-gray-50 text-gray-500 p-3 rounded-xl text-[10px] font-bold flex items-center">
              <AlertCircle class="w-3 h-3 mr-2" />
              周末休市，暂不需要投票
            </div>
            <div v-if="!Object.values(operationStats).some(v => v > 0)" class="text-center py-4 text-gray-400 text-xs">
              今日暂无数据
            </div>
            <div ref="pieRef" class="w-full h-48"></div>
          </div>
          
          <!-- 情况3: 历史日期或已投票 -->
          <div v-else>
            <div v-if="isToday" class="bg-green-50 text-green-700 p-3 rounded-xl text-[10px] font-bold flex items-center">
              <Zap class="w-3 h-3 mr-2" />
              感谢参与！今日大家的操作占比：
            </div>
            <div ref="pieRef" class="w-full h-48"></div>
            <div v-if="!Object.values(operationStats).some(v => v > 0)" class="text-center text-gray-400 text-xs mt-0">
              该日期暂无用户投票数据
            </div>
          </div>
        </div>

        <div class="bg-gray-900 rounded-2xl lg:rounded-3xl p-6 text-white shadow-xl">
          <div class="flex items-center space-x-2 mb-4 text-primary-400">
            <Zap class="w-4 h-4" />
            <span class="text-xs font-black uppercase tracking-widest">当日总结</span>
          </div>
          <p class="text-sm text-gray-300 leading-relaxed font-medium">
            {{ videosForDay.length }} 条视频深度解析。
            主要关注：{{ [...new Set(videosForDay.flatMap(v => v.tags))].slice(0, 3).join('、') }} 等核心议题。
          </p>
        </div>

        <!-- 板块表现追踪 (Sector Performance Resonance) -->
        <!-- <div v-if="sectorsWithPerformance.length > 0" class="bg-white rounded-2xl lg:rounded-3xl p-6 shadow-sm border border-gray-100 overflow-hidden">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-2 text-gray-900">
              <Activity class="w-4 h-4 text-orange-500" />
              <h3 class="text-sm font-black uppercase tracking-widest">板块情绪追踪</h3>
              <span v-if="analysisStore.sectorUpdateTime" class="text-[9px] font-bold text-gray-300 bg-gray-50 px-1 rounded">
                SYNC: {{ formatUpdateTime(analysisStore.sectorUpdateTime) }}
              </span>
            </div>
            <router-link :to="`/sector-analysis?date=${selectedDate}`" class="text-[10px] font-black text-primary-600 hover:underline uppercase tracking-widest">
              更多
            </router-link>
          </div>

          <div class="space-y-3">
            <div v-for="sector in sectorsWithPerformance.slice(0, 3)" :key="sector.name" class="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 border border-gray-50 group hover:border-primary-100 transition-all">
              <div class="flex items-center space-x-3">
                <div class="p-2 bg-white rounded-lg shadow-sm">
                  <Target class="w-3.5 h-3.5 text-primary-600" />
                </div>
                <div>
                  <p class="text-xs font-black text-gray-900">{{ sector.name }}</p>
                  <p v-if="sector.performance" class="text-[9px] text-gray-400 font-bold uppercase">主力: {{ (sector.performance.mainInflow / 100000000).toFixed(2) }} 亿</p>
                  <p v-else class="text-[9px] text-gray-400 font-bold uppercase">未匹配行情数据</p>
                </div>
              </div>
              
              <div v-if="sector.performance" class="text-right">
                <p :class="['text-xs font-black', sector.performance.changePercent >= 0 ? 'text-red-600' : 'text-green-600']">
                  {{ sector.performance.changePercent >= 0 ? '+' : '' }}{{ sector.performance.changePercent }}%
                </p>
                <div class="w-16 h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                  <div 
                    :class="['h-full transition-all duration-1000', sector.performance.changePercent >= 0 ? 'bg-red-500' : 'bg-green-500']"
                    :style="{ width: Math.min(Math.abs(sector.performance.changePercent) * 10, 100) + '%' }"
                  ></div>
                </div>
              </div>
              <div v-else class="text-[9px] font-black text-gray-300 italic">
                等待数据对撞...
              </div>
            </div>
          </div>
          
          <div class="mt-4 pt-3 border-t border-gray-50 flex items-center justify-center">
            <router-link :to="`/sector-analysis?date=${selectedDate}`" class="text-[10px] font-black text-primary-600 hover:underline uppercase tracking-widest flex items-center">
              查看全部 {{ sectorsWithPerformance.length }} 个板块表现
              <ChevronRight class="w-3 h-3 ml-0.5" />
            </router-link>
          </div>
        </div> -->

        <!-- 思维地图 (Thinking Map) -->
        <div v-if="dayLogicFactors.length > 0" class="bg-white rounded-2xl lg:rounded-3xl p-6 shadow-sm border border-gray-100">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-2 text-gray-900">
              <Brain class="w-4 h-4 text-primary-600" />
              <h3 class="text-sm font-black uppercase tracking-widest">思维地图</h3>
            </div>
            <div class="flex items-center space-x-3">
              <span v-if="dayLogicFactors.length > DISPLAY_LIMIT" class="text-[10px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-md">
                共 {{ dayLogicFactors.length }} 项
              </span>
              <router-link :to="`/logic-factors?date=${selectedDate}`" class="text-[10px] font-black text-primary-600 hover:underline uppercase tracking-widest">
                更多
              </router-link>
            </div>
          </div>
          
          <div class="space-y-4">
            <div v-for="(factor, idx) in displayedLogicFactors" :key="idx" class="group animate-in fade-in slide-in-from-top-2 duration-300">
              <div class="flex items-start space-x-3">
                <div :class="[
                  'mt-0.5 p-1.5 rounded-lg shrink-0',
                  factor.direction === '看涨' ? 'bg-red-50 text-red-600' : 
                  factor.direction === '看跌' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-600'
                ]">
                  <TrendingUp v-if="factor.direction === '看涨'" class="w-3.5 h-3.5" />
                  <TrendingDown v-else-if="factor.direction === '看跌'" class="w-3.5 h-3.5" />
                  <Minus v-else class="w-3.5 h-3.5" />
                </div>
                <div class="space-y-1 flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-2 min-w-0">
                      <span class="text-sm font-black text-gray-900 truncate">{{ factor.factor_name }}</span>
                      <span :class="[
                        'text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-tighter shrink-0',
                        factor.direction === '看涨' ? 'bg-red-100 text-red-700' : 
                        factor.direction === '看跌' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      ]">
                        {{ factor.direction }}
                      </span>
                    </div>
                    <div class="text-[10px] font-bold text-gray-400 shrink-0 ml-2">{{ (factor.weight * 100).toFixed(0) }}%</div>
                  </div>
                  <div class="flex items-center space-x-2">
                    <span class="text-[10px] font-black text-primary-600 bg-primary-50 px-1.5 rounded truncate">数值: {{ factor.factor_value }}</span>
                  </div>
                  <p class="text-xs text-gray-500 leading-relaxed font-medium mt-1">{{ factor.description }}</p>
                </div>
              </div>
              <div v-if="idx !== displayedLogicFactors.length - 1" class="ml-9 mt-4 border-b border-gray-50"></div>
            </div>
          </div>

          <!-- Expand/Collapse Button -->
          <router-link 
            v-if="dayLogicFactors.length > DISPLAY_LIMIT"
            :to="`/logic-factors?date=${selectedDate}`"
            class="w-full mt-4 py-2 border-t border-gray-50 flex items-center justify-center space-x-1 group transition-colors"
          >
            <span class="text-[10px] font-bold text-gray-400 group-hover:text-primary-600 uppercase tracking-widest">
              查看全部 {{ dayLogicFactors.length }} 项思维逻辑
            </span>
            <ChevronRight class="w-3 h-3 text-gray-300 group-hover:text-primary-600 transition-transform duration-300" />
          </router-link>
        </div>
      </div>

      <!-- Right: Timeline of Videos -->
      <div class="lg:col-span-3 space-y-6 relative">
        <!-- Timeline Line -->
        <div class="absolute left-8 top-4 bottom-4 w-0.5 bg-gray-100 hidden md:block"></div>

        <div v-for="video in videosForDay" :key="video.id" class="relative pl-0 md:pl-16 group">
          <!-- Timeline Dot -->
          <div class="absolute left-[30px] top-8 w-4 h-4 rounded-full border-4 border-white bg-primary-500 shadow-sm z-10 hidden md:block group-hover:scale-125 transition-transform"></div>

          <div class="bg-white rounded-2xl lg:rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div class="flex flex-col space-y-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <span class="flex items-center text-[10px] lg:text-xs text-gray-400">
                    <Calendar class="w-3 h-3 mr-1" />
                    {{ video.date }}
                  </span>
                </div>
                <div :class="['px-2.5 py-0.5 lg:px-3 lg:py-1 rounded-full text-[10px] lg:text-xs font-bold border', getSentimentColorClass(video.sentiment_score)]">
                  {{ getSentimentLabel(video.sentiment_score) }}
                </div>
              </div>

              <h3 class="text-lg lg:text-xl font-bold text-gray-900 group-hover:text-primary-600 transition-colors">
                {{ video.title }}
              </h3>

              <p class="text-gray-600 leading-relaxed text-sm">
                {{ video.summary }}
              </p>

              <div class="flex flex-wrap gap-2 pt-2">
                <span v-for="tag in video.tags" :key="tag" class="px-2 py-0.5 bg-gray-50 text-gray-500 rounded text-[10px] font-medium border border-gray-100">
                  #{{ tag }}
                </span>
              </div>

              <div class="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div v-if="video.deep_analysis.strategy" class="flex items-center space-x-2 text-primary-600 bg-primary-50 px-3 py-1.5 rounded-xl border border-primary-100 w-fit">
                  <Zap class="w-3 h-3" />
                  <span class="text-[10px] font-bold">核心策略：{{ video.deep_analysis.strategy.split('（')[0] }}</span>
                </div>
                <router-link :to="'/analysis/' + video.id" class="flex items-center text-sm font-bold text-gray-900 hover:text-primary-600 transition-colors flex-shrink-0 self-end sm:self-auto">
                  详情报告
                  <ChevronRight class="ml-1 w-4 h-4" />
                </router-link>
              </div>
            </div>
          </div>
        </div>

        <!-- No Data State -->
        <div v-if="videosForDay.length === 0" class="bg-white rounded-2xl lg:rounded-3xl p-12 lg:p-20 border border-dashed border-gray-300 flex flex-col items-center justify-center text-center">
          <AlertCircle class="w-10 h-10 lg:w-12 lg:h-12 text-gray-200 mb-4" />
          <p class="text-gray-500 font-medium">该日期暂无视频解析数据</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sticky {
  position: sticky;
  top: 1.5rem;
}
</style>
