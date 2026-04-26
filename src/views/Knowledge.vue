<script setup lang="ts">
import { ref } from 'vue'
import { 
  BookOpen, 
  Target, 
  ShieldCheck, 
  TrendingUp, 
  // History, 
  // Lightbulb, 
  Search,
  ExternalLink,
  // ChevronRight,
  // Info,
  BadgeInfo,
  // CheckCircle2,
  // AlertTriangle,
  // ArrowRight,
  ShoppingCart,
  Library
} from 'lucide-vue-next'

const sections = [
  {
    id: 'philosophy',
    title: '一、投资核心理念与原则',
    icon: BookOpen,
    items: [
      {
        subtitle: '价值投资为根基',
        content: '投资需聚焦“好公司”（社会贡献大、分红稳定、估值合理），远离高估五类股（小、新、差、题材、伪成长）。股票投资是“浓缩的人生”，需克服人性弱点（如贪婪、恐惧），仅少数人能坚持价值投资，是一场“异常艰难的修行”。'
      },
      {
        subtitle: '风险控制与资金管理',
        content: '余钱投资：只能使用长期闲置资金（30-50年无使用安排），且需承受净值波动。远离杠杆：杠杆放大风险，普通人应避免融资、衍生品和高风险产品。散户建议按步骤投资：货币基金 → 债券基金 → 混合基金 → 指数基金 → 股票基金 → 蓝筹股。'
      },
      {
        subtitle: '长期视角与耐心',
        content: '投资成功需15个条件，包括年龄（40岁以上更懂价值投资）、阅历、稳定收入、家庭支持及感恩之心。“交易最高境界是少交易”，播种后持有优质股，享受公司成长红利。'
      }
    ]
  },
  {
    id: 'analysis',
    title: '二、市场分析与风向标',
    icon: Target,
    items: [
      {
        subtitle: '四大核心风向标',
        content: '政策动向（国家队增持、IPO节奏）、资金面（外资流向、社保金入市）、估值水平（PE/PB历史分位）、散户情绪（开户数、基金热度）。需逆向操作，在舆论“一边倒”时警惕反转。'
      },
      {
        subtitle: '重要底部与顶部点位',
        content: '底部：325、998、1664、1849、2440、2635、2689。顶部：1558、2245、6124、5178、3731。需在恐慌中播种，狂热中淡泊离场。'
      },
      {
        subtitle: '跨市场关联',
        content: '关注港币波动对A/H股联动的影响；汇率变化（如人民币升值）预示外资动向；资源市场（原油、粮食）影响全球股市；AH溢价指数（2024年约137%）是套利参考。'
      }
    ]
  },
  {
    id: 'implementation',
    title: '三、四大风向标实操方法',
    icon: ShieldCheck,
    isSpecial: true,
    subsections: [
      {
        title: '政策动向监测',
        source: '证监会/交易所公告、央行货币政策报告',
        signals: '关注IPO节奏调整、减持新规、回购政策、汇金增持公告（2024年2月汇金增持ETF超3500亿同步政策底信号）。'
      },
      {
        title: '资金面分析',
        source: '沪深港通、Wind/同花顺、中国基金报',
        signals: '外资流向（2024年流入734亿→起点）、ETF份额变化、融资余额（>1.5万亿警示风险）。'
      },
      {
        title: '估值水平量化',
        source: '中证指数官网、理杏仁、iFinD',
        signals: '计算PE/PB历史分位（如2024年上证2635点，PE 11.6倍为10年分位10%底部）。股息率 > 4% 跑赢存款利率。'
      },
      {
        title: '散户情绪观测',
        source: '中国结算月度报告、好买基金网',
        signals: '新增投资者数（单月开户>200万狂热风险）、爆款基金比例、偏股基金仓位(>90%风险)。'
      }
    ]
  },
  {
    id: 'outlook',
    title: '四、2024年股市趋势展望',
    icon: TrendingUp,
    items: [
      {
        subtitle: '当前市场基础',
        content: '估值吸引力：上证3000点附近，银行指数PE 5.1倍，股息率高于存款利率，优质资产进入“融冰之旅”。资金动向：外资空翻多，长期资金入市提速。'
      },
      {
        subtitle: '技术性牛市与全球配置',
        content: 'A股突破年线，港股率先进入牛市，核心资产重心上移。美股高估值风险凸显，中国资产成为“全球价值洼地”，散户建议拥抱高股息、低估值龙头股。'
      }
    ]
  }
]

const activeSection = ref('philosophy')

