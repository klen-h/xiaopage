<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAnalysisStore } from '@/stores/analysis'
import { getSentimentLabel, getSentimentColorClass } from '@/utils/sentiment'
import { 
  Search, 
  // Filter, 
  Calendar, 
  // TrendingUp, 
  // TrendingDown,
  LayoutGrid,
  List,
  // PlayCircle,
  // Clock,
  ChevronRight
} from 'lucide-vue-next'

const analysisStore = useAnalysisStore()
const searchQuery = ref('')
const activeFilter = ref('all')
const viewMode = ref<'grid' | 'list'>('grid')

const videos = computed(() => analysisStore.videos)

const filteredVideos = computed(() => {
  return videos.value
    .filter(video => {
      const matchesSearch = video.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                           video.summary.toLowerCase().includes(searchQuery.value.toLowerCase())

      // 逻辑对齐 6 级情绪体系：
      // 乐观信号：谨慎偏多(46-55) + 乐观(56-75)
      // 风险提示：极度恐慌(0-15) + 悲观(16-35) + 谨慎偏空(36-45) + 极度狂热(76-100, 泡沫顶部)
      const score = video.sentiment_score
      const isOptimistic = score >= 46 && score <= 75
      const isCaution = score <= 45 || score >= 76

      const matchesFilter = activeFilter.value === 'all' ||
                           (activeFilter.value === 'optimistic' && isOptimistic) ||
                           (activeFilter.value === 'caution' && isCaution)
      return matchesSearch && matchesFilter
    })
    .sort((a, b) => {
      // 按时间倒序排列（最新的在前）
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
})

// 移除本地 getSentimentColor，改用统一工具类
</script>

<template>
  <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <!-- Header & Controls -->
    <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 class="text-2xl font-bold text-gray-900">全部视频解析</h2>
        <div class="flex items-center space-x-2 bg-gray-50 p-1 rounded-xl border border-gray-200">
          <button 
            @click="viewMode = 'grid'"
            :class="['p-2 rounded-lg transition-all', viewMode === 'grid' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-400 hover:text-gray-600']"
          >
            <LayoutGrid class="w-5 h-5" />
          </button>
          <button 
            @click="viewMode = 'list'"
            :class="['p-2 rounded-lg transition-all', viewMode === 'list' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-400 hover:text-gray-600']"
          >
            <List class="w-5 h-5" />
          </button>
        </div>
      </div>

      <div class="flex flex-col lg:flex-row gap-4">
        <!-- Search -->
        <div class="flex-1 relative">
          <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="搜索视频标题、观点或关键字..." 
            class="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none text-gray-700"
          />
        </div>

        <!-- Filters -->
        <div class="flex flex-wrap items-center gap-2">
          <button 
            v-for="filter in [
              { id: 'all', label: '全部' },
              { id: 'optimistic', label: '乐观信号' },
              { id: 'caution', label: '风险提示' }
            ]"
            :key="filter.id"
            @click="activeFilter = filter.id"
            :class="[
              'px-4 py-2 rounded-xl text-sm font-medium transition-all border',
              activeFilter === filter.id 
                ? 'bg-primary-600 text-white border-primary-600 shadow-lg shadow-primary-200' 
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            ]"
          >
            {{ filter.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Video Grid -->
    <div v-if="viewMode === 'grid'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div 
        v-for="video in filteredVideos" 
        :key="video.id" 
        class="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all group flex flex-col"
      >
        <!-- Content -->
        <div class="p-6 flex-1 flex flex-col">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center text-xs text-gray-400 font-medium">
              <Calendar class="w-3.5 h-3.5 mr-1.5" />
              {{ video.date }}
            </div>
            <span :class="['px-2.5 py-1 rounded-full text-xs font-bold border shadow-sm', getSentimentColorClass(video.sentiment_score)]">
              {{ getSentimentLabel(video.sentiment_score) }}
            </span>
          </div>
          
          <h3 class="text-lg font-bold text-gray-900 mb-3 group-hover:text-primary-600 transition-colors line-clamp-2 leading-snug">
            {{ video.title }}
          </h3>
          
          <p class="text-sm text-gray-500 line-clamp-3 mb-6 leading-relaxed flex-1">
            {{ video.summary }}
          </p>

          <div class="flex flex-wrap gap-2 mb-6">
            <span v-for="tag in video.tags.slice(0, 3)" :key="tag" class="px-2 py-0.5 bg-gray-50 text-gray-500 rounded text-xs font-medium border border-gray-100">
              #{{ tag }}
            </span>
          </div>

          <router-link 
            :to="'/analysis/' + video.id" 
            class="w-full flex items-center justify-center py-3 bg-gray-50 hover:bg-primary-50 text-gray-600 hover:text-primary-600 rounded-xl text-sm font-semibold transition-all border border-gray-100 hover:border-primary-200"
          >
            阅读 AI 深度报告
            <ChevronRight class="ml-1 w-4 h-4" />
          </router-link>
        </div>
      </div>
    </div>

    <!-- Video List View -->
    <div v-else class="space-y-4">
      <div 
        v-for="video in filteredVideos" 
        :key="video.id" 
        class="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all group flex flex-col sm:flex-row"
      >
        <div class="flex-1 p-5 lg:p-6 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center space-x-4">
                <span class="text-[10px] lg:text-xs text-gray-400 font-medium">{{ video.date.slice(0, 10) }}</span>
                <span :class="['px-2 py-0.5 lg:px-2.5 lg:py-0.5 rounded-full text-[10px] lg:text-xs font-bold border shadow-sm', getSentimentColorClass(video.sentiment_score)]">
                  {{ getSentimentLabel(video.sentiment_score) }}
                </span>
              </div>
            </div>
            <h3 class="text-lg lg:text-xl font-bold text-gray-900 group-hover:text-primary-600 transition-colors mb-2">{{ video.title }}</h3>
            <p class="text-sm text-gray-500 line-clamp-2 leading-relaxed mb-4">{{ video.summary }}</p>
          </div>
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex flex-wrap gap-2">
              <span v-for="tag in video.tags.slice(0, 4)" :key="tag" class="px-2 py-0.5 bg-gray-50 text-gray-500 rounded text-[10px] font-medium border border-gray-100">
                #{{ tag }}
              </span>
            </div>
            <router-link 
              :to="'/analysis/' + video.id" 
              class="flex items-center text-primary-600 hover:text-primary-700 font-bold text-sm self-end sm:self-auto"
            >
              报告详情
              <ChevronRight class="ml-1 w-4 h-4" />
            </router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="filteredVideos.length === 0" class="bg-white py-20 rounded-2xl border border-dashed border-gray-300 flex flex-col items-center justify-center">
      <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
        <Search class="w-8 h-8 text-gray-300" />
      </div>
      <h3 class="text-lg font-medium text-gray-900">未找到相关视频</h3>
      <p class="text-gray-500 mt-1">尝试更改搜索词或筛选条件</p>
      <button @click="searchQuery = ''; activeFilter = 'all'" class="mt-6 text-primary-600 font-bold text-sm hover:underline">
        重置所有筛选条件
      </button>
    </div>
  </div>
</template>
