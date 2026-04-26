import type { AnalysisItem } from '@/stores/analysis'

// 从 D1 读取视频数据（通过 Cloudflare Worker 代理）
export async function fetchVideosFromD1(): Promise<AnalysisItem[]> {
  try {
    // TODO: 创建 Cloudflare Worker API 端点
    // const response = await fetch('/api/videos');
    // if (!response.ok) throw new Error('Failed to fetch videos');
    // const data = await response.json();
    // return data.map((row: any) => ({
    //   ...row,
    //   tags: JSON.parse(row.tags),
    //   structured: JSON.parse(row.structured)
    // }));
    
    // 临时降级：使用本地 JSON
    console.warn('D1 API 未配置，降级到本地 JSON');
    const baseUrl = import.meta.env.BASE_URL || '/'
    const res = await fetch(`${baseUrl}data/videos.json?t=${Date.now()}`)
    if (res.ok) {
      return await res.json()
    }
    return []
  } catch (error) {
    console.error('Error fetching videos from D1:', error)
    // 降级到本地 JSON
    const baseUrl = import.meta.env.BASE_URL || '/'
    const res = await fetch(`${baseUrl}data/videos.json?t=${Date.now()}`)
    if (res.ok) {
      return await res.json()
    }
    return []
  }
}
