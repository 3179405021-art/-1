import express from "express";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { Solar } from "lunar-javascript";

dotenv.config();

const PORT = 3000;

// Deterministic hash based on a string (e.g., date)
function getStringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

// Fine-tuned traditional Chinese wisdom datasets for premium fallback
const YI_POOL = [
  "开光、祈福、求嗣、出行、解除、伐木、出火、拆卸、修造、上梁",
  "沐浴、扫舍、祭祀、求医、治病、会亲友、纳财、扫舍、合帐、安床",
  "嫁娶、出行、移徙、入宅、修造、动土、竖柱、上梁、安香、纳畜",
  "祭祀、出行、裁衣、冠笄、会亲友、纳财、交易、立券、经络、栽种",
  "祈福、斋醮、出行、订盟、纳采、裁衣、合帐、冠笄、安机械、安床",
  "入学、起基、筑堤、安门、造仓、进人口、纳财、纳畜、造畜稠"
];

const JI_POOL = [
  "斋醮、针灸、安葬、开市、入宅、动土、嫁娶、词讼",
  "作灶、安葬、嫁娶、出行、安床、入宅、开市、栽种",
  "置产、词讼、栽种、安葬、治病、行丧、伐木、安门",
  "祈福、嫁娶、开市、安葬、掘井、作灶、入宅、修坟",
  "栽种、作灶、入宅、安葬、嫁娶、出行、修坟、立碑",
  "开渠、穿井、伐木、做灶、安床、安葬、出行、祭祀"
];

const JISHI_POOL = [
  "**子时 (23:00-01:00)**：宜祈福、嫁娶，吉星高照；\n**寅时 (03:00-05:00)**：宜求嗣、提车，万事遂意；\n**午时 (11:00-13:00)**：宜作灶、安床，财源滚滚。",
  "**丑时 (01:00-03:00)**：宜求财、交易，贵人暗中扶持；\n**卯时 (05:00-07:00)**：宜出行、搬迁，天德吉星庇佑；\n**申时 (15:00-17:00)**：宜谈合作、聚会，人缘极佳。",
  "**寅时 (03:00-05:00)**：宜安神、祭祀，清心静气；\n**辰时 (07:00-09:00)**：宜商务谈判、签订契约，大吉；\n**戌时 (19:00-21:00)**：宜复盘、散步、阅读，精神大振。",
  "**卯时 (05:00-07:00)**：宜出差、面试，事半功倍；\n**巳时 (09:00-11:00)**：宜剪发、沐浴、整容，焕发神采；\n**未时 (13:00-15:00)**：宜整理房间、归档文件，有条不紊。"
];

const CHUANDA_POOL = [
  "今日五行属**木**，推荐穿着具有朝气生机的**草绿色、莫兰迪浅绿或奶白色**系列，搭配自然棉麻材质，给人温润静谧、充满朝气的视觉印象，有助于生发今日专注状态。",
  "今日五行属**火**，最宜穿着温暖瞩目的**朱砂橙、浅杏粉、姜黄色**或自带热情的珊瑚色系。既能让人看起来神采奕奕，又能有效提亮社交自信与工作气场。",
  "今日五行属**土**，推荐上身**暖卡其色、燕麦风、高级深咖或冷灰色**等沉稳大方的大地色系。这种色彩极具亲和力与沉静感，最有利于促成商务及团队沟通合作。",
  "今日五行属**金**，推荐选用百搭精致的**银灰灰、亮洁白、香槟金**色系，可搭配硬朗线条单品或金色极简配饰，自带强大的利落气场，助攻逻辑思维修行。",
  "今日五行属**水**，最宜融入静谧优雅的**藏蓝色、烟熏黑、海盐蓝**等沉静冷色系，既显皮肤白皙又能唤醒逻辑理智，帮助您在今日的高压事务中保持从容冷静。"
];

const GOUWU_POOL = [
  "今日求财临吉位，适合添置一些具有极高实用价值的**生产力数码设备或办公外设**，例如一把舒适的机械键盘、人体工学靠垫或办公效率套件。服饰类消费则建议适度规划，不买无用之物。",
  "今日宜配置一些能瞬间点缀生活空间的**绿罗盆栽、精油香薰、经典书籍或质感手账本**等疗愈美学物件。对于贵重的投资合伙或虚拟项目充值则需要极为谨慎，谨防浮躁跟风。",
  "今日磁场宜稳健，很适合囤积一些**高复用率的生活刚需消耗品、优质个人洗护套件或绿色膳食粗粮**。避开高折旧的电子产品或一时兴起但穿戴频次极低的个性概念潮牌。",
  "今日最建议投资在**运动健康与身体调养**上。例如买一双合脚柔软的跑鞋、一款触感上乘的瑜伽垫或是补充优质蛋白质。今日对纯娱乐、卡牌抽盲盒等偶得消费应保持克制，避免落空感。",
  "今日适合为自己的睡眠充电，适宜选购**高品质的贴身床品套件、乳胶护颈枕、高密度真丝眼罩或舒缓睡眠香氛**。温馨提醒：深夜情绪若有起伏时请及时关闭购物软件，谨防冲动消费。"
];

const MEIRONG_POOL = [
  "今日气运通达，理发可焕发新颜，美容护理亦有事半功倍之效。",
  "今日气运平稳，适宜修剪发型，简单的美容护理亦可。",
  "今日不宜大修发型或进行深度美容，建议以基础保养为主。",
  "今日理发美容均可，建议尝试清爽发型。",
  "今日气运不稳，理发需谨慎，美容项目建议延后。"
];

const TIPS_POOL = [
  "「柔和从容地回应外界，将内心的秩序放在首要位置。」—— 今天的你，宜少说多听，以松弛承载纷杂。",
  "「凡事皆可稍放宽心。身心的健康和当下的舒畅，才是一切创造的支点。」—— 劳作时记得每满一小时起身远眺或伸腰。",
  "「普通日子里的每一次认真复盘与小息，都在为厚积薄发蓄水铺垫。」—— 晚上不妨为自己泡一杯清茶，总结几行欣慰的生活小事。",
  "「至简便是至美. 减去那些信息碎片的打扰，专心做好手下那个重中之重的核心任务。」—— 今天宜专注少而精的体验，静心方得气韵。"
];

