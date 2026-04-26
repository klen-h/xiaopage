<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { fetchAutomationData } from '@/api/github'
import { 
  Search, 
  // TrendingUp, 
  // TrendingDown, 
  Activity, 
  ShieldCheck, 
  Zap, 
  AlertCircle,
  BarChart3,
  Info,
  Target,
  // ArrowRight,
  RefreshCw,
  Gem
} from 'lucide-vue-next'
import { fetchStockQuote, fetchStockFlow, type StockQuote, type StockFlow } from '@/utils/market'
import { valuePoolStocks, presetStocks } from '@/constants/stocks'

const searchQuery = ref('')
const isLoading = ref(false)
const error = ref('')

const marketTrend = ref<'BULL' | 'BEAR' | 'NEUTRAL'>('NEUTRAL')
const automationReport = ref<any>(null)
const allStocks = ref<any[]>([])
const activeTab = ref<'GOOD' | 'GROWTH'>('GOOD')

// 动态计算好股票榜 (李大霄逻辑：低估值、高ROE、白马蓝筹)
const topGood = computed(() => {
  return [...allStocks.value]
    .filter(s => {
      // 1. 估值门槛：PE < 25 且 PB < 3
      const isCheap = s.pe < 25 && s.pb < 3;
      // 2. 质量门槛：ROE > 8%
      const isQuality = s.roe > 8;
      // 3. 安全性：市值 > 100亿 (已经在 Python 初筛过)
      return isCheap && isQuality;
    })
    .sort((a, b) => b.score_balanced - a.score_balanced)
    .slice(0, 10)
})

// 动态计算优质成长榜 (业绩好、成长性高)
const topGrowth = computed(() => {
  return [...allStocks.value]
    .filter(s => {
      // 1. 成长门槛：利润增速 > 10% 且 营收增速 > 0
      const isGrowing = s.profit_growth > 10 && s.revenue_growth > 0;
      // 2. 质量配合：ROE > 10% 且 毛利率 > 15%
      const isSolid = s.roe > 10 && (s.gross_margin || 0) > 15;
      // 3. 估值宽容度：PE < 45 (成长股可以稍贵，但不能太离谱)
      return isGrowing && isSolid && s.pe < 45;
    })
    .sort((a, b) => b.score_growth - a.score_growth)
    .slice(0, 10)
})

const state = reactive({
  quote: null as StockQuote | null,
  flow: null as StockFlow | null
})

// 加载自动化报告
const loadAutomationReport = async () => {
  const data = await fetchAutomationData('latest_report.json')
  if (data) {
    automationReport.value = data
    marketTrend.value = data.market?.trend || 'NEUTRAL'
    allStocks.value = data.all_stocks || []
  }
}

onMounted(async () => {
  await loadAutomationReport()
  // 如果自动化报告加载失败，则回退到基础行情判断
  if (!automationReport.value) {
    // 回退：简单判断市场趋势
    const trend: 'BULL' | 'BEAR' | 'NEUTRAL' = 'NEUTRAL'
    marketTrend.value = trend
  }
})

// 抄底减仓清仓预警逻辑
const warningSignal = computed(() => {
  if (!state.quote) return null
  
  const { pe, pb, price, high52, low52, changePercent } = state.quote
  const isBull = marketTrend.value === 'BULL'
  
  // 1. 抄底预警 (Diamond Bottom)
  const pos = (price - low52!) / (high52! - low52!)
  if (pos < 0.1 && pe < 12) {
    return { type: 'BOTTOM', label: '抄底预警', color: 'text-red-600 bg-red-50 border-red-200', desc: '股价处于绝对底部区域且估值极低，具备钻石底特征。' }
  }
  
  // 2. 减仓预警
  if (isBull && pos > 0.85 && pe > 25) {
    return { type: 'REDUCE', label: '减仓预警', color: 'text-orange-600 bg-orange-50 border-orange-200', desc: '股价接近52周高点且估值偏高，牛市亦需注意阶段性回调。' }
  }
  
  // 3. 清仓预警
  if (pos > 0.95 && pe > 40) {
    return { type: 'EXIT', label: '清仓预警', color: 'text-gray-600 bg-gray-100 border-gray-300', desc: '估值极度泡沫化，远离“五类股”，保住利润。' }
  }
  
  return null
})

