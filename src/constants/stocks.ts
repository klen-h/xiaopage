/**
 * 卫星持股法分类：
 * - CORE: 核心资产，大盘蓝筹，分红稳定，波动小，适合长线配置 (如：四大行、三桶油、长电、茅台)
 * - SATELLITE: 卫星资产，成长性强，波动大，适合短线博弈或波段 (如：宁德、比亚迪、东财、恒瑞)
 */
export interface StockConfig {
  name: string;
  code: string;
  type: 'CORE' | 'SATELLITE';
  sector?: string;
}

export const valuePoolStocks: StockConfig[] = [
  // --- CORE 核心资产 (压舱石) ---
  { name: '招商银行', code: '600036', type: 'CORE', sector: '金融' },
  { name: '中国平安', code: '601318', type: 'CORE', sector: '金融' },
  { name: '工商银行', code: '601398', type: 'CORE', sector: '金融' },
  { name: '建设银行', code: '601939', type: 'CORE', sector: '金融' },
  { name: '农业银行', code: '601288', type: 'CORE', sector: '金融' },
  { name: '中国银行', code: '601988', type: 'CORE', sector: '金融' },
  { name: '长江电力', code: '600900', type: 'CORE', sector: '电力' },
  { name: '中国石油', code: '601857', type: 'CORE', sector: '能源' },
  { name: '中国神华', code: '601088', type: 'CORE', sector: '煤炭' },
  { name: '中国海油', code: '600938', type: 'CORE', sector: '能源' },
  { name: '中国建筑', code: '601668', type: 'CORE', sector: '基建' },
  { name: '贵州茅台', code: '600519', type: 'CORE', sector: '消费' },
  { name: '五粮液', code: '000858', type: 'CORE', sector: '消费' },
  { name: '海螺水泥', code: '600585', type: 'CORE', sector: '材料' },
  { name: '宝钢股份', code: '600019', type: 'CORE', sector: '材料' },
  
  // --- SATELLITE 卫星资产 (进取) ---
  { name: '宁德时代', code: '300750', type: 'SATELLITE', sector: '新能源' },
  { name: '比亚迪', code: '002594', type: 'SATELLITE', sector: '汽车' },
  { name: '隆基绿能', code: '601012', type: 'SATELLITE', sector: '新能源' },
  { name: '东方财富', code: '300059', type: 'SATELLITE', sector: '金融科技' },
  { name: '中信证券', code: '600030', type: 'SATELLITE', sector: '金融' },
  { name: '工业富联', code: '601138', type: 'SATELLITE', sector: '算力/制造' },
  { name: '海康威视', code: '002415', type: 'SATELLITE', sector: '安防/AI' },
  { name: '恒瑞医药', code: '600276', type: 'SATELLITE', sector: '医药' },
  { name: '迈瑞医疗', code: '300760', type: 'SATELLITE', sector: '医疗器械' },
  { name: '紫金矿业', code: '601899', type: 'SATELLITE', sector: '有色' },
  { name: '立讯精密', code: '002475', type: 'SATELLITE', sector: '电子' },
  { name: '北方华创', code: '002371', type: 'SATELLITE', sector: '半导体' },
  { name: '中芯国际', code: '688981', type: 'SATELLITE', sector: '半导体' },
  { name: '万科A', code: '000002', type: 'SATELLITE', sector: '地产' },
  { name: '伊利股份', code: '600887', type: 'SATELLITE', sector: '消费' },
  { name: '格力电器', code: '000651', type: 'SATELLITE', sector: '家电' },
  { name: '美的集团', code: '000333', type: 'SATELLITE', sector: '家电' },
  { name: '药明康德', code: '603259', type: 'SATELLITE', sector: '医药' }
]

/**
 * 快速探测预设 (常驻展示)
 */
export const presetStocks = [
  { name: '招商银行', code: '600036' },
  { name: '中国平安', code: '601318' },
  { name: '五粮液', code: '000858' },
  { name: '工商银行', code: '601398' },
  { name: '宁德时代', code: '300750' }
]