// Offline fallback ideas database to recommend
const OFFLINE_PROJECTS_POOL = [
  {
    projectName: "✨ 灵量心流音频（Zen Wave Audio）",
    description: "受 Excalidraw 疗愈性白板的启发，结合正念白噪音与呼吸光斑，旨在提供浸润式代码编写心流体验。包含双耳搏动与潮汐呼吸伴侣模块。",
    githubUrl: "https://github.com/excalidraw/excalidraw"
  },
  {
    projectName: "📊 极简个人卡片看板（Anyslate）",
    description: "受 Trello 启发的气运美学看板，每个任务卡片均可结合今日吉时 and 穿搭，实现富有气运心流的日常任务统筹与成就追踪平台。",
    githubUrl: "https://github.com/excalidraw/excalidraw"
  },
  {
    projectName: "🎐 禅意时光钟摆（Zen Clock）",
    description: "受 Fira Code 与古典钟摆启发，将极简时钟与周易六十四卦卦象结合，每小时自动推荐符合当前九宫飞星磁场的心灵冥想箴言。",
    githubUrl: "https://github.com/tonsky/FiraCode"
  },
  {
    projectName: "📝 极简灵感便签（Minimalist Scratchpad）",
    description: "受 Standard Notes 启发的安全优雅加密便签卡片，支持本地实时保存，提供极佳的文字输入抗噪设计与雅致的版面流动排版。",
    githubUrl: "https://github.com/standardnotes/app"
  }
];

// Simple in-memory cache for Chinese Lunar Calendar requests
interface CacheEntry {
  data: string;
  expiry: number;
  isFallback: boolean;
}
const lunarCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours for daily lunar data to tighten API calls

// Cache for Reflection Insights to prevent duplicate LLM calls on identical text
interface ReflectionCacheEntry {
  data: {
    reflectionSummary: string;
    personalInsight: string;
    coreReminder: string;
    tags: string[];
  };
  expiry: number;
}
const reflectionCache = new Map<string, ReflectionCacheEntry>();
const REFLECTION_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getReflectionCacheKey(title: string, text: string): string {
  const cleanTitle = (title || "").trim();
  const cleanText = (text || "").trim();
  return `${cleanTitle}:${getStringHash(cleanText)}:${cleanText.length}`;
}

