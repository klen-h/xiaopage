import axios from 'axios';

const JIN10_COOKIE = process.env.JIN10_COOKIE || '9aadfcc0-4a6e-4c89-a65b-a7c706ff98b6'; // 从环境变量读

async function fetchJin10HotFlash() {
  const params = JSON.stringify({ hot: ["爆", "沸"], channel: [1, 5] });
  
  try {
    const { data } = await axios.get(
      `https://3318fc142ea545eab931e22a61ec6e5c.z3c.jin10.com/flash?params=${encodeURIComponent(params)}`,
      {
        headers: {
          'accept': 'application/json, text/plain, */*',
          'accept-language': 'zh-CN,zh;q=0.9',
          'handleerror': 'true',
          'origin': 'https://www.jin10.com',
          'referer': 'https://www.jin10.com/',
          'sec-ch-ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
          'x-app-id': 'bVBF4FyRTn5NJF5n',
          'x-version': '1.0',
          'cookie': JIN10_COOKIE
        },
        timeout: 15000
      }
    );
    
    console.log('✅ 获取成功，条数:', data?.data?.slice(0, 3) || '未知');
    return data;
  } catch (error) {
    console.error('❌ 获取失败:', error.response?.status, error.response?.statusText);
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.error('提示: Cookie 可能已过期，需要更新 x-token');
    }
    return null;
  }
}

// 测试
fetchJin10HotFlash();