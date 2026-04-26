<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { useAnalysisStore } from '@/stores/analysis'
import { getSentimentLabel } from '@/utils/sentiment'
import * as echarts from 'echarts'
import { 
  Activity, 
  ChevronRight,
  TrendingUp as TrendingUpIcon,
  HelpCircle,
  AlertTriangle,
  ShieldAlert,
  Target,
  BarChart3
} from 'lucide-vue-next'

const analysisStore = useAnalysisStore()
const sentimentChartRef = ref<HTMLElement | null>(null)
const hitRateChartRef = ref<HTMLElement | null>(null)
let sentimentChart: echarts.ECharts | null = null
let hitRateChart: echarts.ECharts | null = null

const stats = computed(() => [
  { label: '累计解析视频', value: analysisStore.videos.length, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
  { label: '观点命中率', value: analysisStore.getHitRateStats.rate + '%', icon: Target, color: 'text-green-600', bg: 'bg-green-50' },
  { label: '当前市场温度', value: getSentimentLabel(analysisStore.getCurrentMarketTemperature), icon: TrendingUpIcon, color: 'text-orange-600', bg: 'bg-orange-50' },
])

const sectorStats = computed(() => analysisStore.getSectorStats)
const highRiskVideos = computed(() => analysisStore.getHighRiskVideos.slice(0, 3))

const initCharts = () => {
  // 情绪与行情对标走势图
  if (sentimentChartRef.value) {
    if (!sentimentChart) sentimentChart = echarts.init(sentimentChartRef.value)
    
    const correlationData = analysisStore.getTrendCorrelation
    
    sentimentChart.setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params: any) => {
          let res = `<div class="font-bold mb-1">${params[0].name}</div>`
          params.forEach((p: any) => {
            const hasValue = p.value !== null && p.value !== undefined
            const displayValue = hasValue ? p.value : '休市/无数据'
            res += `<div class="flex items-center justify-between space-x-4">
              <span class="flex items-center">${p.marker} ${p.seriesName}</span>
              <span class="font-bold" style="color:${p.color}">${displayValue}</span>
            </div>`
          })
          return res
        }
      },
      legend: { data: ['情绪温度', '上证指数'], bottom: '0%' },
      grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        data: correlationData.map((d: { date: any }) => d.date),
        axisLine: { lineStyle: { color: '#f3f4f6' } },
        axisLabel: { color: '#9ca3af', fontSize: 10 }
      },
      yAxis: [
        {
          type: 'value',
          name: '情绪',
          min: 0,
          max: 100,
          splitLine: { show: false },
          axisLabel: { color: '#6366f1' }
        },
        {
          type: 'value',
          name: '指数',
          scale: true,
          splitLine: { lineStyle: { color: '#f3f4f6' } },
          axisLabel: { color: '#f59e0b' }
        }
      ],
      series: [
        {
          name: '情绪温度',
          type: 'line',
          smooth: true,
          connectNulls: true, // 开启断点连接，使曲线更美观
          data: correlationData.map((d: { sentiment: any }) => d.sentiment),
          itemStyle: { color: '#6366f1' },
          lineStyle: { width: 3 }
        },
        {
          name: '上证指数',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          connectNulls: true, // 开启断点连接，解决休市期间连线断开问题
          data: correlationData.map((d: { marketClose: any }) => d.marketClose),
          itemStyle: { color: '#f59e0b' },
          lineStyle: { width: 3, type: 'dashed' }
        }
      ]
    }, true)
  }

  // 命中率饼图
  if (hitRateChartRef.value) {
    if (!hitRateChart) hitRateChart = echarts.init(hitRateChartRef.value)
    
    const hitStats = analysisStore.getHitRateStats
    
    hitRateChart.setOption({
      tooltip: { trigger: 'item' },
      legend: { bottom: '0%', left: 'center', icon: 'circle', itemWidth: 10, textStyle: { fontSize: 12 } },
      series: [{
        name: '观点预测',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        data: [
          { value: hitStats.hit, name: '已兑现 (Hit)', itemStyle: { color: '#10b981' } },
          { value: hitStats.miss, name: '未兑现 (Miss)', itemStyle: { color: '#f43f5e' } },
          { value: hitStats.pending, name: '待验证', itemStyle: { color: '#94a3b8' } }
        ]
      }]
    })
  }
}

