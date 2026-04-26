<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLingoStore, type LingoItem } from '@/stores/lingo'
import {
  Search,
  BookOpen,
  History,
  Zap,
  ChevronRight,
  Tag,
  Lightbulb,
  Quote,
  TrendingUp,
  Info
} from 'lucide-vue-next'

const lingoStore = useLingoStore()
const searchQuery = ref('')
const activeTabId = ref('all')
const selectedLingoId = ref<string | null>(lingoStore.lingos[0]?.id || null)

const tabs = [
  { id: 'all', label: '全部' },
  { id: 'bottom', label: '抄底/底部' },
  { id: 'top', label: '逃顶/预警' },
  { id: 'bull', label: '各类“牛”' },
  { id: 'quotes', label: '金句/心法' },
  { id: 'folklore', label: '趣味/民间' },
  { id: 'others', label: '其他' }
]

const filteredLingos = computed(() => {
  const base = lingoStore.searchLingos(searchQuery.value)
  if (activeTabId.value === 'all') return base
  
  return base.filter(l => {
    const tags = l.tags || []
    const isBottom = tags.some(t => t.includes('底') || t.includes('买入'))
    const isTop = tags.some(t => t.includes('顶') || t.includes('风险') || t.includes('逃离') || t.includes('卖出'))
    const isBull = tags.some(t => t.includes('牛'))
    const isQuote = tags.some(t => t.includes('语录') || t.includes('心法') || t.includes('理念'))
    const isFolklore = tags.some(t => t.includes('网络调侃') || t.includes('网友衍生'))

    switch (activeTabId.value) {
      case 'bottom': return isBottom
      case 'top': return isTop
      case 'bull': return isBull
      case 'quotes': return isQuote
      case 'folklore': return isFolklore
      case 'others': return !isBottom && !isTop && !isBull && !isQuote && !isFolklore
      default: return true
    }
  })
})

const selectedLingo = computed(() =>
  lingoStore.lingos.find(l => l.id === selectedLingoId.value) || filteredLingos.value[0] || lingoStore.lingos[0]
)

const selectLingo = (id: string) => {
  selectedLingoId.value = id
}

const getStatusIcon = (status: LingoItem['status']) => {
  if (status === 'active') return Zap
  if (status === 'historical') return History
  return Info
}

const getStatusColor = (status: LingoItem['status']) => {
  if (status === 'active') return 'text-orange-500 bg-orange-50'
  if (status === 'historical') return 'text-gray-400 bg-gray-50'
  return 'text-blue-500 bg-blue-50'
}

const getStatusLabel = (status: LingoItem['status']) => {
  if (status === 'active') return '当前有效'
  if (status === 'historical') return '历史经典'
  if (status === 'folklore') return '民间梗'
  return '其他'
}
</script>

