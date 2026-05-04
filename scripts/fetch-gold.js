import YahooFinance from "yahoo-finance2";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const yahooFinance = new YahooFinance();

// ESM 中兼容 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SYMBOLS = {
  spotGold: "XAUUSD=X",   // 现货黄金/美元
//   comexGold: "GC=F",      // COMEX 黄金期货
//   goldETF: "GLD",         // SPDR 黄金 ETF
};

async function fetchGoldData() {
  const now = new Date();
  const timestamp = now.toISOString();

  console.log(`[${timestamp}] 开始获取黄金数据...`);

  const results = {};

  for (const [name, ticker] of Object.entries(SYMBOLS)) {
    try {
      const quote = await yahooFinance.quote(ticker);

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const history = await yahooFinance.historical(ticker, {
        period1: startDate,
        period2: endDate,
        interval: "1d",
      });

      const { regularMarketPrice, regularMarketChange, regularMarketChangePercent, regularMarketOpen, regularMarketDayHigh, regularMarketDayLow, regularMarketPreviousClose, regularMarketVolume, currency, marketState } = quote;

      results[name] = {
        ticker,
        timestamp,
        price: regularMarketPrice,
        change: regularMarketChange,
        changePercent: regularMarketChangePercent,
        open: regularMarketOpen,
        high: regularMarketDayHigh,
        low: regularMarketDayLow,
        previousClose: regularMarketPreviousClose,
        volume: regularMarketVolume,
        currency,
        marketState,
        history: history.map((h) => ({
          date: h.date.toISOString().split("T")[0],
          open: h.open,
          high: h.high,
          low: h.low,
          close: h.close,
          volume: h.volume,
        })),
      };

      console.log(`✅ ${name} (${ticker}): $${regularMarketPrice}`);
    } catch (error) {
      console.error(`❌ ${name} (${ticker}) 获取失败:`, error.message);
      results[name] = { ticker, timestamp, error: error.message };
    }
  }

  const dataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // 追加历史
  const historyFile = path.join(dataDir, "gold-history.json");
  let allData = [];
  if (fs.existsSync(historyFile)) {
    try {
      const existing = JSON.parse(fs.readFileSync(historyFile, "utf8"));
      allData = Array.isArray(existing) ? existing : [existing];
    } catch {
      console.warn("历史数据解析失败，将创建新文件");
    }
  }

  allData.push({ fetchTime: timestamp, data: results });
//   if (allData.length > 1000) allData = allData.slice(-1000);

//   fs.writeFileSync(historyFile, JSON.stringify(allData, null, 2));

//   // 最新快照
//   const latestFile = path.join(dataDir, "gold-latest.json");
//   fs.writeFileSync(latestFile, JSON.stringify({ fetchTime: timestamp, data: results }, null, 2));

  console.log(`\n💾 数据已保存`);
  console.log(JSON.stringify(results, null, 2));
}

fetchGoldData().catch((err) => {
  console.error("脚本执行失败:", err);
  process.exit(1);
});