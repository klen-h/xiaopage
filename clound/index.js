const cloud = require('@cloudbase/node-sdk');
const axios = require('axios');

exports.main = async (event, context) => {
  const app = cloud.init();
  const db = app.database();

  try {
    const allSectors = [];
    // 循环请求 5 页数据以覆盖 496 条记录
    for (let pn = 1; pn <= 5; pn++) {
      console.log(`正在抓取第 ${pn} 页...`);
      const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=${pn}&pz=100&fs=m:90+t:2&fields=f12,f14,f2,f3,f4,f62,f184,f204,f205&fid=f3&po=1&ut=bd1d9ddb04089700cf9c27f6f7426281`;
      
      const res = await axios.get(url, {
        timeout: 10000,
        headers: {
          'Referer': 'https://quote.eastmoney.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (res.data && res.data.data && res.data.data.diff) {
        const pageData = Object.values(res.data.data.diff).map(item => ({
          code: item.f12,
          name: item.f14,
          // 接口返回的 f3 是涨跌幅 * 100，例如 437 表示 4.37%
          changePercent: item.f3 ? (item.f3 / 100) : 0, 
          mainInflow: item.f62 || 0
        }));
        allSectors.push(...pageData);
      }
    }

    if (allSectors.length > 0) {
      // 更新数据库快照
      await db.collection('market_snapshots').doc('latest_sectors').set({
        data: allSectors,
        updateTime: Date.now(),
        source: 'eastmoney_paged',
        total: allSectors.length
      });

      return { success: true, count: allSectors.length };
    }
    
    throw new Error('No data fetched');
  } catch (err) {
    console.error('Sync failed:', err);
    return { success: false, error: err.message };
  }
};