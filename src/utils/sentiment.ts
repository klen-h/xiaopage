
/**
 * 统一的情绪逻辑工具函数
 * 基于 sentiment_score (0-100) 自动生成标签和颜色
 */

export const getSentimentLabel = (score: number): string => {
  if (score >= 76) return '极度狂热'
  if (score >= 56) return '乐观'
  if (score >= 46) return '谨慎偏多'
  if (score >= 36) return '谨慎偏空'
  if (score >= 16) return '悲观'
  return '极度恐慌'
}

export const getSentimentDescription = (score: number): string => {
  if (score >= 76) return '史上最大IPO / 泡沫顶部'
  if (score >= 56) return '开门红 / 反弹延续'
  if (score >= 46) return '平衡震荡 / 密切关注'
  if (score >= 36) return '从进攻转为防御 / 余钱好股不恐慌'
  if (score >= 16) return '反弹非反转 / 下跌趋势'
  return '腥风血雨 / 黑色三月'
}

export const getSentimentColorClass = (score: number): string => {
  if (score >= 76) return 'bg-purple-100 text-purple-700 border-purple-200' // 泡沫顶部
  if (score >= 56) return 'bg-red-100 text-red-700 border-red-200'       // 乐观
  if (score >= 46) return 'bg-orange-100 text-orange-700 border-orange-200' // 谨慎偏多
  if (score >= 36) return 'bg-yellow-50 text-yellow-700 border-yellow-100' // 谨慎偏空
  if (score >= 16) return 'bg-blue-50 text-blue-600 border-blue-100'      // 悲观
  return 'bg-blue-200 text-blue-800 border-blue-300'                   // 极度恐慌
}

export const getSentimentHexColor = (score: number): string => {
  if (score >= 76) return '#7e22ce' // purple-700
  if (score >= 56) return '#b91c1c' // red-700
  if (score >= 46) return '#c2410c' // orange-700
  if (score >= 36) return '#a16207' // yellow-700
  if (score >= 16) return '#2563eb' // blue-600
  return '#1e40af' // blue-800
}

/**
 * 获取本地日期字符串 (YYYY-MM-DD)
 * 解决 toISOString() 导致的 UTC 偏移问题
 */
export const getLocalDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 获取本地时间戳字符串 (YYYY-MM-DD HH:MM:SS)
 */
export const getLocalTimestampString = (date: Date = new Date()): string => {
  const dateStr = getLocalDateString(date);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${dateStr} ${hours}:${minutes}:${seconds}`;
};
