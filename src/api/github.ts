import axios from 'axios';

const GITHUB_USER = 'klen-h'; // 已更新为您的 GitHub 用户名
const GITHUB_REPO = 'lishaoxia-value-detector';
const GITHUB_RAW_URL = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/main/data/`;

/**
 * 从 GitHub 读取自动化脚本生成的最新报告
 * @param fileName 文件名，如 'latest_report.json'
 */
export const fetchAutomationData = async (fileName: string) => {
  try {
    const response = await axios.get(`${GITHUB_RAW_URL}${fileName}`);
    return response.data;
  } catch (error) {
    console.error(`读取自动化数据失败: ${fileName}`, error);
    return null;
  }
};
