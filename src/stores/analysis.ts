import { defineStore } from 'pinia'
import { db, login } from '@/utils/tcb'
import { fetchSSEIndexCurrent, fetchSectorHeatmap, fetchSectorHeatmapByDate, type MarketIndex, type SectorItem } from '@/utils/market'
import { getLocalDateString } from '@/utils/sentiment'

export interface LogicFactor {
  factor_name: string;
  factor_value: string;
  weight: number; // 0-1
  direction: '看涨' | '看跌' | '中性';
  description: string;
}

export interface AnalysisItem {
  id: string;
  title: string;
  date: string;
  sentiment_score: number;
  disclaimer_level: number;
  summary: string;
  tags: string[];

  structured: {
    core_views: string[];
    sectors: string[];
    operation_advice: string;
    risk_tips: string[];
  };

  deep_analysis: {
    strategy?: string;
    hidden_meanings: Array<{
      surface: string;
      deep: string;
      quote?: string;
    }>;
    logic_pieces?: Array<{
      title: string;
      content: string;
    }>;
    data_analysis?: {
      points: string[];
      subtext: string;
    };
    signals: string[];
    final_conclusion: string;
  };

  hit_status?: 'hit' | 'miss' | 'pending';
  logic_factors?: LogicFactor[];
  transcript?: string;
  _id?: string;
}

