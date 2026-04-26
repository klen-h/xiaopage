import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import './style.css'
import App from './App.vue'

const routes = [
  { 
    path: '/', 
    component: () => import('./views/Dashboard.vue'),
    meta: { title: '首页看板' }
  },
  { 
    path: '/videos', 
    component: () => import('./views/VideoList.vue'),
    meta: { title: '视频列表' }
  },
  { 
    path: '/knowledge', 
    component: () => import('./views/Knowledge.vue'),
    meta: { title: '投资战略知识库' }
  },
  { 
    path: '/analysis/:id', 
    component: () => import('./views/AnalysisDetail.vue'),
    meta: { title: '深度解析' }
  },
  { 
    path: '/trends', 
    component: () => import('./views/Trends.vue'),
    meta: { title: '趋势追踪' }
  },
  { 
    path: '/lingo', 
    component: () => import('./views/Lingo.vue'),
    meta: { title: '大霄黑话百科' }
  },
  { 
    path: '/sentiment-calendar', 
    component: () => import('./views/SentimentCalendar.vue'),
    meta: { title: '情绪演化日历' }
  },
  { 
    path: '/value-investment', 
    component: () => import('./views/ValueInvestment.vue'),
    meta: { title: '好股价值探测' }
  },
  { 
    path: '/stock-candidates', 
    component: () => import('./views/StockCandidates.vue'),
    meta: { title: '初筛备选池' }
  },
  { 
    path: '/logic-factors', 
    component: () => import('./views/LogicFactorsDetail.vue'),
    meta: { title: '思维地图全景' }
  },
  { 
    path: '/sector-analysis', 
    component: () => import('./views/SectorAnalysisDetail.vue'),
    meta: { title: '板块情绪全景追踪' }
  },
  { 
    path: '/admin-portal', 
    component: () => import('./views/Admin.vue'),
    meta: { title: '数据管理后台' }
  },
  // { 
  //   path: '/settings', 
  //   component: () => import('./views/Settings.vue'),
  //   meta: { title: '系统设置' }
  // }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