// Quantitative Fortune Event Evaluation Cache & Offline Evaluator
interface EventEvaluationData {
  valence: 'auspicious' | 'inauspicious';
  rawScore: number;
  finalScore: number;
  magnitude: '大吉' | '中吉' | '微吉' | '微凶' | '中凶' | '大凶';
  intensity: number;
  butterflyFactor: number;
  weatherDrag: number;
  weatherBonus?: number;
  evaluationRationale: string;
  conservationForecast: string;
}
const eventEvaluationCache = new Map<string, { data: EventEvaluationData; expiry: number }>();
const EVENT_EVAL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function evaluateEventOffline(
  text: string, 
  weather: string = 'sunny', 
  currentBalance: number = 0,
  streakDays: number = 0,
  isInterruption: boolean = false
): EventEvaluationData {
  const clean = (text || "").toLowerCase().trim();
  
  // Auspicious lexicons
  const majorPos = ['签约', '升职', '加薪', '获奖', '表彰', '突破', '中奖', '告白成功', '录取', '拿到offer', '大捷', '奇迹', '狂喜', '大卖', '核心方案通过', '顺利签约', '考研成功'];
  const medPos = ['顺利', '赞赏', '表扬', '完成', '美味', '惬意', '释怀', '温暖', '恢复', '礼物', '减压', '达标', '好消息', '重逢', '喜悦', '舒畅', '好运', '通透', '开心', '搞定', '解决', '晨跑', '健身', '阅读', '早起', '打卡', '坚持'];
  const minorPos = ['咖啡', '阳光', '好歌', '散步', '逗猫', '整理', '顺心', '准时', '小确幸', '早睡', '微风', '轻松', '散心', '听歌'];

  // Inauspicious lexicons
  const majorNeg = ['骨折', '生病', '车祸', '重病', '严重事故', '辞退', '被开除', '丢失重物', '绝交', '决裂', '诈骗', '暴亏', '官司', '崩溃', '巨大损失', '重度挫败', '住院', '灾祸'];
  const medNeg = ['塞车', '堵车', '迟到', '挨骂', '被批评', '批评', '扣钱', '争吵', '吵架', '方案被打回', '搞砸', '摔倒', '跌倒', '湿透', '损坏', '丢失', '被拒', '罚款', '心烦', '郁闷', '失误', '沮丧', '难过', '扎胎', '中断', '放弃', '破戒', '摆烂', '懈怠'];
  const minorNeg = ['烦躁', '洒了', '弄脏', '没带伞', '蚊子', '疲惫', '小摩擦', '小误会', '拖延', '排队', '轻微', '失眠', '失落'];

  // Intensifiers
  const intensifiers = ['极其', '非常', '严重', '彻底', '巨大', '特别', '极度', '超级', '惨痛'];
  const dampeners = ['稍微', '略微', '小小', '一点点', '似乎', '有点', '微小'];

  let basePosScore = 0;
  let posHits = 0;
  for (const w of majorPos) if (clean.includes(w)) { basePosScore = Math.max(basePosScore, 42); posHits++; }
  for (const w of medPos) if (clean.includes(w)) { basePosScore = Math.max(basePosScore, 26); posHits++; }
  for (const w of minorPos) if (clean.includes(w)) { basePosScore = Math.max(basePosScore, 14); posHits++; }

  let baseNegScore = 0;
  let negHits = 0;
  for (const w of majorNeg) if (clean.includes(w)) { baseNegScore = Math.max(baseNegScore, 45); negHits++; }
  for (const w of medNeg) if (clean.includes(w)) { baseNegScore = Math.max(baseNegScore, 28); negHits++; }
  for (const w of minorNeg) if (clean.includes(w)) { baseNegScore = Math.max(baseNegScore, 14); negHits++; }

  let modifier = 1.0;
  for (const w of intensifiers) if (clean.includes(w)) { modifier = 1.35; break; }
  for (const w of dampeners) if (clean.includes(w)) { modifier = 0.7; break; }

  let valence: 'auspicious' | 'inauspicious' = 'auspicious';
  let rawScore = 15;

  if (isInterruption) {
    valence = 'inauspicious';
    rawScore = -Math.round((baseNegScore || 24) * modifier);
  } else if (baseNegScore > basePosScore || (baseNegScore > 0 && posHits === 0)) {
    valence = 'inauspicious';
    rawScore = -Math.round((baseNegScore || 20) * modifier);
  } else {
    valence = 'auspicious';
    rawScore = Math.round((basePosScore || 20) * modifier);
  }

  // 1. Weather weighting calculation:
  // 晴朗时正向加权 1.2，多云时正向加权 1.6，雨天强化凶 1.6，暴雨凶 2.0
  let weatherMultiplier = 1.0;
  let weatherDrag = 0;
  let weatherBonus = 0;

  if (weather === 'sunny') {
    weatherMultiplier = valence === 'auspicious' ? 1.2 : 1.0;
    if (valence === 'auspicious') weatherBonus = Math.round(rawScore * 0.2);
  } else if (weather === 'cloudy') {
    weatherMultiplier = valence === 'auspicious' ? 1.6 : 1.0;
    if (valence === 'auspicious') weatherBonus = Math.round(rawScore * 0.6);
  } else if (weather === 'rainy') {
    weatherMultiplier = valence === 'inauspicious' ? 1.6 : 0.85;
    if (valence === 'inauspicious') weatherDrag = Math.round(Math.abs(rawScore) * 0.6);
  } else if (weather === 'storm') {
    weatherMultiplier = valence === 'inauspicious' ? 2.0 : 0.70;
    if (valence === 'inauspicious') weatherDrag = Math.round(Math.abs(rawScore) * 1.0);
  }

  // 2. 连续坚持正向活动：随着坚持时间增多可增多 (Compound streak multiplier)
  let streakMultiplier = 1.0;
  if (streakDays > 0 && valence === 'auspicious' && !isInterruption) {
    streakMultiplier = 1.0 + Math.min(1.8, streakDays * 0.08); // e.g. 7 days: 1.56x, 14 days: 2.12x, 21 days: 2.68x
  }

  // 3. 中断破戒惩罚：中断时要扣的也多 (Sunk cost & momentum collapse multiplier)
  let interruptionMultiplier = 1.0;
  if (isInterruption || (streakDays > 0 && valence === 'inauspicious')) {
    interruptionMultiplier = 1.0 + Math.min(2.2, Math.max(1, streakDays) * 0.12); // e.g. 7 days: 1.84x, 14 days: 2.68x, 21 days: 3.2x
  }

  const finalScore = valence === 'auspicious' 
    ? Math.min(75, Math.round(rawScore * weatherMultiplier * streakMultiplier))
    : -Math.min(75, Math.round(Math.abs(rawScore) * weatherMultiplier * interruptionMultiplier));

  const absScore = Math.abs(finalScore);
  let magnitude: EventEvaluationData['magnitude'] = '微吉';
  let intensity = 2;

  if (valence === 'auspicious') {
    if (absScore >= 35) { magnitude = '大吉'; intensity = 5; }
    else if (absScore >= 20) { magnitude = '中吉'; intensity = 3; }
    else { magnitude = '微吉'; intensity = 2; }
  } else {
    if (absScore >= 35) { magnitude = '大凶'; intensity = 5; }
    else if (absScore >= 20) { magnitude = '中凶'; intensity = 3; }
    else { magnitude = '微凶'; intensity = 2; }
  }

  const butterflyFactor = (isInterruption || clean.includes('合同') || clean.includes('领导') || clean.includes('客户') || clean.includes('项目') || clean.includes('家人') || clean.includes('钱') || clean.includes('签约') || clean.includes('考试')) ? 2.1 : 1.3;

  let rationale = valence === 'auspicious'
    ? `【精算评判】：事件定性为积极正向激励，对身心磁场有直接提振（基准核定 +${Math.abs(rawScore)} 分）。`
    : `【精算评判】：事件判定为现实阻滞或习惯挫折（基准损耗 -${Math.abs(rawScore)} 分）。`;

  if (weather === 'sunny' && valence === 'auspicious') {
    rationale += `适逢晴日朗照，函数加权赋予 1.2 倍正向吉运放大（加成额外 +${weatherBonus} 分）。`;
  } else if (weather === 'cloudy' && valence === 'auspicious') {
    rationale += `云开雾散见晴明，函数加权赋予 1.6 倍正向吉势高倍放大（加成额外 +${weatherBonus} 分）。`;
  } else if (weather === 'rainy' && valence === 'inauspicious') {
    rationale += `适逢雨天阴雨湿滞，系统严格按动力学加权法则放大了 1.6 倍凶性能量耗损。`;
  } else if (weather === 'storm' && valence === 'inauspicious') {
    rationale += `遭遇雷暴恶劣天气，环境负熵加剧，凶势加权翻倍放大至 2.0 倍。`;
  }

  // Explicit streak persistence compounding explanation
  if (streakDays > 0 && valence === 'auspicious' && !isInterruption) {
    rationale += ` 🔥【坚持正向复利】：连续坚持正向行动已达 ${streakDays} 天，心智势能形成复利效应（坚持增益 ×${streakMultiplier.toFixed(2)} 倍），加赠额外增量，最终核定为 +${finalScore} 分！`;
  } else if (isInterruption) {
    rationale += ` 🚨【坚持中断重挫严惩】：沉重中断了连续坚持 ${streakDays} 天的正向行动，惯性坍塌与沉没成本严重反噬（中断扣罚乘数 ×${interruptionMultiplier.toFixed(2)} 倍），核定严厉重扣 ${finalScore} 分！`;
  } else {
    rationale += ` 最终核定为 ${finalScore > 0 ? '+' + finalScore : finalScore} 分。`;
  }

  let conservationForecast = "";
  if (valence === 'auspicious') {
    conservationForecast = currentBalance > 20 
      ? "守恒预警：当前已累积较高吉运势能，此番吉事落地后，后续时段需警惕反冲修正（物极必反），宜守成敛气。"
      : "守恒状态：吉运正在充盈蓄水池，为后续数日的平稳开展奠定正向波幅。";
  } else {
    conservationForecast = currentBalance < -15
      ? "守恒推演：逆境负熵已随此事件加速释放，守恒蓄水池正迎来谷底回温，后续吉相回弹势能攀升。"
      : "守恒状态：此凶事虽造成现实阻力，但提前抵扣了潜在风险，符合吉凶守恒周转规律。";
  }

  return {
    valence,
    rawScore,
    finalScore,
    magnitude,
    intensity,
    butterflyFactor,
    weatherDrag,
    weatherBonus,
    evaluationRationale: rationale,
    conservationForecast
  };
}

