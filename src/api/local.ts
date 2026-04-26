/**
 * 本地数据获取工具
 * 用于开发环境直接读取本地 JSON 文件
 */

/**
 * 从本地 public 目录读取 JSON 文件
 * @param fileName 文件名，如 'candidates_debug.json'
 */
export const fetchLocalData = async (fileName: string) => {
  try {
    const response = await fetch(`/data/${fileName}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`读取本地数据失败: ${fileName}`, error);
    return null;
  }
};