const handleSearch = async () => {
  if (!searchQuery.value.trim()) return
  
  isLoading.value = true
  error.value = ''
  state.quote = null
  state.flow = null
  
  try {
    const [quote, flow] = await Promise.all([
      fetchStockQuote(searchQuery.value),
      fetchStockFlow(searchQuery.value)
    ])
    
    if (quote) {
      state.quote = quote
      state.flow = flow
    } else {
      error.value = '未找到该股票，请检查代码是否正确（如：600036 或 sz000001）'
    }
  } catch (err) {
    error.value = '获取数据失败，请稍后再试'
  } finally {
    isLoading.value = false
  }
}

const radarResults = ref<any[]>([])
const isScanning = ref(false)

const runRadarScan = async () => {
  isScanning.value = true
  radarResults.value = []
  
  try {
    const results = await Promise.all(
      valuePoolStocks.map(async (stock) => {
        const quote = await fetchStockQuote(stock.code)
        if (!quote) return null
        
        let score = 0
        let signals = []
        const isCore = stock.type === 'CORE'

        // 基础估值分 (权重调整)
        if (quote.pe > 0 && quote.pe < (isCore ? 12 : 20)) score += 30
        if (quote.pb > 0 && quote.pb < (isCore ? 1.2 : 2.5)) score += 20
        
        // 52周新低附近大幅加分 (钻石底)
        if (quote.high52 && quote.low52) {
          const range = quote.high52 - quote.low52
          const pos = (quote.price - quote.low52) / range
          if (pos < 0.15) {
            score += 40
            signals.push('底部区域')
          }
        }

        if (isCore) {
          // 核心资产逻辑：稳健为王
          if (Math.abs(quote.changePercent) < 1.5) {
            score += 20
            signals.push('走势稳健')
          }
          if (quote.pe > 0 && quote.pe < 10) {
            score += 30
            signals.push('长线价值')
          }
        } else {
          // 卫星资产逻辑：弹性与洗盘
          // 暴力洗盘侦测
          if (quote.changePercent < -2.0 && quote.pe < 25) {
            score += 50
            signals.push('暴力洗盘')
          } else if (quote.changePercent > 2.0) {
            score += 20
            signals.push('短线动能')
          }
          if (quote.turnover > 3) {
            signals.push('活跃度高')
          }
        }

        return {
          ...quote,
          type: stock.type,
          sector: stock.sector,
          score,
          signals: [...new Set(signals)]
        }
      })
    )
    
    const validResults = results.filter((r): r is any => r !== null)
    
    // 卫星持股法：混合选股 (4个核心 + 4个卫星)
    const cores = validResults
      .filter(r => r.type === 'CORE')
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      
    const satellites = validResults
      .filter(r => r.type === 'SATELLITE')
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)

    radarResults.value = [...cores, ...satellites].sort((a, b) => b.score - a.score)
  } catch (err) {
    console.error('Radar scan failed:', err)
  } finally {
    isScanning.value = false
  }
}

const loadPreset = (code: string) => {
  searchQuery.value = code
  handleSearch()
}