const scrollTo = (id: string) => {
  activeSection.value = id
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
</script>

<template>
  <div class="flex flex-col lg:flex-row gap-6 lg:gap-8 animate-in fade-in duration-700 pb-10">
    <!-- Navigation Sidebar (Sticky on Desktop, Scroll on Mobile) -->
    <div class="lg:w-64 flex-shrink-0">
      <div class="lg:sticky lg:top-24 bg-white rounded-2xl p-2 lg:p-4 shadow-sm border border-gray-100 flex lg:flex-col overflow-x-auto lg:overflow-x-visible scrollbar-hide space-x-2 lg:space-x-0 lg:space-y-1">
        <h3 class="px-3 py-2 text-[10px] lg:text-xs font-black text-gray-400 uppercase tracking-widest mb-2 hidden lg:block">目录索引</h3>
        <button 
          v-for="section in sections" 
          :key="section.id"
          @click="scrollTo(section.id)"
          :class="[
            'flex-shrink-0 lg:w-full text-left px-4 py-2.5 lg:py-3 rounded-xl text-xs lg:text-sm font-bold transition-all flex items-center group whitespace-nowrap lg:whitespace-normal',
            activeSection === section.id 
              ? 'bg-primary-50 text-primary-600 shadow-sm border border-primary-100 lg:border-transparent' 
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
          ]"
        >
          <component 
            :is="section.icon" 
            :class="[
              'w-4 h-4 mr-2 lg:mr-3 flex-shrink-0',
              activeSection === section.id ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-600'
            ]" 
          />
          <span>{{ section.title.split('、')[1] }}</span>
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 space-y-8 lg:space-y-12">
      <!-- Header Card -->
      <div class="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl lg:rounded-3xl p-6 lg:p-10 text-white shadow-xl shadow-primary-100 relative overflow-hidden">
        <div class="absolute -top-20 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
        <div class="relative z-10 max-w-2xl">
          <div class="inline-flex items-center px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] lg:text-xs font-bold mb-4 lg:mb-6 border border-white/20">
            <BookOpen class="w-3 h-3 mr-2" />
            首席研判官价值投资理念研习笔记
          </div>
          <h1 class="text-2xl lg:text-4xl font-black mb-4 lg:mb-6 leading-tight">投资者的“融冰之旅”：<br class="hidden sm:block"/>建立属于你的价值投资堡垒</h1>
          <p class="text-primary-50 text-sm lg:text-lg leading-relaxed font-medium">
            本知识库忠实汇总了首席研判官的核心观点，涵盖投资理念、市场分析、实操指标及趋势预测，助力您构建稳健的投资框架。
          </p>
        </div>
      </div>

      <!-- Book Recommendation Section -->
      <section class="bg-white rounded-2xl lg:rounded-3xl p-6 lg:p-8 border-2 border-primary-100 shadow-xl shadow-primary-50 relative overflow-hidden group">
        <div class="absolute -right-12 -bottom-12 w-48 h-48 bg-primary-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700"></div>
        <div class="relative z-10 flex flex-col sm:flex-row items-center gap-6 lg:gap-10">
          <!-- Book Cover Mockup -->
          <div class="w-24 h-32 lg:w-32 lg:h-44 bg-gradient-to-tr from-primary-700 to-primary-500 rounded-lg shadow-2xl flex-shrink-0 flex items-center justify-center p-3 lg:p-4 text-center transform lg:-rotate-3 group-hover:rotate-0 transition-transform duration-500">
            <div class="border-2 border-white/20 w-full h-full rounded flex flex-col items-center justify-center">
              <Library class="w-6 h-6 lg:w-8 lg:h-8 text-white/40 mb-2" />
              <span class="text-[8px] lg:text-[10px] font-black text-white leading-tight uppercase tracking-tighter">投资战略<br/>核心精要</span>
            </div>
          </div>
          
          <div class="flex-1 text-center sm:text-left">
            <div class="inline-flex items-center px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-3 lg:mb-4 border border-orange-100">
              <ShoppingCart class="w-3 h-3 mr-1.5" />
              正版推荐
            </div>
            <h3 class="text-xl lg:text-2xl font-black text-gray-900 mb-2 lg:mb-3">想要更系统地学习投资逻辑？</h3>
            <p class="text-gray-500 text-sm lg:text-lg font-medium leading-relaxed mb-4 lg:mb-6">
              本研习笔记仅提炼核心要点。为了获得最完整的知识体系与实战案例，我们强烈建议您阅读原著书籍。
            </p>
            <a 
              href="https://s.click.taobao.com/t?e=m%3D2%26s%3DS0RL0sDvE4hw4vFB6t2Z2ueEDrYVVa64yK8Cckff7TVRAdhuF14FMRadJm6GQiuw8sviUM61dt2Kdq73WHoF5MdtXFf9wbiDipprVA%2Bwc13Pk%2FQUkpkFrTKooNITTvQdOlGkMkr%2BSUUYmUGuVZn0ucSRSTgEXEn3NRfnJ9tN82I56ZoUzm0cdmwCZH9%2BF3YFPQeMVxBk301WBSWbeZspjr%2FYHOgx0BINcfk3LeskbtB7S2Lov%2FFIBlVkeSl6Cwx%2BaRgu2UrXjoZSzORAvonu3fb5yZgWRV37A5aT98QfFAAJw%2BKrWu%2FKQV7aIaoKwdKaC7GY0HXgAlXBn6vPtuk09AIk3r8mqEmgtF8krHA1eWtCJASF4xHvYGQ%2BViugkO45YwWJLGqEUHhZGn1hpTRhgMsr%2FPr69IeL05HOAvKfZN%2B240%2BvL74seEskcTLh%2BfYJomfkDJRs%2BhU%3D&union_lens=lensId:TAPI@1775216082@2166ed01_160a_19d531fbdee_0bea@01&cont_id=BV1Rs9MB2E3j" 
              target="_blank"
              class="inline-flex items-center px-6 py-3 lg:px-8 lg:py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl lg:rounded-2xl font-black shadow-lg shadow-orange-200 transition-all hover:-translate-y-1 active:translate-y-0 text-sm lg:text-base"
            >
              前往淘宝购买正版书籍
              <ExternalLink class="ml-2 w-4 h-4 lg:w-5 lg:h-5" />
            </a>
          </div>
        </div>
      </section>

      <!-- Sections -->
      <div v-for="section in sections" :key="section.id" :id="section.id" class="scroll-mt-24">
        <div class="flex items-center space-x-4 mb-8">
          <div class="w-12 h-12 bg-primary-100 rounded-2xl flex items-center justify-center text-primary-600 shadow-sm border border-primary-50">
            <component :is="section.icon" class="w-6 h-6" />
          </div>
          <h2 class="text-2xl font-black text-gray-900">{{ section.title }}</h2>
        </div>

        <!-- Special Layout for Implementation -->
        <div v-if="section.isSpecial" class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div 
            v-for="sub in section.subsections" 
            :key="sub.title"
            class="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm hover:shadow-lg transition-all group hover:-translate-y-1"
          >
            <div class="flex items-center justify-between mb-6">
              <h4 class="text-lg font-bold text-gray-900 flex items-center">
                <BadgeInfo class="w-5 h-5 mr-2 text-primary-500" />
                {{ sub.title }}
              </h4>
              <Search class="w-5 h-5 text-gray-200 group-hover:text-primary-400 transition-colors" />
            </div>
            <div class="space-y-4">
              <div class="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">数据来源</span>
                <p class="text-sm text-gray-600 font-medium">{{ sub.source }}</p>
              </div>
              <div class="p-4 bg-primary-50 rounded-2xl border border-primary-100">
                <span class="text-[10px] font-black text-primary-400 uppercase tracking-widest block mb-1">核心监测信号</span>
                <p class="text-sm text-primary-900 leading-relaxed font-bold">{{ sub.signals }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Default Layout -->
        <div v-else class="space-y-6">
          <div 
            v-for="item in section.items" 
            :key="item.subtitle"
            class="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col md:flex-row gap-8 group"
          >
            <div class="md:w-1/4">
              <div class="inline-flex items-center px-3 py-1 bg-gray-50 text-gray-500 rounded-lg text-xs font-bold border border-gray-100 mb-4">
                {{ item.subtitle }}
              </div>
              <h4 class="text-xl font-bold text-gray-900 group-hover:text-primary-600 transition-colors">{{ item.subtitle }}</h4>
            </div>
            <div class="md:w-3/4">
              <div class="prose prose-lg max-w-none text-gray-600 leading-relaxed font-medium">
                {{ item.content }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Call to Action -->
      <!-- <div class="bg-gray-900 rounded-3xl p-10 text-white flex flex-col md:flex-row items-center justify-between gap-8">
        <div>
          <h3 class="text-2xl font-bold mb-2">准备好进行实操了吗？</h3>
          <p class="text-gray-400">结合最新的视频解析，应用这些投资原则。</p>
        </div>
        <router-link to="/videos" class="px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold transition-all shadow-xl shadow-primary-900/20 flex items-center">
          前往视频解析中心
          <ArrowRight class="ml-2 w-5 h-5" />
        </router-link>
      </div> -->
    </div>
  </div>
</template>

<style scoped>
.scroll-mt-24 {
  scroll-margin-top: 6rem;
}
</style>