export const useAnalysisStore = defineStore('analysis', {
  state: () => ({
    videos: [] as AnalysisItem[],
    marketIndices: [] as MarketIndex[], // 存储上证指数历史
    sectorPerformance: [] as SectorItem[], // 实时行业板块行情
    sectorUpdateTime: null as number | null, // 板块行情更新时间
    isLoading: false,
    error: null as string | null
  }),
  actions: {
    async fetchVideos() {
      if (this.isLoading) return
      this.isLoading = true
      this.error = null
      try {
        await login();
        
        // 1. 加载视频数据
        const res = await db.collection("analysis_items")
          .orderBy("date", "desc")
          .limit(1000)
          .get();

        if (res.data && res.data.length > 0) {
          this.videos = res.data as AnalysisItem[];
        } else {
          // 兜底本地 JSON
          const baseUrl = import.meta.env.BASE_URL || '/'
          const resLocal = await fetch(`${baseUrl}data/videos.json?t=${Date.now()}`)
          if (resLocal.ok) {
            this.videos = await resLocal.json()
          }
        }

        // 2. 加载指数数据 (从 market_indices 集合)
        const marketRes = await db.collection("market_indices")
          .orderBy("date", "asc")
          .limit(1000)
          .get();
        
        if (marketRes.data) {
          this.marketIndices = marketRes.data as MarketIndex[];
        }

        // 3. 加载行业实时数据
        await this.fetchSectorData();

        // 4. 尝试更新今日指数 (如果还没有今日数据)
        const today = getLocalDateString();
        const now = new Date();
        const isAfterMarketClose = now.getHours() >= 15; // 只有下午三点收盘后

        if (!this.marketIndices.find(m => m.date === today)) {
          const currentMarket = await fetchSSEIndexCurrent();
          if (currentMarket) {
            this.marketIndices.push(currentMarket);
            // 只有下午三点收盘后才自动存入数据库供所有人查看
            if (isAfterMarketClose) {
              await db.collection("market_indices").add(currentMarket).catch(() => {});
            }
          }
        }

      } catch (err: any) {
        console.error('加载数据失败:', err)
        this.error = err.message
      } finally {
        this.isLoading = false
      }
    },

    async fetchSectorData() {
      try {
        const { data, updateTime } = await fetchSectorHeatmap();
        if (data && data.length > 0) {
          this.sectorPerformance = data;
          this.sectorUpdateTime = updateTime;
        }
      } catch (err) {
        console.error('获取行业数据失败:', err);
      }
    },

    async fetchSectorDataByDate(date: string) {
      try {
        const { data, updateTime } = await fetchSectorHeatmapByDate(date);
        if (data && data.length > 0) {
          this.sectorPerformance = data;
          this.sectorUpdateTime = updateTime;
        } else {
          // 如果指定日期没有数据，清空当前表现以防误导
          this.sectorPerformance = [];
          this.sectorUpdateTime = null;
        }
      } catch (err) {
        console.error(`获取日期 ${date} 的行业数据失败:`, err);
      }
    },

    async addAnalysisItem(item: AnalysisItem) {
      this.isLoading = true;
      try {
        await login();
        const res = await db.collection("analysis_items").add(item);
        if (!res.id) throw new Error('新增失败');
        await this.fetchVideos();
        return true;
      } catch (err: any) {
        throw err;
      } finally {
        this.isLoading = false;
      }
    }
  },
  getters: {
    getVideoById: (state) => (id: string) => state.videos.find(v => v.id === id),
    availableDates: (state) => {
      const dates = state.videos.map(v => v.date.split(' ')[0])
      return [...new Set(dates)].sort()
    },
    getVideosByDate: (state) => (date: string) => {
      return state.videos.filter(v => v.date.startsWith(date))
    },
    getCurrentMarketTemperature: (state) => {
      if (state.videos.length === 0) return 50
      const sum = state.videos.reduce((acc, v) => acc + v.sentiment_score, 0)
      return Math.round(sum / state.videos.length)
    },
    getSectorStats: (state) => {
      const sectorsMap: Record<string, { count: number, totalScore: number }> = {}
      state.videos.forEach(v => {
        v.structured.sectors.forEach(s => {
          if (!sectorsMap[s]) sectorsMap[s] = { count: 0, totalScore: 0 }
          sectorsMap[s].count++
          sectorsMap[s].totalScore += v.sentiment_score
        })
      })
      
      const stats = Object.entries(sectorsMap).map(([name, data]) => ({
        name,
        count: data.count,
        averageScore: Math.round(data.totalScore / data.count),
        heat: Math.min(100, data.count * 20) // 简单模拟热度计算
      }))
      
      return stats.sort((a, b) => b.count - a.count)
    },
    getSentimentTrend: (state) => {
      const dailyStats: Record<string, { total: number, count: number }> = {}
      state.videos.forEach(v => {
        const date = v.date.split(' ')[0]
        if (!dailyStats[date]) dailyStats[date] = { total: 0, count: 0 }
        dailyStats[date].total += v.sentiment_score
        dailyStats[date].count++
      })
      return Object.entries(dailyStats)
        .map(([date, data]) => ({
          date,
          score: Math.round(data.total / data.count)
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
    },

    // 情感与行情的叠加数据
    getTrendCorrelation(): any[] {
      const sentimentTrend = this.getSentimentTrend;
      return sentimentTrend.map((s: { date: string; score: any; }) => {
        const market = this.marketIndices.find(m => m.date === s.date);
        return {
          date: s.date,
          sentiment: s.score,
          marketClose: market ? market.close : null,
          marketChange: market ? market.changePercent : null
        };
      });
    },

    getHitRateStats(): any {
      // 自动验证逻辑：基于“每日平均情绪”进行对标校验
      const dailyTrend = this.getSentimentTrend; // 使用 this 访问 getter
      
      let hit = 0;
      let miss = 0;
      let pending = 0;

      dailyTrend.forEach((day: { date: string; score: number; }) => {
        const market = this.marketIndices.find(m => m.date === day.date);

        if (!market) {
          pending++;
          return;
        }

        // 定义观点倾向：偏多(>55)，偏空(<45)，中性(45-55)
        const isBullish = day.score >= 56;
        const isBearish = day.score <= 44;
        const marketUp = market.changePercent > 0;
        const marketDown = market.changePercent < 0;

        if ((isBullish && marketUp) || (isBearish && marketDown)) {
          hit++;
        } else if ((isBullish && marketDown) || (isBearish && marketUp)) {
          miss++;
        } else {
          pending++; // 震荡或中性情绪暂不计入
        }
      });

      const total = hit + miss;
      return {
        rate: total > 0 ? Math.round((hit / total) * 100) : 0,
        hit,
        miss,
        pending
      };
    },
    getHighRiskVideos: (state) => {
      return [...state.videos].sort((a, b) => b.disclaimer_level - a.disclaimer_level)
    }
  }
})