// Helper to generate traditional Chinese Lunar Calendar info deterministically
function generateOfflineLunarInfo(dateStr: string): string {
  try {
    if (dateStr && dateStr.includes("-")) {
      const parts = dateStr.split("-");
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        const solar = Solar.fromYmd(y, m, d);
        const lunar = solar.getLunar();
        
        const lunarY = lunar.getYearInGanZhi();
        const lunarM = lunar.getMonthInGanZhi();
        const lunarD = lunar.getDayInGanZhi();
        const shengxiao = lunar.getYearInShengXiao();
        const lunarMonthCh = lunar.getMonthInChinese();
        const lunarDayCh = lunar.getDayInChinese();
        const jieqi = lunar.getJieQi() || "无";
        const dayYi = (lunar.getDayYi() || []).join("、") || "诸事不宜";
        const dayJi = (lunar.getDayJi() || []).join("、") || "诸事皆宜";

        const hash = getStringHash(dateStr);
        const jishi = JISHI_POOL[(hash + 1) % JISHI_POOL.length];
        const chuanda = CHUANDA_POOL[(hash + 2) % CHUANDA_POOL.length];
        const gouwu = GOUWU_POOL[(hash + 4) % GOUWU_POOL.length];
        const meirong = MEIRONG_POOL[(hash + 6) % MEIRONG_POOL.length];
        const tip = TIPS_POOL[(hash + 5) % TIPS_POOL.length];

        return `### 📅 公历日期：${dateStr} (农历：${lunarY}年【属${shengxiao}】${lunarMonthCh}月${lunarDayCh})
干支纪日：${lunarY}年 ${lunarM}月 ${lunarD}日  二十四节气：${jieqi}

#### 🧧 传统宜忌公允校准
*   **【今日大吉·宜】**：${dayYi}
*   **【气运折损·忌】**：${dayJi}

----

#### ⏰ 每日吉时推荐
${jishi}

-----

#### 🧥 雅致色彩穿搭指南
${chuanda}

-----

#### 🛍️ 消费美学与购物指南
${gouwu}

-----

#### 💇‍♀️ 理发美容建议
${meirong}

-----

#### 💡 心灵小贴士
${tip}`;
      }
    }
  } catch (e) {
    console.warn("Offline parse error:", e);
  }

  const hash = getStringHash(dateStr);
  const yi = YI_POOL[hash % YI_POOL.length];
  const ji = JI_POOL[(hash + 3) % JI_POOL.length];
  const jishi = JISHI_POOL[(hash + 1) % JISHI_POOL.length];
  const chuanda = CHUANDA_POOL[(hash + 2) % CHUANDA_POOL.length];
  const gouwu = GOUWU_POOL[(hash + 4) % GOUWU_POOL.length];
  const tip = TIPS_POOL[(hash + 5) % TIPS_POOL.length];

  return `### 📅 日期：${dateStr}

#### 🧧 传统宜忌公允校准
*   **【今日大吉·宜】**：${yi}
*   **【气运折损·忌】**：${ji}

----

#### ⏰ 每日吉时推荐
${jishi}

-----

#### 🧥 雅致色彩穿搭指南
${chuanda}

-----

#### 🛍️ 消费美学与购物指南
${gouwu}

-----

#### 💡 心灵小贴士
${tip}`;
}