// 价值评估逻辑
const valueEvaluation = computed(() => {
  if (!state.quote) return null
  
  const { pe, pb } = state.quote
  const results = []
  let score = 0
  
  // 1. PE 评估 (参考大霄标准：低估值是硬道理)
  if (pe > 0 && pe < 10) {
    results.push({ label: '市盈率 (PE)', status: 'excellent', desc: `PE仅${pe}，极具吸引力的“钻石底”特征。` })
    score += 40
  } else if (pe > 0 && pe < 20) {
    results.push({ label: '市盈率 (PE)', status: 'good', desc: `PE为${pe}，处于合理偏低区间，具备价值底色。` })
    score += 25
  } else {
    results.push({ label: '市盈率 (PE)', status: 'warning', desc: `PE为${pe}，估值偏高，需警惕“五类股”风险。` })
  }
  
  // 2. PB 评估
  if (pb > 0 && pb < 1) {
    results.push({ label: '市净率 (PB)', status: 'excellent', desc: `PB仅${pb}，处于破净或边缘，安全边际极高。` })
    score += 30
  } else if (pb > 0 && pb < 1.5) {
    results.push({ label: '市净率 (PB)', status: 'good', desc: `PB为${pb}，属于低市净率好股票。` })
    score += 20
  } else {
    results.push({ label: '市净率 (PB)', status: 'warning', desc: `PB为${pb}，溢价较高，非传统价值投资首选。` })
  }

  // 3. 价格空间评估 (基于52周高低点)
  if (state.quote.high52 && state.quote.low52) {
    const { price, high52, low52 } = state.quote
    const range = high52 - low52
    const currentPos = (price - low52) / range
    
    if (currentPos < 0.2) {
      results.push({ label: '底部空间', status: 'excellent', desc: `价格接近52周最低点，底部形态初现，“钻石底”特征显著。` })
      score += 40
    } else if (currentPos > 0.8) {
      results.push({ label: '价格高位', status: 'warning', desc: `价格接近52周最高点，需警惕高位回调风险。` })
    }
  }

  // 4. 资金面 (主力流向)
  if (state.flow) {
    const { mainInflow } = state.flow
    if (mainInflow > 0) {
      results.push({ label: '资金面', status: 'good', desc: `主力资金净流入${mainInflow.toFixed(0)}万，大资金正在“播种”。` })
      score += 30
    } else if (pe > 0 && pe < 15 && state.quote.changePercent < -1.5) {
      results.push({ label: '洗盘特征', status: 'excellent', desc: `低估值+大跌+主力流出，呈现典型“暴力洗盘”诱空特征。` })
      score += 40
    } else {
      results.push({ label: '资金面', status: 'warning', desc: `主力资金净流出${Math.abs(mainInflow).toFixed(0)}万，短期情绪偏谨慎。` })
    }
  }
  
  return { results, score, summary: score >= 60 ? '符合价值投资标准' : '需谨慎观察' }
})

const getStatusColor = (status: string) => {
  if (status === 'excellent') return 'text-red-600 bg-red-50 border-red-100'
  if (status === 'good') return 'text-orange-600 bg-orange-50 border-orange-100'
  return 'text-gray-500 bg-gray-50 border-gray-100'
}

const getScoreColor = (score: number) => {
  if (score >= 80) return 'text-red-600'
  if (score >= 60) return 'text-orange-600'
  return 'text-gray-400'
}
</script>

