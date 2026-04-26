import axios from 'axios';
import { getLocalDateString } from '@/utils/sentiment'
import { db } from '@/utils/tcb'

export interface MarketIndex {
  date: string;
  close: number;
  change: number;
  changePercent: number;
}

export interface SectorItem {
  name: string;
  code: string;
  changePercent: number;
  mainInflow: number; // 主力净流入
}

export interface StockQuote {
  name: string;
  code: string;
  price: number;
  change: number;
  changePercent: number;
  pe: number; // 市盈率 TTM
  pb: number; // 市净率
  totalMV: number; // 总市值 (亿)
  circulatingMV?: number; // 流通市值 (亿)
  turnover: number; // 换手率
  volume: number; // 成交量 (手)
  amount: number; // 成交额 (万)
  high: number;
  low: number;
  high52?: number; // 52周最高
  low52?: number; // 52周最低
  amplitude?: number; // 振幅 (%)
  roe?: number; // 净资产收益率 (%)
}

export interface StockFlow {
  code: string;
  name: string;
  mainInflow: number; // 主力净流入 (万)
  retailInflow: number; // 散户净流入 (万)
  totalInflow: number; // 总成交额 (万)
  date: string;
}

/**
 * 获取个股实时行情及估值指标 (腾讯接口)
 */
export const fetchStockQuote = async (code: string): Promise<StockQuote | null> => {
  try {
    // 处理代码前缀，默认补全 (通常 A 股 6 开头为 sh, 其他为 sz)
    let fullCode = code.toLowerCase();
    if (!fullCode.startsWith('sh') && !fullCode.startsWith('sz')) {
      fullCode = (code.startsWith('6') || code.startsWith('9')) ? `sh${code}` : `sz${code}`;
    }

    const res = await axios.get(`https://qt.gtimg.cn/q=${fullCode}`, {
      responseType: 'text'
    });
    
    // v_sz000858="51~五 粮 液~000858~27.78~..."
    const dataStr = res.data;
    if (dataStr.includes('v_pv_none_match')) return null;

    const parts = dataStr.split('~');
    if (parts.length > 46) {
      return {
        name: parts[1],
        code: parts[2],
        price: parseFloat(parts[3]),
        change: parseFloat(parts[31]),
        changePercent: parseFloat(parts[32]),
        pe: parseFloat(parts[39]),
        pb: parseFloat(parts[46]),
        totalMV: parseFloat(parts[45]),
        circulatingMV: parseFloat(parts[44]),
        turnover: parseFloat(parts[38]),
        volume: parseFloat(parts[36]),
        amount: parseFloat(parts[37]),
        high: parseFloat(parts[33]),
        low: parseFloat(parts[34]),
        amplitude: parseFloat(parts[43]),
        high52: parseFloat(parts[47]),
        low52: parseFloat(parts[48])
      };
    }
    return null;
  } catch (err) {
    console.error(`获取个股 ${code} 行情失败:`, err);
    return null;
  }
};

/**
 * 获取个股资金流向 (腾讯接口)
 */
export const fetchStockFlow = async (code: string): Promise<StockFlow | null> => {
  try {
    let fullCode = code.toLowerCase();
    if (!fullCode.startsWith('sh') && !fullCode.startsWith('sz')) {
      fullCode = (code.startsWith('6') || code.startsWith('9')) ? `sh${code}` : `sz${code}`;
    }

    const res = await axios.get(`https://qt.gtimg.cn/q=ff_${fullCode}`, {
      responseType: 'text'
    });
    
    // v_ff_sz000858="sz000858~41773.67~48096.67~-6322.99~-5.53~10200.89~14351.02~-4150.13~-3.63~114422.25~...~五 粮 液~20121221";
    const dataStr = res.data;
    if (dataStr.includes('v_pv_none_match')) return null;

    const parts = dataStr.split('~');
    if (parts.length > 13) {
      return {
        code: parts[0],
        mainInflow: parseFloat(parts[3]),
        retailInflow: parseFloat(parts[7]),
        totalInflow: parseFloat(parts[9]),
        name: parts[12],
        date: parts[13]
      };
    }
    return null;
  } catch (err) {
    console.error(`获取个股 ${code} 资金流向失败:`, err);
    return null;
  }
};

/**
 * 获取特定日期的行业板块快照
 */
export const fetchSectorHeatmapByDate = async (date: string): Promise<{ data: SectorItem[], updateTime: number | null }> => {
  try {
    // 优先尝试从 sector_history 集合按日期读取
    const res = await db.collection('sector_history').doc(date).get();
    
    if (res.data && res.data.length > 0) {
      const snapshot = res.data[0];
      return {
        data: snapshot.data,
        updateTime: snapshot.updateTime || null
      };
    }
    return { data: [], updateTime: null };
  } catch (err) {
    console.error(`获取日期 ${date} 的板块快照失败:`, err);
    return { data: [], updateTime: null };
  }
};

/**
 * 获取行业板块热力图数据 (从云端快照获取) - 默认获取最新快照
 */
export const fetchSectorHeatmap = async (): Promise<{ data: SectorItem[], updateTime: number | null }> => {
  try {
    const res = await db.collection('market_snapshots').doc('latest_sectors').get();
    
    if (res.data && res.data.length > 0) {
      const snapshot = res.data[0];
      return {
        data: snapshot.data,
        updateTime: snapshot.updateTime || null
      };
    }
    return { data: [], updateTime: null };
  } catch (err) {
    console.error('从云端获取最新板块快照失败:', err);
    return { data: [], updateTime: null };
  }
};

/**
 * 获取上证指数当前行情 (腾讯财经接口)
 */
export const fetchSSEIndexCurrent = async (): Promise<MarketIndex | null> => {
  try {
    // 使用 jsonp 方式或代理，此处先尝试直接 fetch (腾讯 API 通常支持跨域)
    const res = await axios.get(`https://qt.gtimg.cn/q=s_sh000001`, {
      responseType: 'text'
    });
    
    // 解析返回的字符串: v_s_sh000001="1~上证指数~000001~3047.05~-20.34~-0.66~..."
    const dataStr = res.data;
    const parts = dataStr.split('~');
    if (parts.length > 5) {
      return {
        date: getLocalDateString(),
        close: parseFloat(parts[3]),
        change: parseFloat(parts[4]),
        changePercent: parseFloat(parts[5])
      };
    }
    return null;
  } catch (err) {
    console.error('获取上证指数行情失败:', err);
    return null;
  }
};

/**
 * 模拟历史行情数据 (由于公开历史 API 较少且存在跨域限制，
 * 建议在管理后台手动同步或使用云函数抓取存入数据库)
 */
export const getMockHistoricalData = (dates: string[]): MarketIndex[] => {
  // 仅作为演示，实际应从 Cloudbase market_indices 集合读取
  return dates.map(date => ({
    date,
    close: 3000 + Math.random() * 200,
    change: (Math.random() - 0.5) * 50,
    changePercent: (Math.random() - 0.5) * 2
  }));
};
