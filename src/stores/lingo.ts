import { defineStore } from 'pinia'

export interface LingoItem {
  id: string;
  term: string;
  pronunciation?: string;
  definition: string;
  background: string;
  example: string;
  market_context: string;
  status: 'active' | 'historical';
  tags: string[];
}

export const useLingoStore = defineStore('lingo', {
  state: () => ({
    lingos: [
      {
        "id": "1",
        "term": "钻石底",
        "pronunciation": "zuàn shí dǐ",
        "definition": "指大盘在某一极低点位形成的极其坚固、具有长期投资价值的底部区域。",
        "background": "2012年研判官在上证指数2132点附近提出，认为这是中国股市极其珍贵的底部。",
        "example": "“2132点就是钻石底，虽然之后跌破了，但那是由于外部环境极端恶化导致的‘破钻’。”",
        "market_context": "市场极度悲观、估值处于历史极低水平时。",
        "status": "historical",
        "tags": ["底部论", "经典语录"]
      },
      {
        "id": "2",
        "term": "婴儿底",
        "pronunciation": "yīng ér dǐ",
        "definition": "比喻市场底部如同新生婴儿般脆弱但充满希望，需要抱紧不放。",
        "background": "2015年8月提出，对应上证指数2850点附近。",
        "example": "“2850点是婴儿底，要抱紧紧，不要被震下车。”",
        "market_context": "股灾后的恐慌性下跌阶段。",
        "status": "historical",
        "tags": ["底部论", "人物成长"]
      },
      {
        "id": "3",
        "term": "儿童底",
        "pronunciation": "ér tóng dǐ",
        "definition": "婴儿底之后的更坚实底部，代表市场进一步稳固。",
        "background": "2016年初提出，对应2638点附近。",
        "example": "“儿童底比婴儿底更扎实，好股票可以放心持有。”",
        "market_context": "熔断暴跌后的缓慢修复期。",
        "status": "historical",
        "tags": ["底部论", "人物成长"]
      },
      {
        "id": "4",
        "term": "幼儿底",
        "pronunciation": "yòu ér dǐ",
        "definition": "介于婴儿底与儿童底之间的底部称呼。",
        "background": "2016年底提出，对应3044点附近。",
        "example": "“幼儿底已经形成，蓝筹股迎来机会。”",
        "market_context": "年末资金紧张、市场震荡时期。",
        "status": "historical",
        "tags": ["底部论", "人物成长"]
      },
      {
        "id": "5",
        "term": "青春底",
        "pronunciation": "qīng chūn dǐ",
        "definition": "代表市场进入成长阶段，底部已经明确。",
        "background": "2017年提出，对应3016点附近。",
        "example": "“青春底之后，市场将更有活力。”",
        "market_context": "监管趋严、价值投资回归的初期。",
        "status": "historical",
        "tags": ["底部论", "人物成长"]
      },
      {
        "id": "6",
        "term": "少年底",
        "pronunciation": "shào nián dǐ",
        "definition": "比青春底更成熟的底部，寓意牛市即将来临。",
        "background": "2018年底提出，对应2449点附近。",
        "example": "“少年底是A股历史大底，不要错过。”",
        "market_context": "贸易摩擦、市场极度低迷的时期。",
        "status": "historical",
        "tags": ["底部论", "人物成长"]
      },
      {
        "id": "7",
        "term": "成人底",
        "pronunciation": "chéng rén dǐ",
        "definition": "比青春底更成熟的底部，意味着市场已经长大成人。",
        "background": "2024年10月提出。",
        "example": "“成人底之后，可以开始买股票了。”",
        "market_context": "2024年四季度市场反复磨底。",
        "status": "current",
        "tags": ["底部论", "人物成长"]
      },
      {
        "id": "8",
        "term": "胎盘底",
        "pronunciation": "tāi pán dǐ",
        "definition": "比婴儿底更早的阶段，用来调侃极端的底部预测。",
        "background": "网络调侃研判官的衍生词，本人偶尔引用。",
        "example": "“有人问我胎盘底在哪里，我说还在孕育中。”",
        "market_context": "市场持续下跌时的戏谑说法。",
        "status": "historical",
        "tags": ["底部论", "网络调侃"]
      },
      {
        "id": "9",
        "term": "黄金底",
        "pronunciation": "huáng jīn dǐ",
        "definition": "比喻底部具有黄金般的投资价值。",
        "background": "2020年疫情期间提出，对应2646点附近。",
        "example": "“疫情砸出的黄金底，是十年一遇的机会。”",
        "market_context": "新冠疫情引发的全球股市暴跌。",
        "status": "current",
        "tags": ["底部论", "宝石金属"]
      },
      {
        "id": "10",
        "term": "政策底",
        "pronunciation": "zhèng cè dǐ",
        "definition": "政府出台利好政策所支撑的底部区域。",
        "background": "研判官多次使用该词，如2018年、2022年。",
        "example": "“政策底已经明确，市场底还会远吗？”",
        "market_context": "监管层密集发声或出台救市措施时。",
        "status": "current",
        "tags": ["底部论", "宏观概念"]
      },
      {
        "id": "11",
        "term": "市场底",
        "pronunciation": "shì chǎng dǐ",
        "definition": "由市场自发交易形成的真正底部，通常晚于政策底。",
        "background": "与政策底配套使用的常见术语。",
        "example": "“政策底之后，耐心等待市场底的出现。”",
        "market_context": "政策底之后的磨底阶段。",
        "status": "current",
        "tags": ["底部论", "宏观概念"]
      },
      {
        "id": "12",
        "term": "地平线",
        "pronunciation": "dì píng xiàn",
        "definition": "指3000点是A股的地平线，未来将永远告别3000点之下。",
        "background": "2009年提出，后被反复打脸但仍坚持。",
        "example": "“3000点是地平线，以后再也见不到3000点以下。”",
        "market_context": "2009年小牛市反弹时期。",
        "status": "historical",
        "tags": ["点位论", "经典语录"]
      },
      {
        "id": "13",
        "term": "地球顶",
        "pronunciation": "dì qiú dǐng",
        "definition": "形容大盘顶部极高，如同地球之顶，建议卖出。",
        "background": "2015年6月，上证指数5178点附近提出。",
        "example": "“地球顶到了，该摘熟苹果了。”",
        "market_context": "2015年杠杆牛市的狂热阶段。",
        "status": "historical",
        "tags": ["顶部论", "经典语录"]
      },
      {
        "id": "14",
        "term": "樱桃",
        "pronunciation": "yīng táo",
        "definition": "谐音“应逃”，暗示市场顶部已到，应该逃跑。",
        "background": "2015年5月研判官在微博发樱桃照片，随后股市大跌。",
        "example": "“研判官晒樱桃，散户快跑。”",
        "market_context": "2015年股灾前夕。",
        "status": "historical",
        "tags": ["顶部论", "水果信号"]
      },
      {
        "id": "15",
        "term": "杨桃",
        "pronunciation": "yáng táo",
        "definition": "谐音“应逃”，同样代表卖出信号。",
        "background": "2022年研判官晒杨桃，暗示市场风险。",
        "example": "“杨桃又来了，注意风险。”",
        "market_context": "2022年市场震荡下跌期间。",
        "status": "current",
        "tags": ["顶部论", "水果信号"]
      },
      {
        "id": "16",
        "term": "游泳救生圈",
        "pronunciation": "yóu yǒng jiù shēng quān",
        "definition": "暗示市场风险大，需要“上岸”离场。可能为网友衍生信号。",
        "background": "2025年视频结尾出现",
        "example": "研判官亲自斜跨游泳救生圈",
        "market_context": "市场极度危险时。",
        "status": "folklore",
        "tags": ["网友衍生", "逃离信号"]
      },
      {
        "id": "17",
        "term": "安全出口",
        "pronunciation": "ān quán chū kǒu",
        "definition": "暗示应该卖出离场，寻找安全出口。可能为网友衍生信号。",
        "background": "2025年视频结尾出现",
        "example": "研判官穿越通道，频繁出现安全出口灯牌",
        "market_context": "市场风险积聚时。",
        "status": "folklore",
        "tags": ["网友衍生", "逃离信号"]
      },
      {
        "id": "18",
        "term": "曙光",
        "pronunciation": "shǔ guāng",
        "definition": "暗示市场最坏的时刻已过，前景变得光明。",
        "background": "早期提出“四线曙光”，后续在2015、2016、2018年多次使用“胜利已经露出第一缕曙光”。",
        "example": "“坚持一下，也许曙光就在眼前。”",
        "market_context": "市场连续下跌后的绝望时刻。",
        "status": "current",
        "tags": ["希望信号", "正面语录"]
      },
      {
        "id": "19",
        "term": "若属实暴风雨或过去",
        "pronunciation": "ruò shǔ shí bào fēng yǔ huò guò qù",
        "definition": "严谨假设：如果坏消息被证实，那么市场的冲击就已经过去。",
        "background": "研判官近期（2026年3月）在个人财富号上使用。暴风雨总会过去是其经典语录。",
        "example": "“我坚定地认为暴风雨总会过去的。”",
        "market_context": "重大利空传闻或政策落地前后。",
        "status": "current",
        "tags": ["希望信号", "正面语录"]
      },
      {
        "id": "20",
        "term": "爱国牛",
        "pronunciation": "ài guó niú",
        "definition": "以爱国情怀为驱动力的牛市。",
        "background": "2019年中美贸易摩擦期间提出。",
        "example": "“爱国牛不会缺席，好股票就是爱国。”",
        "market_context": "外部压力下国产替代与自主可控热潮。",
        "status": "historical",
        "tags": ["动物牛", "情绪驱动"]
      },
      {
        "id": "21",
        "term": "中国牛",
        "pronunciation": "zhōng guó niú",
        "definition": "代表中国崛起背景下的长期牛市。",
        "background": "2017年提出，强调中国经济基本面支撑。",
        "example": "“中国牛是慢牛、长牛。”",
        "market_context": "供给侧改革、核心资产上涨阶段。",
        "status": "current",
        "tags": ["动物牛", "宏大叙事"]
      },
      {
        "id": "22",
        "term": "国际牛",
        "pronunciation": "guó jì niú",
        "definition": "受益于外资流入、A股国际化的牛市。",
        "background": "2018年MSCI纳入A股后提出。",
        "example": "“国际牛将带领蓝筹股走强。”",
        "market_context": "外资持续净买入时期。",
        "status": "historical",
        "tags": ["动物牛", "资金驱动"]
      },
      {
        "id": "23",
        "term": "开放牛",
        "pronunciation": "kāi fàng niú",
        "definition": "金融开放政策催生的牛市。",
        "background": "2019年金融开放新政推出时提出。",
        "example": "“开放牛来了，外资会抢筹。”",
        "market_context": "取消QFII额度限制等政策出台。",
        "status": "historical",
        "tags": ["动物牛", "政策驱动"]
      },
      {
        "id": "24",
        "term": "大国牛",
        "pronunciation": "dà guó niú",
        "definition": "对应大国崛起、经济转型成功的长期牛市。",
        "background": "2020年提出，认为A股将迎来真正的大国牛。",
        "example": "“大国牛才刚起步，不要下车。”",
        "market_context": "疫情后中国率先复苏、注册制改革。",
        "status": "current",
        "tags": ["动物牛", "宏大叙事"]
      },
      {
        "id": "25",
        "term": "少年牛",
        "pronunciation": "shào nián niú",
        "definition": "比喻牛市处于朝气蓬勃但还不够成熟的阶段。",
        "background": "2019年初提出，对应2440点启动的行情。",
        "example": "“少年牛充满活力，但也容易波动。”",
        "market_context": "2019年春季躁动行情。",
        "status": "historical",
        "tags": ["动物牛", "人物成长"]
      },
      {
        "id": "26",
        "term": "青春牛",
        "pronunciation": "qīng chūn niú",
        "definition": "比少年牛更成熟，牛市进入主升浪。",
        "background": "2020年7月提出，对应3000点突破。",
        "example": "“青春牛已来，拥抱核心资产。”",
        "market_context": "2020年7月券商暴动、指数大涨。",
        "status": "historical",
        "tags": ["动物牛", "人物成长"]
      },
      {
        "id": "27",
        "term": "精英牛",
        "pronunciation": "jīng yīng niú",
        "definition": "由机构、外资等精英资金主导的结构性牛市。",
        "background": "2021年初提出，强调分化行情。",
        "example": "“精英牛只涨好股票，垃圾股没戏。”",
        "market_context": "核心资产抱团、龙头股溢价时期。",
        "status": "historical",
        "tags": ["动物牛", "结构性行情"]
      },
      {
        "id": "28",
        "term": "蓝筹牛",
        "pronunciation": "lán chóu niú",
        "definition": "以蓝筹股为主角的牛市。",
        "background": "2017年提出，对应上证50单边上涨。",
        "example": "“蓝筹牛是价值投资的胜利。”",
        "market_context": "2017年漂亮50行情。",
        "status": "historical",
        "tags": ["动物牛", "价值投资"]
      },
      {
        "id": "29",
        "term": "钻石牛",
        "pronunciation": "zuàn shí niú",
        "definition": "极其珍贵、持久的牛市。",
        "background": "2021年提出，衍生自钻石底。",
        "example": "“钻石牛比普通牛更稳固。”",
        "market_context": "核心资产估值高位震荡期。",
        "status": "historical",
        "tags": ["动物牛", "宝石金属"]
      },
      {
        "id": "30",
        "term": "潜力牛",
        "pronunciation": "qián lì niú",
        "definition": "具备上涨潜力但尚未爆发的牛市雏形。",
        "background": "2022年底提出，对应2885点附近。",
        "example": "“潜力牛正在酝酿，等待催化剂。”",
        "market_context": "疫情放开前夕的磨底阶段。",
        "status": "current",
        "tags": ["动物牛", "预测性"]
      },
      {
        "id": "31",
        "term": "孟获牛",
        "pronunciation": "mèng huò niú",
        "definition": "七擒七纵式的反复牛熊拉锯，最终迎来牛市。",
        "background": "2023年提出，引用诸葛亮七擒孟获的典故。",
        "example": "“孟获牛需要多次折磨，才能修成正果。”",
        "market_context": "2023年市场反复磨底、政策底多次出现。",
        "status": "current",
        "tags": ["动物牛", "典故"]
      },
      {
        "id": "32",
        "term": "无量牛",
        "pronunciation": "wú liàng niú",
        "definition": "指上涨时成交量不大，但持续缓慢爬升的牛市。",
        "background": "2024年提出。",
        "example": "“无量牛才能走得远，放量反而危险。”",
        "market_context": "市场情绪低迷但指数重心上移阶段。",
        "status": "current",
        "tags": ["动物牛", "技术特征"]
      },
      {
        "id": "33",
        "term": "权重牛",
        "pronunciation": "quán zhòng niú",
        "definition": "由大盘权重股拉动的指数型牛市。",
        "background": "2023年中特估行情期间提出。",
        "example": "“权重牛只涨银行、石油，小票不涨。”",
        "market_context": "中字头股票大涨、创业板下跌的极端分化。",
        "status": "current",
        "tags": ["动物牛", "结构性行情"]
      },
      {
        "id": "34",
        "term": "焊牢牛",
        "pronunciation": "hàn láo niú",
        "definition": "指3000点被“焊牢”不会跌破，从而开启的牛市。",
        "background": "2024年初提出，对应反复焊牢3000点的言论。",
        "example": "“焊牢3000点后，焊牢牛就来了。”",
        "market_context": "2024年初强力护盘、3000点保卫战。",
        "status": "current",
        "tags": ["动物牛", "点位论"]
      },
      {
        "id": "35",
        "term": "黑熊",
        "pronunciation": "hēi xióng",
        "definition": "比喻严重、残酷的熊市。",
        "background": "2018年贸易摩擦期间使用。",
        "example": "“黑熊出没，注意减仓。”",
        "market_context": "2018年单边下跌熊市。",
        "status": "historical",
        "tags": ["动物熊", "情绪描述"]
      },
      {
        "id": "36",
        "term": "大熊",
        "pronunciation": "dà xióng",
        "definition": "大型熊市，跌幅深、时间长。",
        "background": "2008年、2018年等熊市期间使用。",
        "example": "“大熊来了，现金为王。”",
        "market_context": "熊市初期或主跌浪。",
        "status": "historical",
        "tags": ["动物熊", "级别描述"]
      },
      {
        "id": "37",
        "term": "熊的第四只脚丫印",
        "pronunciation": "xióng de dì sì zhī jiǎo yā yìn",
        "definition": "比喻熊市的最后一跌，之后将见底。",
        "background": "2018年10月提出，对应2449点。",
        "example": "“第四只脚丫印踩实了，熊就结束了。”",
        "market_context": "2018年底的最后探底。",
        "status": "historical",
        "tags": ["动物熊", "技术形态"]
      },
      {
        "id": "38",
        "term": "摘荔枝",
        "pronunciation": "zhāi lì zhī",
        "definition": "比喻股市过热，应该卖出股票获利了结。",
        "background": "2000年网络泡沫时期提出。",
        "example": "“夏天到了，该摘荔枝了。”",
        "market_context": "2000年A股冲高回落前夕。",
        "status": "historical",
        "tags": ["水果", "卖出信号"]
      },
      {
        "id": "39",
        "term": "播种",
        "pronunciation": "bō zhǒng",
        "definition": "比喻市场低迷时买入股票，等待未来收获。",
        "background": "2005年998点大底附近提出。",
        "example": "“现在正是播种的季节，不要恐惧。”",
        "market_context": "2005年历史大底。",
        "status": "historical",
        "tags": ["植物", "买入信号"]
      },
      {
        "id": "40",
        "term": "不拔青苗",
        "pronunciation": "bù bá qīng miáo",
        "definition": "比喻不要因为短期小利而卖掉有潜力的股票，要耐心持有。",
        "background": "2006年牛市初期提出。",
        "example": "“刚刚发芽的青苗，不要拔掉。”",
        "market_context": "2006年牛市启动阶段。",
        "status": "historical",
        "tags": ["植物", "持有信号"]
      },
      {
        "id": "41",
        "term": "摘熟苹果",
        "pronunciation": "zhāi shú píng guǒ",
        "definition": "比喻牛市成熟，应该卖出获利。",
        "background": "2007年6124点附近提出。",
        "example": "“苹果熟了，再不摘就烂了。”",
        "market_context": "2007年牛市顶部。",
        "status": "historical",
        "tags": ["水果", "卖出信号"]
      },
      {
        "id": "42",
        "term": "保护胜利果实",
        "pronunciation": "bǎo hù shèng lì guǒ shí",
        "definition": "比喻熊市来临前减仓或空仓，锁定利润。",
        "background": "2008年金融危机前提出。",
        "example": "“熊市将至，保护胜利果实最重要。”",
        "market_context": "2008年熊市前夕。",
        "status": "historical",
        "tags": ["水果", "风控信号"]
      },
      {
        "id": "43",
        "term": "股票带来希望",
        "pronunciation": "gǔ piào dài lái xī wàng",
        "definition": "比喻股市在底部区域，持有好股票将迎来希望。",
        "background": "2009年提出，对应1664点附近。",
        "example": "“不要绝望，股票带来希望。”",
        "market_context": "2008年熊市结束后的复苏期。",
        "status": "historical",
        "tags": ["植物", "信心信号"]
      },
      {
        "id": "44",
        "term": "校花理论",
        "pronunciation": "xiào huā lǐ lùn",
        "definition": "指在熊市中选择最漂亮、最抗跌的少数股票持有。",
        "background": "2012年提出。",
        "example": "“熊市中要选校花，不要选普通股票。”",
        "market_context": "2011-2012年震荡下跌市。",
        "status": "historical",
        "tags": ["植物", "选股策略"]
      },
      {
        "id": "45",
        "term": "鹦鹉",
        "pronunciation": "yīng wǔ",
        "definition": "研判官发鹦鹉图，寓意“婴儿长大了”，应捂住股票。",
        "background": "2017年5月发鹦鹉照片。",
        "example": "“鹦鹉来了，婴儿已经长大，不要下车。”",
        "market_context": "2017年白马股慢牛行情。",
        "status": "historical",
        "tags": ["动物信号", "看多"]
      },
      {
        "id": "46",
        "term": "牧童牵着牛",
        "pronunciation": "mù tóng qiān zhe niú",
        "definition": "比喻牛市已经来临，应积极做多。",
        "background": "2017年多次发牧童与牛的照片。",
        "example": "“牧童牵着牛，慢慢走。”",
        "market_context": "2017年慢牛行情。",
        "status": "historical",
        "tags": ["动物信号", "看多"]
      },
      {
        "id": "47",
        "term": "不下轿子",
        "pronunciation": "bù xià jiào zi",
        "definition": "比喻牛市来了就不要轻易卖出，要坐稳好股票。",
        "background": "研判官多次使用，被视为“最大的机会”。",
        "example": "“现在就是不下轿子的时候。”",
        "market_context": "牛市初期或上涨中继。",
        "status": "current",
        "tags": ["交通工具", "持有信号"]
      },
      {
        "id": "48",
        "term": "不下车",
        "pronunciation": "bù xià chē",
        "definition": "同理，指不要在上涨途中被震仓出局。",
        "background": "与不下轿子含义相同，更口语化。",
        "example": "“好股票不要轻易下车。”",
        "market_context": "市场波动但趋势向上时。",
        "status": "current",
        "tags": ["交通工具", "持有信号"]
      },
      {
        "id": "49",
        "term": "安全垫",
        "pronunciation": "ān quán diàn",
        "definition": "指在低位买入形成的利润缓冲带，能抵御市场波动风险。",
        "background": "研判官常用的风控概念。",
        "example": "“有了安全垫，持股心态更稳。”",
        "market_context": "建仓后已有浮盈时。",
        "status": "current",
        "tags": ["安全概念", "风控"]
      },
      {
        "id": "50",
        "term": "护城河",
        "pronunciation": "hù chéng hé",
        "definition": "指好公司具有的长期竞争优势，可以保护投资安全。",
        "background": "借用于巴菲特概念，常用来形容蓝筹股。",
        "example": "“买有护城河的公司，睡得安稳。”",
        "market_context": "价值投资选股时。",
        "status": "current",
        "tags": ["安全概念", "选股标准"]
      },
      {
        "id": "51",
        "term": "东升西落",
        "pronunciation": "dōng shēng xī luò",
        "definition": "指中国资产崛起、西方资产相对衰落的长期趋势。",
        "background": "2026年1月提出。",
        "example": "“东升西落是大趋势，不要逆势。”",
        "market_context": "全球资产再配置、A股相对强势期。",
        "status": "current",
        "tags": ["方向信号", "宏大叙事"]
      },
      {
        "id": "52",
        "term": "妖股",
        "pronunciation": "yāo gǔ",
        "definition": "指被过度炒作、基本面不支撑的高风险股票。",
        "background": "研判官警告投资者要像童话中渡海一样抵制其诱惑。",
        "example": "“妖股就像海妖的歌声，不要被迷惑。”",
        "market_context": "题材炒作疯狂时。",
        "status": "current",
        "tags": ["风险提示", "选股反面"]
      },
      {
        "id": "53",
        "term": "黑五类",
        "pronunciation": "hēi wǔ lèi",
        "definition": "指小股票、新股票、差股票、题材股、伪成长股，认为应该远离。",
        "background": "2015年之后反复强调。",
        "example": "“远离黑五类，拥抱蓝筹股。”",
        "market_context": "中小创估值泡沫破裂后。",
        "status": "current",
        "tags": ["选股标准", "风险提示"]
      },
      {
        "id": "54",
        "term": "做好人，买好股，得好报",
        "pronunciation": "zuò hǎo rén, mǎi hǎo gǔ, dé hǎo bào",
        "definition": "研判官的核心投资信条，强调价值投资与道德自律。",
        "background": "贯穿其整个投资生涯的口号。",
        "example": "“记住九字真言：做好人，买好股，得好报。”",
        "market_context": "任何时候，尤其是市场恐慌或狂热时。",
        "status": "current",
        "tags": ["心法语录", "核心理念"]
      },
      {
        "id": "55",
        "term": "用余钱投资",
        "pronunciation": "yòng yú qián tóu zī",
        "definition": "反复强调的核心风控原则，不要借钱、不要上杠杆。",
        "background": "研判官最常挂在嘴边的警告之一。",
        "example": "“只有余钱投资，才能做到手中有股，心中无股。”",
        "market_context": "任何市场环境下。",
        "status": "current",
        "tags": ["心法语录", "风控原则"]
      },
      {
        "id": "56",
        "term": "不要辞职不要退学",
        "pronunciation": "bù yào cí zhí bù yào tuì xué",
        "definition": "与余钱投资配套，强调投资不能赌上人生退路。",
        "background": "研判官多次劝导年轻人。",
        "example": "“千万不要辞职炒股，更不要退学炒股。”",
        "market_context": "市场出现暴富神话时。",
        "status": "current",
        "tags": ["心法语录", "人生忠告"]
      },
      {
        "id": "57",
        "term": "网贷加杠杆炒股",
        "pronunciation": "wǎng dài jiā gàng gān chǎo gǔ",
        "definition": "特别警告的风险操作，本金为零的情况下加杠杆极其危险。",
        "background": "研判官对非理性行为的典型批评。",
        "example": "“网贷加杠杆炒股，无异于自杀。”",
        "market_context": "杠杆牛或配资盛行时。",
        "status": "current",
        "tags": ["心法语录", "极端风险"]
      },
      {
        "id": "58",
        "term": "好公司 / 坏公司",
        "pronunciation": "hǎo gōng sī / huài gōng sī",
        "definition": "判断标准：往你口袋里塞钱的是好公司，从你口袋里掏钱的是坏公司。",
        "background": "研判官通俗版的价值投资定义。",
        "example": "“长期分红的是好公司，不断融资的是坏公司。”",
        "market_context": "选股时区分优劣。",
        "status": "current",
        "tags": ["心法语录", "选股标准"]
      },
      {
        "id": "59",
        "term": "股权文化",
        "pronunciation": "gǔ quán wén huà",
        "definition": "指上市公司应注重回购而不是减持，否则就是本末倒置。",
        "background": "研判官用来评价公司治理的术语。",
        "example": "“没有股权文化的公司，不值得长期持有。”",
        "market_context": "公司发布减持计划或回购公告时。",
        "status": "current",
        "tags": ["心法语录", "公司治理"]
      },
      {
        "id": "60",
        "term": "投资两个层次",
        "pronunciation": "tóu zī liǎng gè céng cì",
        "definition": "第一层“手中有股，心中无股”，第二层“手中有钱，心静如水”。能做到者凤毛麟角。",
        "background": "研判官对理想投资境界的总结。",
        "example": "“第一层是不被波动干扰，第二层是空仓也能心如止水。”",
        "market_context": "心态修炼的指导。",
        "status": "current",
        "tags": ["心法语录", "境界论"]
      },
      {
        "id": "61",
        "term": "3400点闻到小牛香味",
        "pronunciation": "sān qiān sì bǎi diǎn wén dào xiǎo niú xiāng wèi",
        "definition": "在3400点附近表达对牛市的乐观预期。",
        "background": "牛市上涨中途的感性评论。",
        "example": "“我依稀闻到了小牛的香味。”",
        "market_context": "2019-2021年上涨途中。",
        "status": "historical",
        "tags": ["点位语录", "看多"]
      },
      {
        "id": "62",
        "term": "珍惜3100点的黄金机会",
        "pronunciation": "zhēn xī sān qiān yī bǎi diǎn de huáng jīn jī huì",
        "definition": "在3100点附近强调这是买入机会。",
        "background": "研判官多次在3100点附近喊话。",
        "example": "“要珍惜3100点的黄金机会。”",
        "market_context": "市场回调至3100点附近时。",
        "status": "historical",
        "tags": ["点位语录", "看多"]
      },
      {
        "id": "63",
        "term": "3000点大底是不会破的",
        "pronunciation": "sān qiān diǎn dà dǐ shì bù huì pò de",
        "definition": "坚信3000点是长期底部，后成为经典反向梗。",
        "background": "研判官最著名的错误预测之一。",
        "example": "“3000点大底焊牢了，不会破。”",
        "market_context": "3000点保卫战反复上演。",
        "status": "historical",
        "tags": ["点位语录", "反向指标"]
      },
      {
        "id": "64",
        "term": "1664点需要勇气",
        "pronunciation": "yī liù liù sì diǎn xū yào yǒng qì",
        "definition": "在1664点附近认为这是历史性大底，买入需要勇气。",
        "background": "2008年金融危机后提出。",
        "example": "“1664点，需要勇气。”",
        "market_context": "2008年11月历史大底。",
        "status": "historical",
        "tags": ["点位语录", "底部信号"]
      },
      {
        "id": "65",
        "term": "6124点需要淡泊",
        "pronunciation": "liù yī èr sì diǎn xū yào dàn bó",
        "definition": "在6124点附近认为这是历史性大顶，需要淡泊离场。",
        "background": "2007年牛市顶部提出。",
        "example": "“6124点，需要淡泊。”",
        "market_context": "2007年10月历史大顶。",
        "status": "historical",
        "tags": ["点位语录", "顶部信号"]
      },
      {
        "id": "66",
        "term": "和风细雨 / 毛毛雨",
        "pronunciation": "hé fēng xì yǔ / máo mao yǔ",
        "definition": "用气象变化形容市场下跌力度减弱，暗示底部越来越近。",
        "background": "研判官说：2008是狂风暴雨，2012是和风细雨，2013是毛毛雨中的毛毛雨。",
        "example": "“现在只是毛毛雨，不用恐慌。”",
        "market_context": "熊市后期跌幅收窄时。",
        "status": "historical",
        "tags": ["气象比喻", "安抚信号"]
      }
    ] as LingoItem[]
  }),
  getters: {
    getLingoById: (state) => (id: string) => state.lingos.find(l => l.id === id),
    searchLingos: (state) => (query: string) => {
      if (!query) return state.lingos
      const q = query.toLowerCase()
      return state.lingos.filter(l =>
        l.term.toLowerCase().includes(q) ||
        l.definition.toLowerCase().includes(q) ||
        l.tags.some(t => t.toLowerCase().includes(q))
      )
    }
  }
})