<template>
  <div class="space-y-6 lg:space-y-8 animate-in fade-in duration-500 pb-10 max-w-5xl mx-auto px-4">
    <!-- Header -->
    <header class="bg-gradient-to-br from-red-600 to-red-800 rounded-2xl lg:rounded-3xl p-6 lg:p-10 text-white overflow-hidden shadow-xl relative">
      <div class="absolute right-0 top-0 opacity-10 pointer-events-none">
        <Gem class="w-48 h-48 lg:w-80 lg:h-80 -mr-10 lg:-mr-20 -mt-10 lg:-mt-20 rotate-12" />
      </div>
      <div class="relative z-10 max-w-2xl">
        <div class="flex items-center space-x-3 mb-4">
          <div class="p-2 bg-white/20 backdrop-blur-md rounded-xl">
            <ShieldCheck class="w-5 h-5 lg:w-6 lg:h-6 text-white" />
          </div>
          <span class="text-[10px] lg:text-sm font-black uppercase tracking-widest text-red-100">大霄式价值投资</span>
        </div>
        <h1 class="text-2xl lg:text-4xl font-black mb-3 lg:mb-4">“好股票”估值探测器</h1>
        <p class="text-red-100 text-sm lg:text-lg leading-relaxed font-medium">
          践行“余钱投资、理性投资、价值投资”。输入股票代码，实时探测其是否具备“钻石底”基因，远离“五类股”。
        </p>
      </div>
    </header>

    <!-- Value Radar & Discovery -->
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <Activity class="w-5 h-5 text-red-600" />
          <h3 class="text-lg font-black text-gray-900">自动化价值扫描 (AI 筛选)</h3>
          <div v-if="automationReport" class="flex items-center space-x-2">
            <span class="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full text-gray-400 font-bold">
              更新: {{ automationReport.update_date }}
            </span>
            <span class="text-[10px] bg-blue-50 px-2 py-0.5 rounded-full text-blue-400 font-bold">
              初筛: {{ automationReport.candidates_count?.value + automationReport.candidates_count?.growth }} 只
            </span>
            <span class="text-[10px] bg-red-50 px-2 py-0.5 rounded-full text-red-400 font-bold">
              深度扫描: {{ allStocks.length }} 只
            </span>
          </div>
        </div>
        <div class="flex items-center space-x-2">
          <button 
            @click="loadAutomationReport"
            class="px-4 py-2 bg-gray-50 text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-all text-xs"
          >
            同步最新报告
          </button>
          <button 
            @click="runRadarScan"
            :disabled="isScanning"
            class="flex items-center space-x-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-all disabled:opacity-50"
          >
            <RefreshCw :class="['w-4 h-4', isScanning ? 'animate-spin' : '']" />
            <span>{{ isScanning ? '实时探测...' : '开启实时探测' }}</span>
          </button>
        </div>
      </div>

      <!-- Tab Headers -->
      <div v-if="topGood.length > 0 || topGrowth.length > 0" class="flex items-center space-x-1 bg-gray-100/50 p-1 rounded-xl w-fit">
        <button 
          @click="activeTab = 'GOOD'"
          :class="[
            'px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center space-x-2',
            activeTab === 'GOOD' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
          ]"
        >
          <Gem class="w-3.5 h-3.5" />
          <span>🏆 好股票榜</span>
        </button>
        <button 
          @click="activeTab = 'GROWTH'"
          :class="[
            'px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center space-x-2',
            activeTab === 'GROWTH' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
          ]"
        >
          <Zap class="w-3.5 h-3.5" />
          <span>🚀 优质成长</span>
        </button>
      </div>

      <!-- Top Picks (Tab Content) -->
      <div v-if="activeTab === 'GOOD' && topGood.length > 0" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-in fade-in slide-in-from-top-2">
        <div 
          v-for="stock in topGood" 
          :key="stock.code"
          @click="loadPreset(stock.code.split('.')[0])"
          class="bg-white border border-gray-100 rounded-2xl p-4 hover:border-red-200 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
        >
          <div class="absolute top-0 right-0 px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter rounded-bl-lg bg-red-600 text-white">
            均衡分: {{ stock.score_balanced }}
          </div>
          <div class="flex justify-between items-start mb-2 pr-6">
            <div>
              <p class="text-sm font-black text-gray-900 truncate max-w-[80px]">{{ stock.name }}</p>
              <p class="text-[10px] text-gray-400 font-bold uppercase">{{ stock.code }}</p>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-x-2 gap-y-1 mt-2">
            <div class="flex flex-col">
              <span class="text-[8px] text-gray-400 font-bold uppercase">PE</span>
              <span class="text-[10px] font-black text-gray-700">{{ stock.pe.toFixed(1) }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-[8px] text-gray-400 font-bold uppercase">ROE</span>
              <span class="text-[10px] font-black text-gray-700">{{ stock.roe.toFixed(1) }}%</span>
            </div>
          </div>
          <div class="flex flex-wrap gap-1 mt-3">
            <span 
              v-for="tag in (stock.tags || []).slice(0, 2)" 
              :key="tag"
              class="px-2 py-0.5 bg-red-50 text-red-600 text-[9px] font-black rounded-full border border-red-100"
            >
              {{ tag }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="activeTab === 'GROWTH' && topGrowth.length > 0" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-in fade-in slide-in-from-top-2">
        <div 
          v-for="stock in topGrowth" 
          :key="stock.code"
          @click="loadPreset(stock.code.split('.')[0])"
          class="bg-white border border-gray-100 rounded-2xl p-4 hover:border-orange-200 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
        >
          <div class="absolute top-0 right-0 px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter rounded-bl-lg bg-orange-600 text-white">
            成长分: {{ stock.score_growth }}
          </div>
          <div class="flex justify-between items-start mb-2 pr-6">
            <div>
              <p class="text-sm font-black text-gray-900 truncate max-w-[80px]">{{ stock.name }}</p>
              <p class="text-[10px] text-gray-400 font-bold uppercase">{{ stock.code }}</p>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-x-2 gap-y-1 mt-2">
            <div class="flex flex-col">
              <span class="text-[8px] text-gray-400 font-bold uppercase">PE</span>
              <span class="text-[10px] font-black text-gray-700">{{ stock.pe.toFixed(1) }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-[8px] text-gray-400 font-bold uppercase">增速</span>
              <span :class="['text-[10px] font-black', stock.profit_growth > 0 ? 'text-red-500' : 'text-green-500']">
                {{ stock.profit_growth > 0 ? '+' : '' }}{{ stock.profit_growth.toFixed(1) }}%
              </span>
            </div>
          </div>
          <div class="flex flex-wrap gap-1 mt-3">
            <span 
              v-for="tag in (stock.tags || []).slice(0, 2)" 
              :key="tag"
              class="px-2 py-0.5 bg-orange-50 text-orange-600 text-[9px] font-black rounded-full border border-orange-100"
            >
              {{ tag }}
            </span>
          </div>
        </div>
      </div>

      <!-- Radar Results (Manual Scan) -->
      <div v-if="radarResults.length > 0" class="mt-8 pt-8 border-t border-gray-100">
        <div class="flex items-center space-x-2 mb-4">
          <Target class="w-4 h-4 text-orange-500" />
          <h4 class="text-sm font-black text-gray-500">实时池探测结果</h4>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2">
          <div 
            v-for="stock in radarResults" 
            :key="stock.code"
            @click="loadPreset(stock.code)"
            class="bg-white border border-gray-100 rounded-2xl p-4 hover:border-red-200 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
          >
            <!-- Category Badge -->
            <div 
              :class="[
                'absolute top-0 right-0 px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter rounded-bl-lg',
                stock.type === 'CORE' ? 'bg-blue-500 text-white' : 'bg-orange-500 text-white'
              ]"
            >
              {{ stock.type === 'CORE' ? '核心' : '卫星' }}
            </div>

            <div class="flex justify-between items-start mb-2 pr-6">
              <div>
                <p class="text-sm font-black text-gray-900 truncate max-w-[80px]">{{ stock.name }}</p>
                <p class="text-[10px] text-gray-400 font-bold uppercase">{{ stock.code }}</p>
              </div>
              <div class="text-right">
                <p :class="['text-xs font-black', stock.changePercent >= 0 ? 'text-red-500' : 'text-green-500']">
                  {{ stock.changePercent.toFixed(2) }}%
                </p>
                <p class="text-[10px] text-gray-400 font-bold">PE: {{ stock.pe.toFixed(1) }}</p>
              </div>
            </div>
            
            <div class="flex flex-wrap gap-1 mt-3">
              <span v-if="stock.sector" class="px-1.5 py-0.5 bg-gray-50 text-gray-400 text-[9px] font-bold rounded">
                {{ stock.sector }}
              </span>
              <span 
                v-for="sig in stock.signals" 
                :key="sig"
                :class="[
                  'px-2 py-0.5 text-[9px] font-black rounded-full border',
                  sig === '暴力洗盘' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                ]"
              >
                {{ sig }}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="!isScanning && topGood.length === 0 && topGrowth.length === 0" class="p-8 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 text-center">
        <p class="text-sm text-gray-400 font-medium">点击“开启全市场扫描”，实时捕捉“暴力洗盘”后的布局先机</p>
      </div>
    </section>

    <!-- Search & Presets -->
    <section class="space-y-6">
      <div class="flex flex-col md:flex-row gap-4">
        <div class="relative flex-1 group">
          <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-red-500 transition-colors" />
          <input 
            v-model="searchQuery" 
            @keyup.enter="handleSearch"
            type="text" 
            placeholder="输入股票代码 (如: 600036 或 000001)"
            class="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all font-bold text-gray-700"
          >
          <button 
            @click="handleSearch"
            :disabled="isLoading"
            class="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw v-if="isLoading" class="w-4 h-4 animate-spin" />
            <span v-else>探测</span>
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <span class="text-xs font-black text-gray-400 uppercase tracking-widest">快速探测：</span>
        <button 
          v-for="stock in presetStocks" 
          :key="stock.code"
          @click="loadPreset(stock.code)"
          class="px-3 py-1.5 bg-white border border-gray-100 rounded-xl text-xs font-bold text-gray-600 hover:border-red-200 hover:text-red-600 transition-all shadow-sm"
        >
          {{ stock.name }}
        </button>
      </div>
    </section>

    <!-- Error State -->
    <div v-if="error" class="p-6 bg-red-50 border border-red-100 rounded-2xl flex items-center space-x-3 text-red-600 animate-in zoom-in-95">
      <AlertCircle class="w-5 h-5 flex-shrink-0" />
      <p class="font-bold text-sm">{{ error }}</p>
    </div>

    <!-- Result View -->
    <div v-if="state.quote" class="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <!-- Left: Basic Info & Price -->
      <div class="lg:col-span-1 space-y-6">
        <div class="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm space-y-6">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-3xl font-black text-gray-900">{{ state.quote.name }}</h2>
              <p class="text-sm text-gray-400 font-bold tracking-widest mt-1">{{ state.quote.code }}</p>
            </div>
            <div :class="['text-right', state.quote.change >= 0 ? 'text-red-500' : 'text-green-500']">
              <p class="text-3xl font-black leading-none">{{ state.quote.price.toFixed(2) }}</p>
              <p class="text-sm font-bold mt-1">{{ state.quote.change >= 0 ? '+' : '' }}{{ state.quote.change.toFixed(2) }} ({{ state.quote.changePercent.toFixed(2) }}%)</p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4 pt-6 border-t border-gray-50">
            <div class="space-y-1">
              <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">最高</p>
              <p class="text-lg font-bold text-gray-700">{{ state.quote.high.toFixed(2) }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">最低</p>
              <p class="text-lg font-bold text-gray-700">{{ state.quote.low.toFixed(2) }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">换手率</p>
              <p class="text-lg font-bold text-gray-700">{{ state.quote.turnover.toFixed(2) }}%</p>
            </div>
            <div class="space-y-1">
              <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">总市值</p>
              <p class="text-lg font-bold text-gray-700">{{ state.quote.totalMV.toFixed(0) }}亿</p>
            </div>
            <div v-if="state.quote.amplitude" class="space-y-1">
              <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">日振幅</p>
              <p class="text-lg font-bold text-gray-700">{{ state.quote.amplitude.toFixed(2) }}%</p>
            </div>
          </div>

          <!-- 52-Week High/Low -->
          <div v-if="state.quote.high52 && state.quote.low52" class="border-t border-gray-50 space-y-3">
            <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">52周运行区间 (高/低)</p>
            <div class="flex items-center space-x-2">
              <span class="text-xs font-bold text-gray-500">{{ state.quote.low52.toFixed(2) }}</span>
              <div class="flex-1 h-1.5 bg-gray-100 rounded-full relative">
                <div 
                  class="absolute h-full bg-red-500 rounded-full"
                  :style="{ 
                    left: '0', 
                    width: '100%',
                    opacity: 0.1
                  }"
                ></div>
                <div 
                  class="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full border-2 border-white shadow-sm transition-all duration-500"
                  :style="{ 
                    left: ((state.quote.price - state.quote.low52) / (state.quote.high52 - state.quote.low52) * 100) + '%' 
                  }"
                ></div>
              </div>
              <span class="text-xs font-bold text-gray-500">{{ state.quote.high52.toFixed(2) }}</span>
            </div>
            <p class="text-[10px] text-center text-gray-400 font-medium">
              当前处于 52周区间的 {{ ((state.quote.price - state.quote.low52) / (state.quote.high52 - state.quote.low52) * 100).toFixed(0) }}% 位置
            </p>
          </div>

          <!-- Flow Data -->
          <div v-if="state.flow" class="pt-6 border-t border-gray-50 space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <Activity class="w-4 h-4 text-primary-500" />
                <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">今日主力资金</span>
              </div>
              <span :class="['font-black text-sm', state.flow.mainInflow >= 0 ? 'text-red-500' : 'text-green-500']">
                {{ state.flow.mainInflow >= 0 ? '+' : '' }}{{ state.flow.mainInflow.toFixed(0) }}万
              </span>
            </div>
            <div class="w-full h-2 bg-gray-100 rounded-full overflow-hidden flex">
              <div 
                class="h-full bg-red-500 transition-all duration-500" 
                :style="{ width: Math.max(0, (state.flow.mainInflow / state.flow.totalInflow) * 100 + 50) + '%' }"
              ></div>
              <div class="h-full bg-green-500 flex-1"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Value Evaluation -->
      <div class="lg:col-span-2 space-y-6">
        <div class="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm h-full flex flex-col">
          <div class="flex items-center justify-between mb-8">
            <div class="flex items-center space-x-3">
              <div class="p-2 bg-red-50 text-red-600 rounded-xl">
                <Target class="w-6 h-6" />
              </div>
              <div>
                <h3 class="text-xl font-black text-gray-900">价值基因扫描</h3>
                <p class="text-sm text-gray-500 mt-1">基于李大霄“钻石底”逻辑的量化评估</p>
              </div>
            </div>
            <div class="text-center">
              <p :class="['text-4xl font-black', getScoreColor(valueEvaluation!.score)]">{{ valueEvaluation?.score }}</p>
              <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">对标分值</p>
            </div>
          </div>

          <!-- Evaluation Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
            <div 
              v-for="res in valueEvaluation?.results" 
              :key="res.label"
              :class="['p-6 rounded-2xl border transition-all', getStatusColor(res.status)]"
            >
              <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-black uppercase tracking-widest">{{ res.label }}</span>
                <Zap v-if="res.status === 'excellent'" class="w-4 h-4" />
                <Activity v-else-if="res.status === 'good'" class="w-4 h-4" />
                <Info v-else class="w-4 h-4" />
              </div>
              <p class="text-sm font-bold leading-relaxed">{{ res.desc }}</p>
            </div>
          </div>

          <!-- Summary Quote -->
          <div v-if="warningSignal" :class="['mt-6 p-4 rounded-xl border flex items-start space-x-3', warningSignal.color]">
            <AlertCircle class="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p class="font-black text-sm">{{ warningSignal.label }}</p>
              <p class="text-xs mt-1 font-medium opacity-80">{{ warningSignal.desc }}</p>
            </div>
          </div>

          <div class="mt-8 p-6 bg-red-50 rounded-2xl border border-red-100 relative overflow-hidden">
            <div class="absolute right-0 bottom-0 opacity-5 pointer-events-none">
              <Gem class="w-24 h-24 -mr-4 -mb-4" />
            </div>
            <div class="flex items-start space-x-4">
              <div class="p-2 bg-white rounded-xl shadow-sm text-red-600 flex-shrink-0">
                <Gem class="w-5 h-5" />
              </div>
              <div>
                <p class="text-xs font-black text-red-400 uppercase tracking-widest mb-1">大师结语</p>
                <p class="text-red-800 font-black text-lg">“{{ state.quote.name }}：{{ valueEvaluation?.summary }}”</p>
                <p class="text-red-600/60 text-xs mt-2 font-medium italic">注：以上评估基于静态指标及李大霄公开逻辑，市场有风险，投资需谨慎。</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!isLoading" class="bg-white rounded-3xl border border-dashed border-gray-200 p-20 text-center space-y-6">
      <div class="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mx-auto">
        <BarChart3 class="w-10 h-10" />
      </div>
      <div>
        <h3 class="text-xl font-bold text-gray-400">准备好探测“钻石底”了吗？</h3>
        <p class="text-sm text-gray-300 mt-2">在上方输入您关注的股票代码，开始价值基因探测。</p>
      </div>
    </div>
  </div>
</template>