import axios from 'axios';
import 'dotenv/config';

const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1';
const LLM_MODEL = process.env.LLM_MODEL || 'llama-3.3-70b-versatile';

// 获取当前时间：YYYY-MM-DD HH:MM
const now = new Date();
const date = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()} ${now.getHours()}:${now.getMinutes()}`;

console.log('测试AI分析...');
console.log('API URL:', LLM_BASE_URL);
console.log('Model:', LLM_MODEL);
console.log('Key前10位:', LLM_API_KEY?.slice(0, 10));

const testText = `各位好，各位好！今天继续地反弹。十二点二十一分，日本怒涨零点七二，韩国更是不得了，三点零六。印度涨百分之一点三八，新加坡涨百分之零点四二。关键看油，一切看油！布油九十五，纽约原油九十，掉得还是比较多的。上海油呃六三四，掉二点七二。关键是，关键是美元对离岸人民币六点八一五六，盘中一度创六点八零八四八，这算好了吗？这么好听。勇创三年来的人民币的新高，还是蛮强的。港股上午盘是怒涨啦，继续反弹。我从三月二十三号认为啊港股的一个低位，短期低位了，这个跟一四五九七没办法比。呃，二四两三点这个地方展开了反弹。恒科呢，也在二零二六年三月三十日四六一九点，当然这个跟那个大底没法比了啊，大底是在二零二二年的十月二十五日二七二零点，两千七，这个地方四千六百一十九，那还是不一样的。当然它是调整了百分之三十一之后的这个反弹，还是可能会靠谱一些的。这是恒科的情况，怒涨百分之一点四六。今天，我觉得整个全球股市现在是美股又回到了高位，欧洲市场也不断地在创新高，日、韩、印也回到了一些高位。特别是日本、韩国，这个涨得一发不可收拾了，也接近创新高了。但是从这一次的整个全球市场，多个市场处于一个高位区这样的一个客观事实来看，因为什么情况，我对高还是比较谨慎的。比如说前几年，五六年前，大概是二零二零年左右，一大帮人在那里吹负利率。那个时候全球的债券市场都是零，接近零。过了五六年，那批吹捧负利率的人，而且都是赫赫有名的人。去了哪里呢？因为现在都跑到四以上了，或者四左右了。那全球的养老金在那个地方腰斩，刚刚过去不久啊，它每隔一段时间都会有一个泡沫出现。债券市场我们当然讲的是国外的美债、欧债、日债了。那最近又出来一个贵金属的巨震，有色金属的巨震，油的巨震。我觉得这里面有没有泡沫存在，我们还是可以研究的那股票市场遇到高位，当

然很多人认为还不高了，但是很多市场都是显而易见的高啊！一眼可见的高啊！当然，我认为高，很多人不这么认为。就像当时的负利率提出来的时候，创造了一个新理论，颠覆了所有的认知啊，创造了一个负利率的，进入负利率时代。大家搜索一下负利率时代，那创造这个理论的人现在跑哪里去了？现在变成四了。当然是国外的外围市场。认为现在不高的人，那我们过一段时间再观察一下。当然好股票例外啊。好股票，我觉得好股票可能还会不断地创新高，但是在一个普遍高估的情况底下，我觉得再度拔高估值的概率跟估值回归正常的概率，我觉得后者是居多的。这是从进攻变成防御的。不管它短期回到高位能超多少我都不管它，我认为高了就是高，当然这是我个人认知了。就像当年吹负利率的时候，我就觉得不对劲，哪有什么负利率？呵，那，那个，那帮吹负利率的人现在在哪里啦投资们，要回归常识，高了就是高。当然很多人不认为高。未来是什么呢？未来真正有业绩的才是王道。有业绩的它不会高，有业绩的它通过业绩的增长把估值降下来，就不高了。但是没有业绩的，它就要回归估值了。很多都是没有，还没有业绩的。我们讲的是外围市场。我再重复一次，我们讲的所有的都是外围市场。好股票例外，有业绩的例外。一切我觉得只有业绩才是真的，其他都是假的再见`;

const prompt = `你的角色定位是文字内容精确解析员，前提摘要：我发给你的文字内容是李大霄的视频内容，需要你根据文字内容解析出他深层表达的意思，请注意，李大霄在抖音有百万粉丝，他不能明面唱空，不能明面直接给出投资建议。你要挖掘他想表达的真正意思，请将以下视频转录文本分析并输出为指定格式的 JSON:

输出格式：
{
  "_id": \`lishaoxiao_${date.replace(/-/g, '')}\`,
  "id": \`lishaoxiao_${date.replace(/-/g, '')}\`,
  "title": "string, 提炼核心观点作为标题，20字以内",
  "date": \`${date}\`,
  "sentiment_score": "integer, 情绪评分，0-100，50为中性，越高越乐观",
  "disclaimer_level": "integer, 免责/防火墙等级，1-5，越高越强调'仅供参考/外围市场'",
  "summary": "string, 200字以内的核心摘要，包含关键数据、观点、策略",
  "tags": ["string数组", "8个以内关键词标签"],
  
  "structured": {
    "core_views": ["string数组", "逐条列出原文中的核心观点/数据，每条带具体数字"],
    "sectors": ["string数组", "涉及的行业板块，如证券、银行、石油石化等"],
    "operation_advice": "string, 操作策略建议，提炼弦外之音，明确多空态度",
    "risk_tips": ["string数组", "风险警示要点，每条独立成句"]
  },
  
  "deep_analysis": {
    "strategy": "string, 分析其论证策略：用了什么修辞/类比/心理战术来传达观点",
    
    "hidden_meanings": [
      {
        "surface": "string, 原文表面表述（引用原话或高度还原）",
        "deep": "string, 深层含义解读：他真正想说什么？暗示什么？建立什么形象？",
        "quote": "string, 原文中最能代表该隐含意思的一句话"
      }
    ],
    
    "logic_pieces": [
      {
        "title": "string, 逻辑链条名称，如'负利率历史类比'、'估值分化论'",
        "content": "string, 该逻辑链的完整推理过程，用箭头→连接"
      }
    ],
    
    "data_analysis": {
      "points": ["string数组", "原文中提到的所有具体数据，带单位和涨跌幅"],
      "subtext": "string, 数据背后的潜台词：数据呈现什么特征？作者想借此说明什么？"
    },
    
    "signals": ["string数组", "从中提取的所有投资信号，格式：'信号名称：具体内容'"],
    
    "final_conclusion": "string, 综合结论，300字以内，涵盖观点、策略、风险提示"
  },
  
  "hit_status": "string, 固定值'pending'",
  
  "logic_factors": [
    {
      "factor_name": "string, 因子名称，如'全球高位'、'业绩分化'",
      "factor_value": "string, 因子具体数值或状态描述",
      "weight": "float, 权重0-1，越高影响越大",
      "direction": "string, 取值仅限：'看涨'/'看跌'/'中性偏多'/'中性偏空'/'中性'",
      "description": "string, 该因子对市场的具体影响逻辑"
    }
  ]
}

文本内容：
${testText}`;

try {
  const response = await axios.post(
    `${LLM_BASE_URL}/chat/completions`,
    {
      model: LLM_MODEL,
      messages: [
        { role: "system", content: "你是一个严格遵循指令的文本解析专家，必须输出完整、详细、不省略任何字段的JSON。" },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 8192,
      response_format: { type: "json_object" }   // 可以保留
    },
    {
      headers: { 'Authorization': `Bearer ${LLM_API_KEY}` },
      timeout: 3000000
    }
  );

  console.log('\n✅ AI分析成功！');
  console.log(response.data.choices[0].message.content);
} catch (error) {
  console.error('\n❌ AI分析失败:', error);
  if (error.code) console.error('错误码:', error.code);
}
