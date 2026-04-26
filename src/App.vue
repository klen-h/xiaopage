<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAnalysisStore } from '@/stores/analysis'
import { 
  LayoutDashboard, 
  Video, 
  TrendingUp, 
  Calendar,
  ShieldCheck,
  Activity,
  // Settings, 
  ChevronRight,
  Menu,
  X,
  Bell,
  BookOpen,
  Languages,
  ShieldAlert,
  Heart,
  MessageSquareText,
  Send,
  Loader2,
  CheckCircle2
} from 'lucide-vue-next'
import { cloudbase } from '@/utils/tcb'
import { 
  getLocalTimestampString
} from '@/utils/sentiment'

const router = useRouter()
const route = useRoute()
const analysisStore = useAnalysisStore()
const isSidebarOpen = ref(window.innerWidth >= 1024)
const isMobileSidebarOpen = ref(false)
const isDonateModalOpen = ref(false)
const isFeedbackModalOpen = ref(false)
const mainContentRef = ref<HTMLElement | null>(null)

// 反馈表单状态
const feedbackContent = ref('')
const isSubmitting = ref(false)
const submitSuccess = ref(false)

const submitFeedback = async () => {
  if (!feedbackContent.value.trim() || isSubmitting.value) return
  
  isSubmitting.value = true
  try {
    const timestamp = getLocalTimestampString()
    
    const { error } = await cloudbase
      .rdb()
      .from("user_feedback")
      .insert({
        content: feedbackContent.value,
        timestamp: timestamp,
        device: window.navigator.userAgent,
        page: route.path
      })

    if (!error) {
      submitSuccess.value = true
      feedbackContent.value = ''
      setTimeout(() => {
        isFeedbackModalOpen.value = false
        submitSuccess.value = false
      }, 2000)
    } else {
      alert('提交失败，请稍后再试')
    }
  } catch (err) {
    console.error('提交反馈异常:', err)
    alert('提交过程发生错误')
  } finally {
    isSubmitting.value = false
  }
}

// 页面加载时请求最新数据
onMounted(() => {
  analysisStore.fetchVideos()
})

const navItems = [
  { name: '首页看板', path: '/', icon: LayoutDashboard },
  { name: '视频列表', path: '/videos', icon: Video },
  { name: '趋势追踪', path: '/trends', icon: TrendingUp },
  { name: '情绪日历', path: '/sentiment-calendar', icon: Calendar },
  { name: '价值探测', path: '/value-investment', icon: ShieldCheck },
  { name: '初筛备选', path: '/stock-candidates', icon: Activity },
  { name: '黑话百科', path: '/lingo', icon: Languages },
  { name: '知识库', path: '/knowledge', icon: BookOpen },
]

const toggleSidebar = () => {
  if (window.innerWidth >= 1024) {
    isSidebarOpen.value = !isSidebarOpen.value
  } else {
    isMobileSidebarOpen.value = !isMobileSidebarOpen.value
  }
}

const navigate = (path: string) => {
  router.push(path)
  if (window.innerWidth < 1024) {
    isMobileSidebarOpen.value = false
  }
}

// 监听路由变化，切换页面时滚动到顶部
watch(() => route.path, () => {
  if (mainContentRef.value) {
    mainContentRef.value.scrollTop = 0
  }
  // 切换路由时也可以顺便静默刷新一下数据，保证最新的
  analysisStore.fetchVideos()
})

// 响应式监听窗口大小
window.addEventListener('resize', () => {
  if (window.innerWidth >= 1024) {
    isMobileSidebarOpen.value = false
  }
})
</script>