// Lazy initialization of GoogleGenAI
let aiInstance: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required but missing from server.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// Main startup function
async function startServer() {
  const app = express();
  app.use(express.json());

  // API router rules
  app.get("/api/lunar-info", async (req, res) => {
    const date = req.query.date as string;
    if (!date) {
      return res.status(400).json({ error: "Date parameter is required" });
    }

    // Check in-memory cache
    const cached = lunarCache.get(date);
    const now = Date.now();
    if (cached && cached.expiry > now) {
      console.log(`[Cache Hit] Serving lunar info for ${date} from cache (isFallback: ${cached.isFallback}).`);
      return res.json({ 
        result: cached.data, 
        isCached: true, 
        isFallback: cached.isFallback 
      });
    }

    let lastError: any = null;

    // Run high-precision lunar calculations locally to inject actual lunar facts into LLM prompt
    let lunarFactStr = "";
    try {
      if (date && date.includes("-")) {
        const parts = date.split("-");
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          const solar = Solar.fromYmd(y, m, d);
          const localLunarObj = solar.getLunar();
          
          const lunarY = localLunarObj.getYearInGanZhi();
          const lunarM = localLunarObj.getMonthInGanZhi();
          const lunarD = localLunarObj.getDayInGanZhi();
          const shengxiao = localLunarObj.getYearInShengXiao();
          const lunarMonthCh = localLunarObj.getMonthInChinese();
          const lunarDayCh = localLunarObj.getDayInChinese();
          const jieqi = localLunarObj.getJieQi() || "无";
          const dayYi = (localLunarObj.getDayYi() || []).join("、") || "诸事不宜";
          const dayJi = (localLunarObj.getDayJi() || []).join("、") || "诸事皆宜";

          lunarFactStr = `【万年历高精度传统事实数据】：
- 公历日期：${date}
- 农历：${lunarY}年（草木生肖属：${shengxiao}）${lunarMonthCh}月${lunarDayCh}
- 干支纪日：${lunarY}年、${lunarM}月、${lunarD}日
- 二十四节气：${jieqi}
- 当日黄历适合（宜）：${dayYi}
- 当日黄历禁忌（忌）：${dayJi}`;
        }
      }
    } catch (err) {
      console.warn("[Lunar Local Conversion failed]", err);
    }

    // Attempt 1: Call Gemini API directly (no Google Search / research tool)
    try {
      const ai = getAI();
      const contentsPrompt = lunarFactStr 
        ? `您好，请根据以下经过高精度中国传统历法验证的真实公网推算事实：
${lunarFactStr}

作为顶级传统风水和黄历美学专家，请对上述事实进行优雅精美的润色、气运解读和美学生活建议，必须严格保证其中的公历日期、农历、干支、宜和忌等客观数据都与提示的事实完全吻合，不得胡乱捏造不符的信息。
请按以下精确结构返回 Markdown 格式：
1. **今日大吉·宜**：精简列出今日最适合做的事（应包含上述事实中‘宜’的核心内容，并做适当精美润色）。
2. **今日气运折损·忌**：精简列出今日最不适合做的事（应包含上述事实中‘忌’的核心内容，并做适当精美润色）。
3. **每日吉时**：推荐今天最有利于气运的 2-3 个大吉时辰，附带吉辞。
4. **今日穿搭**：根据传统五行功用推荐大方雅致的衣着风格或颜色。
5. **购物指南**：提供今日适不适合购买且适宜添置的生活/效率装备建议。
6. **理发美容**：提供今日理发或美容护理的建议。
7. **温馨提示**：一句温良治愈的今日生活小贴士。
请确保内容极简、排版考究优雅。`
        : `请直接根据您的知识库计算并提供 ${date} 日期（公历）的传统黄历推算和对应气运生活建议。
请按以下精确结构返回 Markdown 格式：
1. **宜 & 忌**：精简列出今日最适合以及最不适合做的事。
2. **每日吉时**：推荐 2-3 个大吉时辰。
3. **今日穿搭**：根据传统五行功用推荐大方雅致的衣着风格或颜色。
4. **购物指南**：提供今日适不适合购物，以及适宜添置的生活/效率装备建议。
5. **理发美容**：提供今日理发或美容护理的建议。
6. **温馨提示**：一句温良治愈的今日生活小贴士。
请确保内容极简、排版考究优雅。`;

      let result: string | undefined = undefined;
      try {
        console.log(`[Attempt 1 - Main] Calling gemini-3.5-flash for date: ${date}`);
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: contentsPrompt
        });
        result = response.text;
      } catch (gemIniErr: any) {
        console.warn(`[Attempt 1 - Main Failed] gemini-3.5-flash failed: ${gemIniErr?.message || gemIniErr}. Retrying with gemini-3.1-flash-lite...`);
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: contentsPrompt
          });
          result = response.text;
        } catch (liteErr: any) {
          console.warn(`[Attempt 1 - Lite Failed] gemini-3.1-flash-lite failed: ${liteErr?.message || liteErr}`);
        }
      }

      if (result) {
        lunarCache.set(date, {
          data: result,
          expiry: Date.now() + CACHE_TTL_MS,
          isFallback: false
        });
        return res.json({ result, isCached: false, isFallback: false });
      }
    } catch (e: any) {
      console.warn("[Attempt 1 Failed] Gemini API call failed:", e?.message);
      lastError = e;
    }

    // Attempt 2: Safe, Beautiful, Deterministic Offline Native Lunar Generator
    console.log(`[Attempt 2 - Ultimate Fallback] Generating beautiful offline calendar info for ${date}`);
    const offlineMarkdown = generateOfflineLunarInfo(date);
    const finalResult = `提示：共享 Gemini 官方 API 配额已超限，系统已无缝热切换至 ｢本地高性能黄历引擎｣！\n\n${offlineMarkdown}`;
    
    // Cache the offline response as well
    lunarCache.set(date, {
      data: finalResult,
      expiry: Date.now() + CACHE_TTL_MS,
      isFallback: true
    });

    return res.json({ 
      result: finalResult, 
      isCached: false, 
      isFallback: true,
      errorContext: lastError?.message || lastError?.toString() || "API_EXHAUSTED"
    });
  });

  app.post("/api/project-idea", async (req, res) => {
    const { existingProjects } = req.body;
    const projectsList = Array.isArray(existingProjects) ? existingProjects.map(p => String(p).toLowerCase()) : [];

    let lastError: any = null;

    // Attempt 1: Call Gemini without any search tools & with strict JSON schema structures (light tier quota)
    try {
      const ai = getAI();
      console.log("[Attempt 1] Creating smart project item with gemini-3.5-flash...");
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `请直接脑暴推荐一个极具创意、新颖且有趣的网页个人小组件/卡片项目点子。

【重要要求】：
1. 灵感来源：请以 GitHub 上高 Star、高认可度的优秀开源项目（如生活工具、创意白板、数据可视化、趣味游戏、效率神器等）为主要灵感来源。并在返回结果 the githubUrl 属性中返回该开源项目在 GitHub 的真实官方、完整的仓库链接地址（例如：https://github.com/excalidraw/excalidraw 等）。
2. 呈现方式：提取该开源项目的核心亮点，将其转化为适合在个人仪表盘（Dashboard）中作为一个独立、精致小巧的卡片展示的微型网页工具。
3. 描述内容：在描述中可以简要提及灵感来源于哪个（或哪类） GitHub 热门项目，重点说明这个部件能为用户提供什么实用的功能或疗愈趣味体验。
4. 避免重复：请不要与以下已有项目完全一样：${projectsList.join(", ")}。`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              projectName: { type: Type.STRING, description: "项目名称（可包含 Emoji）" },
              description: { type: Type.STRING, description: "简短描述（包含灵感来源和核心功能）" },
              githubUrl: { type: Type.STRING, description: "该开源项目真实、完整的 GitHub 官方仓库链接" }
            },
            required: ["projectName", "description", "githubUrl"]
          }
        }
      });

      const jsonText = response.text;
      if (jsonText) {
        const parsed = JSON.parse(jsonText);
        return res.json({
          ...parsed,
          isFallback: false
        });
      }
    } catch (e: any) {
      console.warn("[Attempt 1 Failed] JSON-Schema Gemini Project Generator failed:", e?.message);
      lastError = e;
    }

    // Attempt 2: Fallback to Offline Premium Geeks Idea Pool!
    console.log("[Attempt 2 - Ultimate Fallback] Selecting pre-vetted interactive project idea from local pool");
    const filteredPool = OFFLINE_PROJECTS_POOL.filter(idea => {
      const ideaTitle = idea.projectName.toLowerCase();
      return !projectsList.some(p => p.includes(ideaTitle) || ideaTitle.includes(p));
    });

    const activePool = filteredPool.length > 0 ? filteredPool : OFFLINE_PROJECTS_POOL;
    const randomIdx = Math.floor(Math.random() * activePool.length);
    const selectedIdea = activePool[randomIdx];

    return res.json({
      projectName: selectedIdea.projectName,
      description: `提示：共享 Gemini 官方 API 配额已超限，系统已无缝热切换至 ｢本地开源灵感库｣！\n\n${selectedIdea.description}`,
      githubUrl: selectedIdea.githubUrl,
      isFallback: true,
      errorContext: lastError?.message || lastError?.toString() || "API_EXHAUSTED"
    });
  });

  // Offline heuristic generator for self-reflection & insights
  function generateOfflineReflectionInsight(title: string, text: string) {
    const lower = (title + " " + text).toLowerCase();
    
    if (lower.includes("拖延") || lower.includes("时间") || lower.includes("计划") || lower.includes("效率") || lower.includes("推迟")) {
      return {
        reflectionSummary: "记录中清晰投射出在目标构想与真实起步之间的阻力。拖延往往不是意志力问题，而是面对复杂任务或不确定性时的心理防御机制，伴随‘等状态好了再做’的完美主义诱惑。",
        personalInsight: "【伴读小旁白见解】：对抗拖延的最优解不是加大自我鞭策，而是降低起步门槛。试着运用‘五分钟微步启动法’——不承诺完成大任务，只承诺坐在桌前打开草稿专注五分钟。行动是最好的治愈剂，启动的瞬间阻力便已消解大半。允许前两步甚至有些笨拙，‘完成’永远高于虚幻的‘完美’。",
        coreReminder: "先完成，再完美；只要迈出一小步，惯性就会站在你这一边。",
        tags: ["拖延拆解", "微步启动", "战胜内耗"]
      };
    }

    if (lower.includes("焦虑") || lower.includes("担心") || lower.includes("内耗") || lower.includes("失眠") || lower.includes("乱") || lower.includes("慌")) {
      return {
        reflectionSummary: "文字中流露出对未来不可控维度的深度预演与精神负荷。这种焦虑的根源，在于思想提前跨越了时空，试图在此时此刻去承担未来所有不确定性的重担。",
        personalInsight: "【伴读小旁白见解】：请清晰区分‘关注圈’与‘影响圈’。未来绝大多数令人辗转反侧的假设，最终都不会真正发生。试着拿出一张白纸，将担忧拆解为‘我此刻能做的事’和‘目前无法改变的事’，然后果断将后者暂时封存。专注在眼下这一小时呼吸、手头的一杯水与一件实事，力量就会重新汇聚于当下。",
        coreReminder: "焦虑是对未来的预支，而真正的从容只发生在扎根于当下的瞬间。",
        tags: ["情绪减负", "聚焦当下", "精神松绑"]
      };
    }

    if (lower.includes("脾气") || lower.includes("吵架") || lower.includes("沟通") || lower.includes("生气") || lower.includes("误解") || lower.includes("冲突")) {
      return {
        reflectionSummary: "此篇反省触及了人际互动中最微妙的边界与防御机制。情绪冲动往往发生在自身价值感遭遇挑战、或是沟通预期与对方反应脱节的电光火石之间。",
        personalInsight: "【伴读小旁白见解】：情绪的产生永远是正当的信息警报，但情绪下的即时反应往往带有破坏性。建立一个‘三秒呼吸缓冲舱’：在愤怒或委屈上涌时，不在当下做最终反驳与定论。学会向内觉察‘究竟是对方的话伤到了我，还是触碰了我自身未被疗愈的期待？’。分清双方课题，温和而坚定地表达事实，往往比争辩对错更能带来心灵的安宁。",
        coreReminder: "倾听不是为了伺机反驳，而是为了看清心与心之间的桥梁。",
        tags: ["情绪自控", "非暴力沟通", "课题分离"]
      };
    }

    if (lower.includes("自责") || lower.includes("失败") || lower.includes("差劲") || lower.includes("对比") || lower.includes("落后")) {
      return {
        reflectionSummary: "反省中流淌着严苛的超我审视与对比产生的落差感。你对自己有着极高的期许，却在阶段性挫败中将‘事情没做好’过度归因为‘自己不够好’。",
        personalInsight: "【伴读小旁白见解】：对自己最残忍的方式，就是用别人的高光时刻来惩罚自己的日常修行。成长从来不是一条光滑向上的直线，螺旋上升中的每一次回踩，都是加固地基的契机。试着像对待最好的挚友那样同情自己——如果你的好友遇到了同样的失误，你绝不会用苛刻的词汇斥责他。给自己一个温暖的拥抱，承认局限，然后轻松上阵。",
        coreReminder: "接纳自己的局限，是你通向真正强大与自洽的起点。",
        tags: ["自我和解", "告别苛责", "温柔赋能"]
      };
    }

    return {
      reflectionSummary: "这段沉静的自省展现了极高的自我觉察能力与诚恳度。能够在奔忙日常中慢下脚步、解剖内心真切经验的人，本身就已经走在了重塑自我的正道上。",
      personalInsight: "【伴读小旁白见解】：所有深刻的觉知，唯有落实为微小的日常仪式才能沉淀为内功。把反省所得提炼成明天的一条行动准则，哪怕只是早睡半小时、少看十分钟手机、或者对身边的人多一句由衷的感谢。不必急于求成，生命的厚度就是在这样日拱一卒的自察与修复中悄然长成的。",
      coreReminder: "觉察是转机的开始，每一次诚实的自省都是一次灵魂的洗礼。",
      tags: ["深度觉察", "行胜于言", "日拱一卒"]
    };
  }

  // Interactive Self-Reflection & Voiceover Commentary Endpoint (Single Item with Cache)
  app.post("/api/reflection-insight", async (req, res) => {
    const { title = "", text = "" } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text content is required" });
    }

    const cacheKey = getReflectionCacheKey(title, text);
    const cached = reflectionCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiry > now) {
      console.log(`[Reflection Cache Hit] Returning cached insight for: ${title.slice(0, 20)}`);
      return res.json({
        ...cached.data,
        isCached: true,
        isFallback: false
      });
    }

    let lastError: any = null;

    try {
      const ai = getAI();
      const prompt = `你是一位睿智、温暖、深邃的【人生伴读导师与心灵见解家】。
请阅读用户以下这段自省、日记或心路笔记文本（标题为：“${title || '自我觉察随笔'}”）：
\"\"\"
${text.slice(0, 2500)}
\"\"\"

请仔细品味用户的真实处境与内心波动，以高度共情、哲学深度和务实视角，撰写一份极具启发性与力量感的【伴读小旁白】：
1. reflectionSummary（核心总结）：提炼该反省背后的心理本质、思维定势、阻碍或核心顿悟（120-220字，直指核心，不居高临下，深具洞察）。
2. personalInsight（你的见解与前行建议）：写出你独到的见解与建议（150-300字，既有哲理宽慰，又有切实可行、能带给人心安与行动力的启发，如同老友长谈）。
3. coreReminder（铭记提醒）：凝练出一句朗朗上口、发人深省的心灵警醒/自律箴言（20-40字以内）。
4. tags（心境标签）：提取 2-4 个精准的意象/领域标签（如：#情绪止损、#知行合一、#接纳不完美、#精力管理等）。`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reflectionSummary: { type: Type.STRING, description: "反省背后的核心总结" },
              personalInsight: { type: Type.STRING, description: "导师独到的见解与前行建议" },
              coreReminder: { type: Type.STRING, description: "核心警语与前行箴言" },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "2-4个标签"
              }
            },
            required: ["reflectionSummary", "personalInsight", "coreReminder", "tags"]
          }
        }
      });

      const jsonText = response.text;
      if (jsonText) {
        const parsed = JSON.parse(jsonText);
        reflectionCache.set(cacheKey, {
          data: parsed,
          expiry: Date.now() + REFLECTION_CACHE_TTL_MS
        });
        return res.json({
          ...parsed,
          isCached: false,
          isFallback: false
        });
      }
    } catch (e: any) {
      console.warn("[Reflection Gemini Failed]", e?.message);
      lastError = e;
    }

    // High quality offline fallback heuristic
    const fallbackInsight = generateOfflineReflectionInsight(title, text);
    reflectionCache.set(cacheKey, {
      data: fallbackInsight,
      expiry: Date.now() + REFLECTION_CACHE_TTL_MS
    });
    return res.json({
      ...fallbackInsight,
      isCached: false,
      isFallback: true,
      errorContext: lastError?.message || "API_FALLBACK"
    });
  });

  // TIGHTENED BATCH ENDPOINT: Process multiple files in A SINGLE Gemini API Call!
  // Cuts N API calls down to 1 call, preventing rate-limiting / quota exhaustion.
  app.post("/api/reflection-insights-batch", async (req, res) => {
    const { items = [] } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items array is required" });
    }

    // Cap at 8 items per request for token budget and response reliability
    const batchItems = items.slice(0, 8);
    const resultsMap: Record<string, any> = {};
    const uncachedItems: Array<{ id: string; title: string; text: string; cacheKey: string }> = [];

    const now = Date.now();
    for (const item of batchItems) {
      const cacheKey = getReflectionCacheKey(item.title || "", item.text || "");
      const cached = reflectionCache.get(cacheKey);
      if (cached && cached.expiry > now) {
        resultsMap[item.id] = {
          ...cached.data,
          id: item.id,
          isCached: true,
          isFallback: false
        };
      } else {
        uncachedItems.push({
          id: item.id,
          title: item.title || "自省随笔",
          text: (item.text || "").slice(0, 1200), // Trim to save tokens
          cacheKey
        });
      }
    }

    // If all items were cached, return immediately with ZERO API calls!
    if (uncachedItems.length === 0) {
      console.log(`[Batch Reflection] All ${batchItems.length} items served from in-memory cache! 0 API calls.`);
      return res.json({
        results: batchItems.map(item => resultsMap[item.id]),
        isFallback: false
      });
    }

    console.log(`[Tightened Batch Reflection] Processing ${uncachedItems.length} uncached items in A SINGLE Gemini API Call...`);

    let lastError: any = null;
    try {
      const ai = getAI();
      const batchPrompt = `你是一位睿智、温暖、深邃的【人生伴读导师与心灵见解家】。
以下有 ${uncachedItems.length} 篇用户的自省随笔文本。请分别为每一篇撰写【伴读小旁白】（包含深度总结、你的见解与前行建议、核心提醒、标签）。
必须以严格的 JSON 数组格式返回，数组中的每个对象必须带有对应的 "id"。

待分析随笔列表：
${uncachedItems.map((u, i) => `=== 记录 [${i + 1}] ===
ID: ${u.id}
标题: ${u.title}
内容:
${u.text}
`).join("\n\n")}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: batchPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING, description: "对应的记录 ID" },
                reflectionSummary: { type: Type.STRING, description: "核心本质总结" },
                personalInsight: { type: Type.STRING, description: "导师独到见解与前行建议" },
                coreReminder: { type: Type.STRING, description: "铭记警言" },
                tags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "2-4个标签"
                }
              },
              required: ["id", "reflectionSummary", "personalInsight", "coreReminder", "tags"]
            }
          }
        }
      });

      const jsonText = response.text;
      if (jsonText) {
        const parsedList: any[] = JSON.parse(jsonText);
        for (const gen of parsedList) {
          const matchingUncached = uncachedItems.find(u => u.id === gen.id);
          if (matchingUncached) {
            reflectionCache.set(matchingUncached.cacheKey, {
              data: {
                reflectionSummary: gen.reflectionSummary,
                personalInsight: gen.personalInsight,
                coreReminder: gen.coreReminder,
                tags: gen.tags
              },
              expiry: Date.now() + REFLECTION_CACHE_TTL_MS
            });
          }
          resultsMap[gen.id] = {
            ...gen,
            isCached: false,
            isFallback: false
          };
        }

        // Check if all uncached items were resolved
        const finalResults = batchItems.map(item => {
          if (resultsMap[item.id]) return resultsMap[item.id];
          const offline = generateOfflineReflectionInsight(item.title || "", item.text || "");
          return { ...offline, id: item.id, isFallback: true };
        });

        return res.json({
          results: finalResults,
          isFallback: false
        });
      }
    } catch (e: any) {
      console.warn("[Tightened Batch Reflection Failed] Falling back to offline engine:", e?.message);
      lastError = e;
    }

    // Fallback for all uncached items
    for (const uncached of uncachedItems) {
      const offline = generateOfflineReflectionInsight(uncached.title, uncached.text);
      reflectionCache.set(uncached.cacheKey, {
        data: offline,
        expiry: Date.now() + REFLECTION_CACHE_TTL_MS
      });
      resultsMap[uncached.id] = {
        ...offline,
        id: uncached.id,
        isCached: false,
        isFallback: true
      };
    }

    const finalResults = batchItems.map(item => resultsMap[item.id]);
    return res.json({
      results: finalResults,
      isFallback: true,
      errorContext: lastError?.message || "BATCH_FALLBACK"
    });
  });

  // Quantitative Fortune Event Evaluation Endpoint (Non-random, Rigorous Calculation & Evaluation)
  app.post("/api/evaluate-fortune-event", async (req, res) => {
    const { 
      eventText = "", 
      weather = "sunny", 
      currentBalance = 0,
      streakDays = 0,
      isInterruption = false 
    } = req.body;
    if (!eventText || typeof eventText !== "string") {
      return res.status(400).json({ error: "eventText is required" });
    }

    const cleanText = eventText.trim();
    const parsedStreakDays = Math.max(0, parseInt(streakDays, 10) || 0);
    const parsedIsInterruption = Boolean(isInterruption);

    const cacheKey = `${weather}:${parsedStreakDays}:${parsedIsInterruption ? 'break' : 'norm'}:${cleanText.toLowerCase()}`;
    const cached = eventEvaluationCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiry > now) {
      console.log(`[Event Eval Cache Hit] Served cached evaluation for: ${cleanText.slice(0, 20)}`);
      return res.json({
        ...cached.data,
        isCached: true,
        isFallback: false
      });
    }

    let lastError: any = null;
    try {
      const ai = getAI();
      const prompt = `你是一位精通【心理量化动力学、蝴蝶效应与吉凶守恒定律】的严谨运势精算评估师。
用户输入了一起具体发生的现实事件。你必须严谨评判计算该事件的吉凶定性与分值，绝非随机数字！

现实事件描述：
\"\"\"
${cleanText.slice(0, 500)}
\"\"\"

当前环境天气：${
  weather === 'sunny'
    ? '晴朗（晴日朗照，函数正向加权赋予 1.2 倍放大：若为吉事乘以 1.2 倍）'
    : weather === 'cloudy'
    ? '多云阴天（拨云见日，函数正向加权赋予 1.6 倍高倍放大：若为吉事乘以 1.6 倍）'
    : weather === 'rainy'
    ? '雨天（雨落阴滞，必须强化凶的比重：若为凶事则损耗乘以 1.6 倍）'
    : '暴雨（风雨交加，凶势加权翻倍：若为凶事损耗乘以 2.0 倍）'
}
用户当前历史吉凶累积差额：${currentBalance} 分

【连击与习惯动力学核心原则】：
- 该正向活动连续坚持天数：${parsedStreakDays} 天
- 是否属于中断长期正向活动 / 破戒：${parsedIsInterruption ? '是（中断连续坚持）' : '否'}
- 原则 1（坚持正向活动的评定随着坚持时间增多可增多）：若为正向坚持活动，基础分值必须随着坚持时间增多形成复利递增（乘数 = 1 + streakDays * 0.08，例如连续坚持14天增益翻倍），在评判理由中明确写出复利加成倍数与加赠分值；
- 原则 2（中断时要扣的也多）：若属于中断连续正向活动或破戒，沉没势能严重反噬，扣分必须随着此前坚持天数的增多而扣得越多（乘数 = 1 + streakDays * 0.12，天数越长反噬扣减越重），在评判理由中严厉指出中断重挫扣罚；
- 原则 3（天气函数加权）：晴朗时正向加权 1.2 倍；多云时正向加权 1.6 倍；雨天凶事加权 1.6 倍；暴雨凶事加权 2.0 倍。

请按照以下严格计算规范输出评判：
1. valence: 事件性质，必须为 "auspicious" (心情舒畅/吉) 或 "inauspicious" (相反的事情/烦恼挫折/中断/凶)
2. rawScore: 原始基准分值（若为吉则为正数 5~50，若为凶则为负数 -5~-50）
3. finalScore: 计入天气加权（晴朗正向1.2x，多云正向1.6x，雨天凶1.6x，暴雨凶2.0x）、正向坚持复利乘数或中断重挫扣罚乘数后的最终得分（范围 -75 ~ +75）
4. magnitude: 定级（"大吉" | "中吉" | "微吉" | "微凶" | "中凶" | "大凶"）
5. intensity: 心理冲击等级 (1 到 5)
6. butterflyFactor: 蝴蝶效应级联扩散潜能指数 (0.5 到 2.5)
7. weatherDrag: 天气加剧损耗分值 (正整数)
8. evaluationRationale: 详尽精炼的评判理由与心理/现实机制解释（必须明确说明天气加权[晴朗1.2/多云1.6]、坚持天数复利加多或中断沉没重挫扣罚机制）
9. conservationForecast: 依据吉凶守恒原理，指出本次得分落地后后续时段的波峰反冲或回补趋势预警`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              valence: { type: Type.STRING, enum: ["auspicious", "inauspicious"] },
              rawScore: { type: Type.INTEGER },
              finalScore: { type: Type.INTEGER },
              magnitude: { type: Type.STRING },
              intensity: { type: Type.INTEGER },
              butterflyFactor: { type: Type.NUMBER },
              weatherDrag: { type: Type.INTEGER },
              evaluationRationale: { type: Type.STRING },
              conservationForecast: { type: Type.STRING }
            },
            required: ["valence", "rawScore", "finalScore", "magnitude", "intensity", "butterflyFactor", "weatherDrag", "evaluationRationale", "conservationForecast"]
          }
        }
      });

      const jsonText = response.text;
      if (jsonText) {
        const parsed = JSON.parse(jsonText);
        eventEvaluationCache.set(cacheKey, {
          data: parsed,
          expiry: Date.now() + EVENT_EVAL_CACHE_TTL_MS
        });
        return res.json({
          ...parsed,
          isCached: false,
          isFallback: false
        });
      }
    } catch (e: any) {
      console.warn("[Fortune Event AI Eval Failed] Falling back to offline engine:", e?.message);
      lastError = e;
    }

    const offlineEval = evaluateEventOffline(cleanText, weather, currentBalance, parsedStreakDays, parsedIsInterruption);
    eventEvaluationCache.set(cacheKey, {
      data: offlineEval,
      expiry: Date.now() + EVENT_EVAL_CACHE_TTL_MS
    });
    return res.json({
      ...offlineEval,
      isCached: false,
      isFallback: true,
      errorContext: lastError?.message || "OFFLINE_EVAL"
    });
  });

  // Complete Project Codebase & Data Push to GitHub Repository
  app.post("/api/github/push-full-project", async (req, res) => {
    try {
      const { token, repo, branch = "main", commitMessage, userData, force = true } = req.body;
      if (!token || !repo) {
        return res.status(400).json({ error: "Token and target repo (owner/repo) are required." });
      }

      const cleanRepo = repo.trim();
      if (!cleanRepo.includes("/") || cleanRepo.split("/").length !== 2) {
        return res.status(400).json({ error: "Target repository must be in owner/repo format (e.g. username/my-repo)." });
      }

      const cleanToken = token.trim();
      const cleanBranch = (branch || "main").trim();
      const cleanMsg = (commitMessage || `chore: complete project and data snapshot [${new Date().toISOString()}]`).trim();

      // 1. Embed latest user notes & cards snapshot into data/lunar_user_data.json
      if (userData) {
        const dataDir = path.join(process.cwd(), "data");
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(path.join(dataDir, "lunar_user_data.json"), JSON.stringify(userData, null, 2), "utf-8");
      }

      // 2. Ensure .gitignore covers build artifacts, secrets, and node_modules
      const gitignorePath = path.join(process.cwd(), ".gitignore");
      const requiredIgnores = ["node_modules/", "dist/", "build/", ".env*", "!.env.example", "skills/"];
      let currentGitignore = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, "utf-8") : "";
      for (const item of requiredIgnores) {
        if (!currentGitignore.includes(item)) {
          currentGitignore += `\n${item}`;
        }
      }
      fs.writeFileSync(gitignorePath, currentGitignore.trim() + "\n", "utf-8");

      // 3. Helper to run commands with safe environment
      const runCmd = (cmd: string, envOverrides: Record<string, string> = {}) => {
        return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
          exec(cmd, {
            cwd: process.cwd(),
            timeout: 60000,
            env: { ...process.env, GIT_TERMINAL_PROMPT: "0", ...envOverrides }
          }, (err, stdout, stderr) => {
            if (err) {
              reject(new Error(stderr || stdout || err.message));
            } else {
              resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
            }
          });
        });
      };

      // 4. Initialize Git repository if needed
      try {
        await runCmd("git rev-parse --is-inside-work-tree");
      } catch {
        await runCmd("git init");
      }

      await runCmd('git config user.name "Lunar User"');
      await runCmd('git config user.email "user@lunar.app"');

      // 5. Stage and commit all files in workspace
      await runCmd("git add -A");

      try {
        await runCmd(`git commit -m "${cleanMsg.replace(/"/g, '\\"')}"`);
      } catch {
        await runCmd(`git commit --allow-empty -m "${cleanMsg.replace(/"/g, '\\"')}"`);
      }

      // Set branch
      await runCmd(`git branch -M ${cleanBranch}`);

      // Push using authenticated token URL
      const encodedToken = encodeURIComponent(cleanToken);
      const pushUrl = `https://x-access-token:${encodedToken}@github.com/${cleanRepo}.git`;
      const forceFlag = force ? "--force" : "";

      await runCmd(`git push ${forceFlag} "${pushUrl}" ${cleanBranch}`);

      const repoUrl = `https://github.com/${cleanRepo}`;
      const branchUrl = `https://github.com/${cleanRepo}/tree/${cleanBranch}`;

      return res.json({
        success: true,
        repo: cleanRepo,
        branch: cleanBranch,
        repoUrl,
        branchUrl,
        commitMessage: cleanMsg
      });
    } catch (error: any) {
      console.error("[GitHub Full Project Push Error]:", error);
      let errMsg = error.message || "Failed to push full project to GitHub.";
      if (errMsg.includes("Authentication failed") || errMsg.includes("Invalid username or password") || errMsg.includes("401")) {
        errMsg = "GitHub 认证失败：Token 无效或已过期，请确保 Token 拥有目标仓库的写入权限 (repo scope)。";
      } else if (errMsg.includes("Repository not found") || errMsg.includes("404")) {
        errMsg = "目标仓库未找到 (404)：请核对仓库名是否为 用户名/仓库名，或者先在 GitHub 新建该仓库。";
      }
      return res.status(500).json({ error: errMsg });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
