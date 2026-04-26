<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAnalysisStore } from '@/stores/analysis'
import { toPng } from 'html-to-image'
import QRCode from 'qrcode'
import { getSentimentLabel, getSentimentColorClass, getSentimentDescription } from '@/utils/sentiment'
import { 
  ArrowLeft, 
  Lightbulb, 
  TrendingUp, 
  AlertTriangle, 
  Layers,
  BarChart3,
  Calendar,
  ChevronRight,
  ShieldAlert,
  Target,
  Quote,
  Activity,
  Zap,
  ShieldCheck,
  Puzzle,
  TrendingDown,
  Share2,
  // Download,
  Loader2,
  X
} from 'lucide-vue-next'

const route = useRoute()
const analysisStore = useAnalysisStore()
const videoId = route.params.id as string

const analysisData = computed(() => analysisStore.getVideoById(videoId))

const activeTab = ref('analysis')
const shareContentRef = ref<HTMLElement | null>(null)
const isGeneratingImage = ref(false)
const showPreview = ref(false)
const previewImage = ref('')
const canSystemShare = ref(false)
const qrCodeUrl = ref('')

// 生成当前页面的二维码
const generateQRCode = async () => {
  try {
    const url = window.location.href
    qrCodeUrl.value = await QRCode.toDataURL(url, {
      margin: 1,
      width: 200,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
  } catch (err) {
    console.error('二维码生成失败:', err)
  }
}

onMounted(() => {
  generateQRCode()
})

// 检查是否支持系统分享文件
const checkShareSupport = async (dataUrl: string) => {
  if (!navigator.share || !navigator.canShare) return false
  try {
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    const file = new File([blob], `AI解析报告-${analysisData.value?.title || '未命名'}.png`, { type: 'image/png' })
    return navigator.canShare({ files: [file] })
  } catch (e) {
    return false
  }
}

const handleSystemShare = async () => {
  if (!previewImage.value) return
  try {
    const res = await fetch(previewImage.value)
    const blob = await res.blob()
    const file = new File([blob], `AI解析报告-${analysisData.value?.title || '未命名'}.png`, { type: 'image/png' })
    await navigator.share({
      files: [file],
      title: 'AI解析报告',
      text: analysisData.value?.title
    })
  } catch (e) {
    console.error('分享失败:', e)
  }
}

const generateShareImage = async () => {
  if (!shareContentRef.value || isGeneratingImage.value) return
  
  isGeneratingImage.value = true
  try {
    // 等待 DOM 更新
    await nextTick()

    const dataUrl = await toPng(shareContentRef.value, {
      cacheBust: true,
      backgroundColor: '#f9fafb',
      pixelRatio: 2, // 提高清晰度，等同于 html2canvas 的 scale: 2
    })
    
    // 判断是否为移动端
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    
    if (isMobile) {
      // 移动端：显示预览弹窗，提示长按保存
      previewImage.value = dataUrl
      showPreview.value = true
      // 检查是否支持系统分享（支持则可以使用自定义文件名分享）
      canSystemShare.value = await checkShareSupport(dataUrl)
    } else {
      // PC 端：直接触发下载，保留原始文件名逻辑
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `AI解析报告-${analysisData.value?.title || '未命名'}.png`
      link.click()
    }
  } catch (error) {
    console.error('生成图片失败:', error)
    alert('生成海报失败，请稍后重试')
  } finally {
    isGeneratingImage.value = false
  }
}

const closePreview = () => {
  showPreview.value = false
  previewImage.value = ''
}
</script>

<template>
  <div v-if="analysisData" class="space-y-8 animate-in fade-in duration-500 pb-10">
    <!-- Image Preview Modal (Mobile Compatible) -->
    <Teleport to="body">
      <div v-if="showPreview" class="fixed inset-0 z-[200] flex flex-col items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
        <div class="absolute top-4 right-4 z-[210]">
          <button @click="closePreview" class="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors">
            <X class="w-6 h-6" />
          </button>
        </div>
        
        <div class="relative w-full max-w-[90vw] max-h-[80vh] overflow-y-auto rounded-2xl shadow-2xl">
          <img 
            :src="previewImage" 
            class="w-full h-auto object-contain" 
            :alt="`AI解析报告-${analysisData.title}`" 
            :title="`AI解析报告-${analysisData.title}`"
          />
        </div>
        
        <div class="mt-8 text-center space-y-4">
          <button 
            v-if="canSystemShare"
            @click="handleSystemShare"
            class="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-2xl font-bold shadow-lg shadow-primary-900/40 active:scale-95 transition-all"
          >
            <Share2 class="w-5 h-5 mr-2" />
            保存/分享海报
          </button>
          <div v-else class="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-2xl font-bold shadow-lg shadow-primary-900/40">
            <Zap class="w-5 h-5 mr-2" />
            长按图片保存到相册
          </div>
          <p class="text-gray-400 text-sm">若无法保存，请长按图片或截图分享</p>
        </div>
      </div>
    </Teleport>

    <!-- Breadcrumbs & Actions -->
    <div class="flex items-center justify-between">
      <router-link to="/videos" class="inline-flex items-center text-gray-500 hover:text-gray-900 transition-colors font-medium">
        <ArrowLeft class="w-4 h-4 mr-2" />
        返回列表
      </router-link>
      
      <button 
        @click="generateShareImage"
        :disabled="isGeneratingImage"
        class="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-primary-900/20 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
      >
        <Loader2 v-if="isGeneratingImage" class="w-4 h-4 mr-2 animate-spin" />
        <Share2 v-else class="w-4 h-4 mr-2" />
        {{ isGeneratingImage ? '正在生成...' : '生成分享海报' }}
      </button>
    </div>

    <!-- Video Header -->
    <div class="bg-white rounded-2xl lg:rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100">
      <div class="flex flex-col gap-6 lg:gap-8">
        <div class="flex flex-col justify-between">
          <div>
            <div class="flex flex-wrap items-center gap-4 mb-4 lg:mb-6">
              <span class="text-[10px] lg:text-xs text-gray-400 flex items-center">
                <Calendar class="w-3.5 h-3.5 mr-1.5" />
                {{ analysisData.date }}
              </span>
              <span :class="['px-4 py-1.5 lg:px-6 lg:py-2 rounded-full text-base lg:text-xl font-black border shadow-md transition-all', getSentimentColorClass(analysisData.sentiment_score)]">
                {{ getSentimentLabel(analysisData.sentiment_score) }}
              </span>
              <span class="text-xs lg:text-sm font-medium text-gray-500 italic">
                "{{ getSentimentDescription(analysisData.sentiment_score) }}"
              </span>
            </div>
            <h1 class="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">{{ analysisData.title }}</h1>
            <div class="flex items-start space-x-2 mb-4 bg-primary-50 px-4 py-3 rounded-xl border border-primary-100 w-full lg:w-fit">
              <Zap class="w-4 h-4 text-primary-600 flex-shrink-0" />
              <div class="flex-1">
                <p class="text-[10px] lg:text-xs font-bold text-primary-700 leading-relaxed">
                  本报告由 AI 自动生成，原始素材来源于公开网络。解析内容仅供市场情绪研究参考，不构成任何形式的投资建议。
                </p>
              </div>
            </div>
            <p class="text-gray-600 text-sm lg:text-lg leading-relaxed line-clamp-3 lg:line-clamp-2">{{ analysisData.summary }}</p>
          </div>
          <div class="flex items-center space-x-6 mt-6 border-t border-gray-100 pt-6">
            <div class="flex flex-wrap gap-2">
              <span v-for="tag in analysisData.tags" :key="tag" class="px-2 py-0.5 bg-gray-50 text-gray-500 rounded text-[10px] lg:text-xs font-bold border border-gray-100">
                #{{ tag }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Multi-dimensional Gauges (Sentiment & Disclaimer) -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="bg-white rounded-2xl lg:rounded-3xl p-5 lg:p-6 border border-gray-100 shadow-sm flex items-center justify-between group">
        <div class="flex items-center space-x-3 lg:space-x-4">
          <div :class="['p-3 lg:p-4 rounded-xl lg:rounded-2xl', analysisData.sentiment_score >= 56 ? 'bg-red-50 text-red-600' : (analysisData.sentiment_score >= 46 ? 'bg-orange-50 text-orange-600' : (analysisData.sentiment_score >= 36 ? 'bg-yellow-50 text-yellow-600' : 'bg-blue-50 text-blue-600'))]">
            <component :is="analysisData.sentiment_score >= 56 ? TrendingUp : (analysisData.sentiment_score >= 36 ? Activity : TrendingDown)" class="w-5 h-5 lg:w-6 lg:h-6" />
          </div>
          <div>
            <p class="text-[10px] lg:text-xs font-black text-gray-400 uppercase tracking-widest">AI 情绪分值</p>
            <p class="text-xl lg:text-2xl font-black text-gray-900">{{ analysisData.sentiment_score }} / 100</p>
          </div>
        </div>
        <div class="w-20 lg:w-24 h-1.5 lg:h-2 bg-gray-100 rounded-full overflow-hidden">
          <div 
            :class="['h-full transition-all duration-1000', analysisData.sentiment_score >= 56 ? 'bg-red-500' : (analysisData.sentiment_score >= 46 ? 'bg-orange-500' : (analysisData.sentiment_score >= 36 ? 'bg-yellow-500' : 'bg-blue-500'))]"
            :style="{ width: analysisData.sentiment_score + '%' }"
          ></div>
        </div>
      </div>

      <div class="bg-white rounded-2xl lg:rounded-3xl p-5 lg:p-6 border border-gray-100 shadow-sm flex items-center justify-between group">
        <div class="flex items-center space-x-3 lg:space-x-4">
          <div class="p-3 lg:p-4 rounded-xl lg:rounded-2xl bg-orange-50 text-orange-600">
            <ShieldCheck class="w-5 h-5 lg:w-6 lg:h-6" />
          </div>
          <div>
            <p class="text-[10px] lg:text-xs font-black text-gray-400 uppercase tracking-widest">免责强度等级</p>
            <p class="text-xl lg:text-2xl font-black text-gray-900">{{ analysisData.disclaimer_level }} / 5</p>
          </div>
        </div>
        <div class="flex space-x-1">
          <div 
            v-for="i in 5" 
            :key="i"
            :class="['w-3 h-3 lg:w-4 lg:h-4 rounded-md transition-all', i <= analysisData.disclaimer_level ? 'bg-orange-500' : 'bg-gray-100']"
          ></div>
        </div>
      </div>
    </div>

    <!-- Tabs Control -->
    <div class="flex items-center space-x-2 bg-gray-100 p-1.5 rounded-2xl w-fit">
      <button 
        v-for="tab in [
          { id: 'analysis', label: '核心解析', icon: BarChart3 },
          { id: 'meaning', label: '言外之意', icon: Lightbulb }
        ]"
        :key="tab.id"
        @click="activeTab = tab.id"
        :class="[
          'flex items-center px-6 py-2.5 rounded-xl text-sm font-bold transition-all',
          activeTab === tab.id 
            ? 'bg-white text-primary-600 shadow-sm' 
            : 'text-gray-500 hover:text-gray-700'
        ]"
      >
        <component :is="tab.icon" class="w-4 h-4 mr-2" />
        {{ tab.label }}
      </button>
    </div>

    <!-- Content Sections -->
    <div v-if="activeTab === 'analysis'" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Left: Core Views -->
      <div class="lg:col-span-2 space-y-8">
        <!-- Strategy Highlight -->
        <section v-if="analysisData.deep_analysis.strategy" class="bg-gradient-to-r from-primary-600 to-primary-500 rounded-2xl lg:rounded-3xl p-6 lg:p-8 text-white shadow-lg relative overflow-hidden mb-8 lg:mb-12">
          <div class="absolute -right-10 -bottom-10 opacity-10">
            <Zap class="w-32 h-32 lg:w-40 lg:h-40" />
          </div>
          <div class="relative z-10">
            <div class="flex items-center space-x-3 mb-4">
              <Zap class="w-5 h-5 lg:w-6 lg:h-6 text-primary-200" />
              <h2 class="text-lg lg:text-xl font-bold">核心博弈框架</h2>
            </div>
            <p class="text-primary-50 text-base lg:text-lg font-medium leading-relaxed">{{ analysisData.deep_analysis.strategy }}</p>
          </div>
        </section>

        <!-- Logic Pieces (The "Parts" Analysis) -->
        <section v-if="analysisData.deep_analysis.logic_pieces" class="bg-white rounded-2xl lg:rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100">
          <div class="flex items-center space-x-3 mb-6 lg:mb-8">
            <div class="w-8 h-8 lg:w-10 lg:h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <Puzzle class="w-4 h-4 lg:w-5 lg:h-5" />
            </div>
            <h2 class="text-lg lg:text-xl font-bold text-gray-900">逻辑零件库 (待组装)</h2>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            <div v-for="piece in analysisData.deep_analysis.logic_pieces" :key="piece.title" class="p-5 lg:p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100 group hover:bg-indigo-50 transition-colors">
              <h4 class="text-[10px] lg:text-xs font-black text-indigo-600 mb-2 uppercase tracking-widest">{{ piece.title }}</h4>
              <p class="text-xs lg:text-sm text-gray-700 leading-relaxed font-medium">{{ piece.content }}</p>
            </div>
          </div>
          <div class="mt-6 p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300 flex items-center justify-center">
            <p class="text-[10px] lg:text-xs text-gray-400 font-medium">研判官刻意未串联以上零件，暗示逻辑需由专业投资者自行组装</p>
          </div>
        </section>

        <section class="bg-white rounded-2xl lg:rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-100">
          <div class="flex items-center space-x-3 mb-6 lg:mb-8">
            <div class="w-8 h-8 lg:w-10 lg:h-10 bg-primary-50 rounded-xl flex items-center justify-center text-primary-600">
              <Target class="w-4 h-4 lg:w-5 lg:h-5" />
            </div>
            <h2 class="text-lg lg:text-xl font-bold text-gray-900">核心观点解读</h2>
          </div>
          <div class="space-y-4 lg:space-y-6">
            <div v-for="(view, index) in analysisData.structured.core_views" :key="index" class="flex items-start space-x-4 group">
              <div class="flex-shrink-0 w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-gray-50 text-gray-400 font-bold flex items-center justify-center text-xs lg:text-sm group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors border border-gray-100 group-hover:border-primary-100">
                0{{ index + 1 }}
              </div>
              <p class="text-gray-700 text-base lg:text-lg leading-relaxed pt-0.5">{{ view }}</p>
            </div>
          </div>
        </section>

        <!-- Data Points Analysis -->
        <section v-if="analysisData.deep_analysis.data_analysis" class="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
          <div class="flex items-center space-x-3 mb-8">
            <div class="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <Activity class="w-5 h-5" />
            </div>
            <h2 class="text-xl font-bold text-gray-900">数据罗列背后</h2>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div v-for="point in analysisData.deep_analysis.data_analysis.points" :key="point" class="p-4 bg-gray-50 rounded-xl border border-gray-100 text-sm font-bold text-gray-700">
              {{ point }}
            </div>
          </div>
          <div class="p-6 bg-blue-50 rounded-2xl border border-blue-100">
            <div class="flex items-center space-x-2 mb-2 text-blue-700 font-bold text-xs uppercase tracking-widest">
              <Lightbulb class="w-4 h-4" />
              <span>数据潜台词</span>
            </div>
            <p class="text-blue-900 font-medium leading-relaxed">{{ analysisData.deep_analysis.data_analysis.subtext }}</p>
          </div>
        </section>

        <section class="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
          <div class="flex items-center space-x-3 mb-8">
            <div class="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
              <TrendingUp class="w-5 h-5" />
            </div>
            <h2 class="text-xl font-bold text-gray-900">策略逻辑推演 (仅供研究)</h2>
          </div>
          <div class="p-6 bg-green-50 rounded-2xl border border-green-100 space-y-4">
            <div class="flex items-start space-x-2 text-green-700">
              <ShieldAlert class="w-4 h-4 flex-shrink-0" />
              <p class="text-xs font-bold italic">
                以下内容为基于大师观点及市场规律的 AI 模拟推演，不代表实际操作建议。据此入市，风险自担。
              </p>
            </div>
            <p class="text-green-800 text-lg font-medium leading-relaxed">
              {{ analysisData.structured.operation_advice }}
            </p>
          </div>
        </section>
      </div>

      <!-- Right: Side Info -->
      <div class="space-y-8">
        <!-- Conclusion Card -->
        <section class="bg-gray-900 rounded-3xl p-8 text-white shadow-xl">
          <h3 class="text-lg font-bold mb-6 flex items-center text-primary-400">
            <Zap class="w-5 h-5 mr-2" />
            去包装真实结论
          </h3>
          <p class="text-gray-300 leading-relaxed font-medium">
            {{ analysisData.deep_analysis.final_conclusion }}
          </p>
        </section>

        <!-- Sectors -->
        <section class="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
          <h3 class="text-lg font-bold text-gray-900 mb-6 flex items-center">
            <Layers class="w-5 h-5 mr-2 text-primary-500" />
            提及板块
          </h3>
          <div class="flex flex-wrap gap-2">
            <span v-for="sector in analysisData.structured.sectors" :key="sector" class="px-4 py-2 bg-primary-50 text-primary-700 rounded-xl text-sm font-bold border border-primary-100">
              {{ sector }}
            </span>
          </div>
        </section>

        <!-- Risk Tips -->
        <section class="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
          <h3 class="text-lg font-bold text-gray-900 mb-6 flex items-center">
            <ShieldAlert class="w-5 h-5 mr-2 text-red-500" />
            风险警示
          </h3>
          <ul class="space-y-4">
            <li v-for="risk in analysisData.structured.risk_tips" :key="risk" class="flex items-start space-x-3 text-sm text-gray-600">
              <AlertTriangle class="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <span>{{ risk }}</span>
            </li>
          </ul>
        </section>
      </div>
    </div>

    <!-- Deep Meaning Tab -->
    <div v-if="activeTab === 'meaning'" class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div v-for="(item, index) in analysisData.deep_analysis.hidden_meanings" :key="index" class="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm flex flex-col">
        <div class="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
          <div class="flex items-center space-x-2 text-sm text-gray-500">
            <Quote class="w-4 h-4" />
            <span>核心金句/表达</span>
          </div>
          <span class="text-xs font-bold text-gray-300">0{{ index + 1 }}</span>
        </div>
        <div class="p-8 flex-1 flex flex-col space-y-6">
          <div v-if="item.quote" class="p-4 bg-gray-50 rounded-xl border-l-4 border-gray-200">
            <p class="text-sm text-gray-500 italic mb-2">原话录入：</p>
            <p class="text-gray-700 font-medium">"{{ item.quote }}"</p>
          </div>
          
          <div class="flex flex-col space-y-2">
            <span class="text-[10px] font-black text-gray-300 uppercase tracking-widest">字面意思</span>
            <p class="text-xl font-bold text-gray-900 italic">"{{ item.surface }}"</p>
          </div>

          <div class="flex items-center justify-center py-2">
            <ChevronRight class="w-6 h-6 text-primary-200 rotate-90 lg:rotate-0" />
          </div>

          <div class="p-6 bg-primary-50 rounded-2xl border border-primary-100 flex-1">
            <div class="flex items-center space-x-2 mb-3 text-primary-700 font-bold text-sm uppercase tracking-widest">
              <Lightbulb class="w-4 h-4" />
              <span>AI 深度解读</span>
            </div>
            <p class="text-primary-900 text-lg leading-relaxed font-bold">
              {{ item.deep }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Hidden Share Poster Content (Only for html-to-image) -->
    <div class="fixed left-0 top-0 w-0 h-0 overflow-hidden pointer-events-none -z-50">
      <div id="share-poster-content" ref="shareContentRef" class="w-[600px] bg-gray-50">
        <div class="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 space-y-8">
          <!-- Poster Header -->
          <div class="flex items-center space-x-4 mb-6">
            <div class="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl">李</div>
            <div>
              <h2 class="text-xl font-black text-gray-900">AI 视频解析平台</h2>
              <p class="text-xs text-gray-400 font-bold uppercase tracking-widest">情绪价值解码器</p>
            </div>
          </div>

          <div class="border-t border-gray-100 pt-8">
            <div class="flex items-center space-x-3 mb-4">
              <span class="text-xs text-gray-400 flex items-center">
                <Calendar class="w-3.5 h-3.5 mr-1.5" />
                {{ analysisData.date }}
              </span>
              <span :class="['px-4 py-1 rounded-full text-sm font-black border whitespace-nowrap', getSentimentColorClass(analysisData.sentiment_score)]">
                {{ getSentimentLabel(analysisData.sentiment_score) }}
              </span>
            </div>
            <h1 class="text-2xl font-bold text-gray-900 mb-4">{{ analysisData.title }}</h1>
            <p class="text-gray-600 text-sm leading-relaxed">{{ analysisData.summary }}</p>
          </div>

          <!-- Poster Content Sections -->
          <div class="space-y-6 pt-6">
            <section>
              <div class="flex items-center space-x-2 mb-4 text-primary-600">
                <Target class="w-4 h-4" />
                <h3 class="font-bold">核心策略</h3>
              </div>
              <div class="bg-primary-50 p-4 rounded-2xl border border-primary-100">
                <p class="text-primary-900 font-bold text-sm leading-relaxed">{{ analysisData.deep_analysis.strategy }}</p>
              </div>
            </section>

            <section>
              <div class="flex items-center space-x-2 mb-4 text-orange-600">
                <ShieldAlert class="w-4 h-4" />
                <h3 class="font-bold">核心观点</h3>
              </div>
              <div class="grid grid-cols-1 gap-3">
                <div v-for="(point, idx) in analysisData.structured.core_views.slice(0, 3)" :key="idx" class="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-start space-x-3">
                  <span class="text-lg font-black text-gray-200 leading-none">{{ idx + 1 }}</span>
                  <p class="text-gray-700 text-xs font-medium leading-relaxed">{{ point }}</p>
                </div>
              </div>
            </section>
          </div>

          <!-- Poster Footer -->
          <div class="border-t border-gray-100 pt-8 mt-8 flex items-center justify-between">
            <div class="space-y-2">
              <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">扫码查看深度研判</p>
              <p class="text-[10px] text-gray-300 max-w-[200px]">本报告由 AI 自动生成，素材源于公开网络，不代表投资建议</p>
            </div>
            <div class="w-24 h-24 p-2 bg-white rounded-2xl shadow-sm border border-gray-100">
              <img v-if="qrCodeUrl" :src="qrCodeUrl" alt="项目二维码" class="w-full h-full object-contain" />
              <div v-else class="w-full h-full bg-gray-50 flex items-center justify-center">
                <Loader2 class="w-4 h-4 animate-spin text-gray-300" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="py-20 text-center">
    <p class="text-gray-500">正在加载解析报告...</p>
  </div>
</template>