onMounted(() => {
  // 首次进入时，如果数据已加载，直接初始化
  if (!analysisStore.isLoading && analysisStore.videos.length > 0) {
    nextTick(() => initCharts())
  }
  window.addEventListener('resize', () => {
    sentimentChart?.resize()
    hitRateChart?.resize()
  })
})

// 核心修复：监听加载状态。刷新页面时，isLoading 会从 true 变为 false
watch(() => analysisStore.isLoading, (isLoading) => {
  if (!isLoading && analysisStore.videos.length > 0) {
    nextTick(() => initCharts())
  }
})

// 同时监听数据变化，确保数据更新时图表同步
watch(() => analysisStore.videos, (videos) => {
  if (!analysisStore.isLoading && videos.length > 0) {
    nextTick(() => initCharts())
  }
}, { deep: true })
</script>

<template>
  <div class="space-y-8 animate-in fade-in duration-500 pb-10">
    <!-- Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div v-for="stat in stats" :key="stat.label" class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center space-x-6 group hover:shadow-lg transition-all">
        <div :class="['p-4 rounded-xl transition-transform group-hover:scale-110 duration-300', stat.bg, stat.color]">
          <component :is="stat.icon" class="w-6 h-6" />
        </div>
        <div>
          <p class="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{{ stat.label }}</p>
          <p class="text-2xl font-black text-gray-900">{{ stat.value }}</p>
        </div>
      </div>
    </div>

    <!-- Charts Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <section class="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col min-h-[450px]">
        <div class="flex items-center justify-between mb-8">
          <div class="flex items-center space-x-3">
            <div class="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <TrendingUpIcon class="w-5 h-5" />
            </div>
            <div>
              <h3 class="text-xl font-bold text-gray-900">情绪演变曲线</h3>
              <p class="text-sm text-gray-500 mt-1">每日平均视频情绪波动趋势</p>
            </div>
          </div>
        </div>
        <div ref="sentimentChartRef" class="w-full flex-1"></div>
      </section>

      <section class="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col min-h-[450px]">
        <div class="flex items-center justify-between mb-8">
          <div class="flex items-center space-x-3">
            <div class="p-2 bg-green-50 text-green-600 rounded-lg">
              <BarChart3 class="w-5 h-5" />
            </div>
            <div>
              <h3 class="text-xl font-bold text-gray-900">预测命中率统计</h3>
              <p class="text-sm text-gray-500 mt-1">核心观点兑现情况分布</p>
            </div>
          </div>
          <div class="relative group">
            <HelpCircle class="w-5 h-5 text-gray-300 cursor-help" />
            <div class="absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[100] font-medium leading-relaxed">
              <p class="font-bold mb-1 text-primary-400">命中规则说明：</p>
              <p>1. <span class="text-green-400">命中 (Hit)</span>：当日平均情绪分 ≥ 56 且上证上涨；或情绪分 ≤ 44 且上证下跌。</p>
              <p class="mt-1">2. <span class="text-red-400">失误 (Miss)</span>：当日平均情绪分与指数涨跌完全相反。</p>
              <p class="mt-1 text-gray-400">3. 待验证：当日休市、无行情数据或情绪分处于中性区间 (45-55)。</p>
              <!-- Tooltip Arrow -->
              <div class="absolute top-full right-2 border-8 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        </div>
        <div ref="hitRateChartRef" class="w-full flex-1"></div>
      </section>
    </div>

    <!-- Dynamic Sector Insights -->
    <section class="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h3 class="text-xl font-bold text-gray-900">板块情绪热力图</h3>
          <p class="text-sm text-gray-500 mt-1">基于 AI 提取的各板块观点提及频率与情绪分值</p>
        </div>
        <div class="flex items-center space-x-2 flex-shrink-0">
          <span class="flex items-center text-xs text-gray-400">
            <span class="w-2 h-2 rounded-full bg-red-500 mr-1.5"></span> 看多
          </span>
          <span class="flex items-center text-xs text-gray-400">
            <span class="w-2 h-2 rounded-full bg-blue-500 mr-1.5"></span> 看空
          </span>
        </div>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div 
          v-for="sector in sectorStats" 
          :key="sector.name"
          class="flex flex-col items-center justify-center p-6 bg-gray-50 border border-gray-100 rounded-2xl transition-all hover:scale-105 hover:bg-white hover:shadow-md group cursor-pointer"
        >
          <span class="text-sm font-bold mb-3 text-gray-700 group-hover:text-primary-600">{{ sector.name }}</span>
          <div class="w-full bg-gray-200 h-2 rounded-full overflow-hidden mb-2">
            <div 
              :class="['h-full rounded-full transition-all duration-1000', sector.averageScore >= 56 ? 'bg-red-500' : (sector.averageScore >= 46 ? 'bg-orange-500' : (sector.averageScore >= 36 ? 'bg-yellow-500' : 'bg-blue-500'))]"
              :style="{ width: sector.heat + '%' }"
            ></div>
          </div>
          <div class="flex flex-col items-center">
            <span class="text-[10px] font-black uppercase tracking-widest" :class="sector.averageScore >= 56 ? 'text-red-600' : (sector.averageScore >= 46 ? 'text-orange-600' : (sector.averageScore >= 36 ? 'text-yellow-600' : 'text-blue-600'))">
              {{ getSentimentLabel(sector.averageScore) }}
            </span>
            <span class="text-[10px] text-gray-400 mt-1 font-bold">{{ sector.count }} 次提及</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Risk Center (Lightning Rod) -->
    <section class="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
      <div class="flex items-center justify-between mb-8">
        <div class="flex items-center space-x-3">
          <div class="p-3 bg-red-50 text-red-600 rounded-2xl">
            <ShieldAlert class="w-6 h-6" />
          </div>
          <div>
            <h3 class="text-xl font-bold text-gray-900">高风险信号库 (避雷针)</h3>
            <p class="text-sm text-gray-500 mt-1">集中展示免责等级高或情绪极度悲观的预警视频</p>
          </div>
        </div>
        <router-link to="/videos" class="text-sm font-bold text-primary-600 hover:text-primary-700 flex items-center flex-shrink-0">
          查看全部
          <ChevronRight class="ml-1 w-4 h-4" />
        </router-link>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div 
          v-for="video in highRiskVideos" 
          :key="video.id" 
          class="flex flex-col p-6 rounded-2xl border border-red-50 bg-white hover:shadow-lg transition-all relative overflow-hidden group"
        >
          <!-- Risk Level Indicator -->
          <div class="absolute -right-4 -top-4 w-16 h-16 bg-red-50 rounded-full opacity-50 group-hover:scale-150 transition-transform"></div>
          
          <div class="relative z-10 flex flex-col h-full">
            <div class="flex items-center justify-between mb-4">
              <span class="text-xs font-black text-red-600 uppercase tracking-widest flex items-center">
                <AlertTriangle class="w-3 h-3 mr-1.5" />
                风险指数 {{ video.disclaimer_level }}
              </span>
              <span class="text-xs text-gray-400 font-medium">{{ video.date }}</span>
            </div>
            
            <h4 class="text-lg font-bold text-gray-900 mb-3 line-clamp-2">{{ video.title }}</h4>
            <p class="text-sm text-gray-500 line-clamp-3 mb-6 flex-1">{{ video.summary }}</p>
            
            <div class="flex items-center justify-between mt-auto">
              <div class="flex space-x-1">
                <div v-for="i in 5" :key="i" class="w-2 h-2 rounded-full" :class="i <= video.disclaimer_level ? 'bg-red-500' : 'bg-gray-100'"></div>
              </div>
              <router-link :to="'/analysis/' + video.id" class="text-xs font-black text-primary-600 uppercase tracking-widest hover:underline">
                深度研判
              </router-link>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Bottom: Suggestion Module (Mocked) -->
    <!-- <div class="bg-gray-900 rounded-3xl p-8 text-white relative overflow-hidden">
      <div class="absolute right-0 top-0 opacity-10">
        <History class="w-64 h-64" />
      </div>
      <div class="relative z-10 max-w-2xl">
        <div class="flex items-center space-x-2 mb-4 text-primary-400">
          <Zap class="w-4 h-4" />
          <span class="text-xs font-black uppercase tracking-widest">规划中的业务</span>
        </div>
        <h3 class="text-2xl font-bold mb-4">“历史规律复盘” (Backtesting)</h3>
        <p class="text-gray-400 leading-relaxed mb-8">
          我们将引入历史点位关联分析系统，将当前的市场信号（如 SpaceX IPO、油价 140 美元）与 6124 点、3731 点等历史大顶进行自动拟合，生成“历史相似度报告”，辅助投资者进行风险决策。
        </p>
        <button class="px-8 py-3 bg-primary-600 hover:bg-primary-500 rounded-xl font-bold transition-all shadow-lg shadow-primary-900/50 flex items-center">
          开启内测申请
          <ChevronRight class="ml-2 w-4 h-4" />
        </button>
      </div>
    </div> -->
  </div>
</template>