<template>
  <div class="space-y-6 lg:space-y-8 animate-in fade-in duration-500 pb-10">
    <!-- Header -->
    <header
      class="relative bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl lg:rounded-3xl p-6 lg:p-10 text-white overflow-hidden shadow-xl">
      <div class="absolute right-0 top-0 opacity-10 pointer-events-none">
        <BookOpen class="w-48 h-48 lg:w-80 lg:h-80 -mr-10 lg:-mr-20 -mt-10 lg:-mt-20 rotate-12" />
      </div>
      <div class="relative z-10 max-w-2xl">
        <div class="flex items-center space-x-3 mb-4">
          <div class="p-2 bg-white/20 backdrop-blur-md rounded-xl">
            <BookOpen class="w-5 h-5 lg:w-6 lg:h-6 text-white" />
          </div>
          <span class="text-[10px] lg:text-sm font-black uppercase tracking-widest text-primary-100">核心术语库</span>
        </div>
        <h1 class="text-2xl lg:text-4xl font-black mb-3 lg:mb-4">“大师黑话”百科</h1>
        <p class="text-primary-100 text-sm lg:text-lg leading-relaxed font-medium">
          深度解析市场情绪大师原创投资术语，从“钻石底”到“避雷针”，带你读懂股市最独特的情绪风向标。
        </p>
      </div>
    </header>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
      <!-- Sidebar: Lingo List -->
      <aside class="lg:col-span-4 space-y-4 lg:space-y-6">
        <!-- Tabs (Improved Layout) -->
        <div class="flex flex-wrap gap-2 p-1">
          <button 
            v-for="tab in tabs" 
            :key="tab.id"
            @click="activeTabId = tab.id"
            :class="[
              'px-3 py-1.5 rounded-lg text-[10px] lg:text-xs font-bold transition-all border',
              activeTabId === tab.id 
                ? 'bg-primary-600 text-white border-primary-600 shadow-sm shadow-primary-900/10' 
                : 'bg-white text-gray-500 border-gray-100 hover:border-primary-200 hover:text-primary-600'
            ]"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- Search -->
        <div class="relative group">
          <Search
            class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 lg:w-5 lg:h-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
          <input v-model="searchQuery" type="text" placeholder="搜索术语、含义或标签..."
            class="w-full pl-10 lg:pl-12 pr-4 py-3 lg:py-4 bg-white border border-gray-100 rounded-xl lg:rounded-2xl shadow-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all font-bold text-gray-700 text-sm lg:text-base">
        </div>

        <!-- List -->
        <div class="bg-white rounded-2xl lg:rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div class="p-4 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
            <p class="text-[10px] lg:text-xs font-black text-gray-400 uppercase tracking-widest">术语列表</p>
            <span class="px-2 py-0.5 bg-gray-200 text-gray-500 rounded text-[10px] font-bold">{{ filteredLingos.length }}</span>
          </div>
          <div class="h-[400px] lg:h-[calc(100vh-450px)] min-h-[300px] overflow-y-auto divide-y divide-gray-50 scrollbar-thin">
            <button v-for="lingo in filteredLingos" :key="lingo.id" @click="selectLingo(lingo.id)" :class="[
              'w-full text-left p-5 flex items-center justify-between transition-all hover:bg-gray-50 group',
              selectedLingoId === lingo.id ? 'bg-primary-50/50' : ''
            ]">
              <div class="flex items-center space-x-4">
                <div
                  :class="['p-3 rounded-xl transition-all group-hover:scale-110', selectedLingoId === lingo.id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-primary-100 group-hover:text-primary-600']">
                  <span class="font-black text-lg">{{ lingo.term.charAt(0) }}</span>
                </div>
                <div>
                  <h3
                    :class="['font-bold text-lg transition-colors', selectedLingoId === lingo.id ? 'text-primary-700' : 'text-gray-900 group-hover:text-primary-600']">
                    {{ lingo.term }}
                  </h3>
                  <div class="flex items-center space-x-2 mt-1">
                    <span v-for="tag in lingo.tags.slice(0, 1)" :key="tag"
                      class="text-[10px] font-black uppercase tracking-widest text-gray-400">{{ tag }}</span>
                  </div>
                </div>
              </div>
              <ChevronRight
                :class="['w-5 h-5 transition-all', selectedLingoId === lingo.id ? 'text-primary-600 translate-x-1' : 'text-gray-200 group-hover:text-gray-400 group-hover:translate-x-1']" />
            </button>

            <div v-if="filteredLingos.length === 0" class="p-10 text-center">
              <Search class="w-10 h-10 text-gray-200 mx-auto mb-4" />
              <p class="text-gray-400 font-bold">没有找到相关术语</p>
            </div>
          </div>
        </div>
      </aside>

      <!-- Main Content: Lingo Detail -->
      <main class="lg:col-span-8">
        <div v-if="selectedLingo"
          class="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-500">
          <!-- Detail Header -->
          <div class="p-8 border-b border-gray-50">
            <div class="flex items-center justify-between mb-6">
              <div
                :class="['px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center', getStatusColor(selectedLingo.status)]">
                <component :is="getStatusIcon(selectedLingo.status)" class="w-3 h-3 mr-1.5" />
                {{ getStatusLabel(selectedLingo.status) }}
              </div>
              <div class="flex space-x-2">
                <span v-for="tag in selectedLingo.tags" :key="tag"
                  class="px-3 py-1 bg-gray-50 text-gray-500 rounded-lg text-xs font-bold flex items-center">
                  <Tag class="w-3 h-3 mr-1.5" />
                  {{ tag }}
                </span>
              </div>
            </div>

            <h2 class="text-5xl font-black text-gray-900 mb-4">{{ selectedLingo.term }}</h2>
            <p v-if="selectedLingo.pronunciation" class="text-primary-600 font-bold tracking-widest text-lg mb-6">{{
              selectedLingo.pronunciation }}</p>

            <div class="flex items-start space-x-4 p-6 bg-gray-50 rounded-2xl">
              <div class="p-2 bg-white rounded-xl shadow-sm flex-shrink-0">
                <Info class="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h4 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">官方释义</h4>
                <p class="text-gray-700 text-lg font-medium leading-relaxed">{{ selectedLingo.definition }}</p>
              </div>
            </div>
          </div>

          <!-- Detail Body -->
          <div class="p-8 space-y-10 flex-1">
            <!-- Background -->
            <section>
              <div class="flex items-center space-x-3 mb-4">
                <div class="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                  <History class="w-4 h-4" />
                </div>
                <h3 class="text-lg font-bold text-gray-900">提出背景</h3>
              </div>
              <p class="text-gray-600 text-lg leading-relaxed pl-11">{{ selectedLingo.background }}</p>
            </section>

            <!-- Example -->
            <section>
              <div class="flex items-center space-x-3 mb-4">
                <div class="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600">
                  <Quote class="w-4 h-4" />
                </div>
                <h3 class="text-lg font-bold text-gray-900">经典语录</h3>
              </div>
              <div class="pl-11">
                <div
                  class="relative p-6 bg-purple-50/50 rounded-2xl border-l-4 border-purple-500 italic text-purple-900 text-lg font-medium">
                  <Quote class="absolute -left-2 -top-2 w-8 h-8 text-purple-200 -z-10" />
                  {{ selectedLingo.example }}
                </div>
              </div>
            </section>

            <!-- Market Context -->
            <section>
              <div class="flex items-center space-x-3 mb-4">
                <div class="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center text-orange-600">
                  <TrendingUp class="w-4 h-4" />
                </div>
                <h3 class="text-lg font-bold text-gray-900">市场实战意义</h3>
              </div>
              <div class="pl-11">
                <div
                  class="p-6 bg-white border border-orange-100 rounded-2xl flex items-start space-x-4 shadow-sm shadow-orange-50">
                  <Lightbulb class="w-6 h-6 text-orange-500 flex-shrink-0 mt-1" />
                  <p class="text-gray-700 text-lg leading-relaxed">{{ selectedLingo.market_context }}</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>