<template>
  <div class="h-screen bg-gray-50 flex overflow-hidden relative font-sans">
    <!-- Mobile Sidebar Drawer Overlay -->
    <div 
      v-if="isMobileSidebarOpen" 
      class="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[60] lg:hidden"
      @click="isMobileSidebarOpen = false"
    ></div>

    <!-- Sidebar - Desktop Fixed / Mobile Drawer -->
    <aside 
      :class="[
        'bg-white border-r border-gray-200 transition-all duration-300 ease-in-out z-[70] flex-shrink-0 lg:relative fixed h-full',
        isSidebarOpen ? 'w-64' : 'w-20',
        'lg:translate-x-0',
        isMobileSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
      ]"
    >
      <div class="h-full flex flex-col transition-all duration-300 ease-in-out w-full">
        <!-- Logo -->
        <div class="h-16 flex items-center px-6 border-b border-gray-100 flex-shrink-0">
          <div class="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span class="text-white font-bold text-xl">李</span>
          </div>
          <span v-if="isSidebarOpen || isMobileSidebarOpen" class="ml-3 font-bold text-gray-800 truncate">AI 视频解析平台</span>
        </div>

        <!-- Navigation -->
        <nav class="flex-1 px-4 py-6 space-y-2 overflow-y-auto scrollbar-hide">
          <button
            v-for="item in navItems"
            :key="item.path"
            @click="navigate(item.path)"
            :class="[
              'w-full flex items-center px-3 py-3 rounded-xl transition-all duration-200 group relative',
              route.path === item.path 
                ? 'bg-primary-50 text-primary-600 shadow-sm' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            ]"
          >
            <component 
              :is="item.icon" 
              :class="[
                'w-5 h-5 flex-shrink-0',
                route.path === item.path ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-600'
              ]" 
            />
            <span v-if="isSidebarOpen || isMobileSidebarOpen" class="ml-3 font-medium truncate">{{ item.name }}</span>
            <div 
              v-if="!isSidebarOpen && !isMobileSidebarOpen" 
              class="absolute left-20 bg-gray-900 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap"
            >
              {{ item.name }}
            </div>
          </button>
        </nav>

        <!-- Feedback & Donate Entrance -->
        <div class="px-4 mb-4 flex-shrink-0 space-y-2">
          <button 
            @click="isFeedbackModalOpen = true"
            class="w-full flex items-center px-3 py-3 rounded-xl text-blue-600 bg-blue-50 hover:bg-blue-100 transition-all border border-blue-100 group relative"
          >
            <MessageSquareText class="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform" />
            <span v-if="isSidebarOpen || isMobileSidebarOpen" class="ml-3 font-bold truncate">建议反馈</span>
            <div 
              v-if="!isSidebarOpen && !isMobileSidebarOpen" 
              class="absolute left-20 bg-blue-600 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap"
            >
              建议反馈
            </div>
          </button>

          <button 
            @click="isDonateModalOpen = true"
            class="w-full flex items-center px-3 py-3 rounded-xl text-orange-600 bg-orange-50 hover:bg-orange-100 transition-all border border-orange-100 group relative"
          >
            <Heart class="w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform fill-orange-100 group-hover:fill-orange-200" />
            <span v-if="isSidebarOpen || isMobileSidebarOpen" class="ml-3 font-bold truncate">支持作者</span>
            <div 
              v-if="!isSidebarOpen && !isMobileSidebarOpen" 
              class="absolute left-20 bg-orange-600 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap"
            >
              支持作者
            </div>
          </button>
        </div>

        <!-- Sidebar Footer -->
        <div class="p-4 border-t border-gray-100 bg-white flex-shrink-0 hidden lg:block">
          <button 
            @click="toggleSidebar"
            class="w-full flex items-center justify-center p-2 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors"
          >
            <ChevronRight :class="['w-5 h-5 transition-transform duration-300', isSidebarOpen ? 'rotate-180' : '']" />
          </button>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 flex flex-col min-w-0 relative h-full">
      <!-- Top Header -->
      <header class="h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-50 flex-shrink-0">
        <div class="flex items-center">
          <button 
            @click="isMobileSidebarOpen = true" 
            class="p-2 mr-2 text-gray-500 hover:bg-gray-50 rounded-lg lg:hidden"
          >
            <Menu class="w-6 h-6" />
          </button>
          <h1 class="text-lg lg:text-xl font-bold text-gray-800 truncate">{{ route.meta.title || '情绪大师 AI 解析' }}</h1>
        </div>
        <!-- Right actions hidden per request -->
        <div class="flex items-center space-x-4 hidden">
          <button class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors relative">
            <Bell class="w-5 h-5" />
            <span class="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
          <div class="flex items-center space-x-3 pl-4 border-l border-gray-100">
            <div class="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium">
              用
            </div>
            <span class="text-sm font-medium text-gray-700">演示用户</span>
          </div>
        </div>
      </header>

      <!-- Page View Area -->
      <div ref="mainContentRef" class="flex-1 overflow-y-auto bg-gray-50 scroll-smooth">
        <div class="max-w-7xl mx-auto p-4 lg:p-8">
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>

          <!-- Global Disclaimer -->
          <footer class="mt-8 pb-8 border-t border-gray-200 pt-6 text-center font-medium text-[12px]">
            <div class="flex items-center justify-center space-x-2 text-gray-400 mb-2">
              <ShieldAlert class="w-4 h-4" />
              <span class="text-xs font-bold uppercase tracking-widest">法律免责声明</span>
            </div>
            <p class="text-[10px] lg:text-[11px] text-gray-400 leading-relaxed max-w-3xl mx-auto px-4">
              本平台所有内容仅供 AI 技术演示及市场情绪研究参考，不构成任何形式的投资建议。
              本平台不对任何因参考本平台内容而导致的投资损失承担法律责任。
              投资有风险，入市需谨慎。所有数据均来源于公开网络，AI 解析可能存在误差，请结合实际行情审慎判断。
            </p>
          </footer>
        </div>
      </div>
    </main>

    <!-- Donate Modal -->
    <div v-if="isDonateModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" @click="isDonateModalOpen = false"></div>
      <div class="bg-white rounded-3xl p-6 lg:p-8 w-[95vw] max-w-md relative z-10 shadow-2xl animate-in zoom-in-95 duration-300">
        <button @click="isDonateModalOpen = false" class="absolute right-6 top-6 text-gray-400 hover:text-gray-600">
          <X class="w-6 h-6" />
        </button>
        
        <div class="text-center mb-6 lg:mb-8">
          <div class="w-12 h-12 lg:w-16 lg:h-16 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 mx-auto mb-4">
            <Heart class="w-6 h-6 lg:w-8 lg:h-8 fill-current" />
          </div>
          <h3 class="text-xl lg:text-2xl font-black text-gray-900">支持项目开发</h3>
          <p class="text-sm lg:text-base text-gray-500 mt-2 font-medium">如果您觉得这个工具有所帮助，欢迎请作者喝杯咖啡，您的支持是我持续更新的最大动力！</p>
          <div class="mt-4 bg-orange-50 border border-orange-100 rounded-xl py-2 px-4 inline-flex items-center space-x-2">
            <span class="text-xs font-bold text-orange-600 uppercase tracking-widest">作者微信号：</span>
            <span class="text-sm font-black text-orange-700 select-all">18302085349</span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 lg:gap-6">
          <div class="space-y-3 text-center">
            <div class="aspect-[3/4] bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden">
              <img src="/assets/donate/wechat-pay.png" alt="微信支付" class="w-full h-full object-contain p-1" />
            </div>
            <span class="text-xs lg:text-sm font-bold text-gray-600">微信赞赏</span>
          </div>
          <div class="space-y-3 text-center">
            <div class="aspect-[3/4] bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden">
              <img src="/assets/donate/alipay.jpg" alt="支付宝支付" class="w-full h-full object-contain p-1" />
            </div>
            <span class="text-xs lg:text-sm font-bold text-gray-600">支付宝</span>
          </div>
        </div>

        <p class="text-[10px] text-gray-400 text-center mt-6 lg:mt-8 font-medium px-2">
          * 赞赏纯属自愿，无论是否赞赏，您都可以免费使用本平台的所有功能。
        </p>
      </div>
    </div>

    <!-- Feedback Modal -->
    <div v-if="isFeedbackModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" @click="isFeedbackModalOpen = false"></div>
      <div class="bg-white rounded-3xl p-6 lg:p-8 w-[95vw] max-w-md relative z-10 shadow-2xl animate-in zoom-in-95 duration-300">
        <button @click="isFeedbackModalOpen = false" class="absolute right-6 top-6 text-gray-400 hover:text-gray-600">
          <X class="w-6 h-6" />
        </button>
        
        <div v-if="!submitSuccess" class="space-y-6">
          <div class="text-center">
            <div class="w-12 h-12 lg:w-16 lg:h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mx-auto mb-4">
              <MessageSquareText class="w-6 h-6 lg:w-8 lg:h-8" />
            </div>
            <h3 class="text-xl lg:text-2xl font-black text-gray-900">建议与反馈</h3>
            <p class="text-sm text-gray-500 mt-2 font-medium">您的想法对我们很重要，请告诉我们您的建议或遇到的问题。</p>
          </div>

          <div class="space-y-4">
            <textarea 
              v-model="feedbackContent"
              rows="4"
              class="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all resize-none text-sm font-medium"
              placeholder="请输入您的反馈内容..."
            ></textarea>
            
            <div class="bg-blue-50 border border-blue-100 rounded-xl py-3 px-4 flex items-center justify-between">
              <span class="text-[10px] font-bold text-blue-600 uppercase tracking-widest">紧急问题请联系微信</span>
              <span class="text-xs font-black text-blue-700 select-all">18302085349</span>
            </div>
          </div>

          <button 
            @click="submitFeedback"
            :disabled="!feedbackContent.trim() || isSubmitting"
            class="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center space-x-2 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Loader2 v-if="isSubmitting" class="w-5 h-5 animate-spin" />
            <Send v-else class="w-5 h-5" />
            <span>{{ isSubmitting ? '提交中...' : '发送反馈' }}</span>
          </button>
        </div>

        <div v-else class="py-12 text-center space-y-4 animate-in fade-in zoom-in duration-500">
          <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto mb-6">
            <CheckCircle2 class="w-10 h-10" />
          </div>
          <h3 class="text-2xl font-black text-gray-900">提交成功</h3>
          <p class="text-gray-500 font-medium">感谢您的宝贵建议！<br>我们会认真阅读并持续改进项目。</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
  background: #cbd5e1;
}
</style>
