import React, { useState, useEffect, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  ReferenceLine 
} from 'recharts';
import { 
  Activity, 
  CloudRain, 
  Sun, 
  Cloud, 
  CloudLightning, 
  Sparkles, 
  TrendingUp, 
  Plus, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Compass, 
  Calculator, 
  Scale, 
  Info,
  CheckCircle2,
  Loader2,
  Flame,
  AlertOctagon,
  Award,
  Edit2,
  Check,
  RotateCcw
} from 'lucide-react';
import { Solar } from 'lunar-javascript';
import { evaluateFortuneEvent, FortuneEventEvaluationResult } from '../services/geminiService';

export type WeatherType = 'sunny' | 'cloudy' | 'rainy' | 'storm';

export interface FortuneEvent {
  id: string;
  title: string;
  valence: 'auspicious' | 'inauspicious'; // 心情舒畅 (吉) 或 相反事情 (凶)
  intensity: number; // 1 to 5
  scoreChange: number; // e.g. +10 to +50 or -10 to -50
  weather: WeatherType;
  timestamp: number;
  dateStr: string;
  // Evaluation breakdown (严谨计算与评判元数据)
  magnitude?: string; // "大吉" | "中吉" | "微吉" | "微凶" | "中凶" | "大凶"
  butterflyFactor?: number;
  weatherDrag?: number;
  weatherBonus?: number;
  evaluationRationale?: string; // 详尽评判理由与心理/现实机制
  conservationForecast?: string; // 守恒推演提示
  // Habit & Streak Metas (坚持正向活动与中断动力学)
  streakDays?: number;
  isStreakContinuation?: boolean;
  isStreakInterruption?: boolean;
}

export interface DayForecastPoint {
  dayIndex: number;
  dateStr: string;
  fullDateStr: string;
  weekday: string;
  displayLabel: string;
  baseScore: number;
  butterflyRipple: number;
  conservationCounter: number;
  quantifiedScore: number; // Final calculated net score (-100 to +100)
  predictedState: '大吉' | '偏吉·防亏' | '守恒平衡' | '潜凶·慎行' | '凶相回补' | '否极泰来';
  weatherModifierScore: number;
  eventImpactTotal: number;
}

interface QuantitativeFortuneEngineProps {
  currentDate?: Date;
  onSelectDay?: (stat: { fullDateStr: string }) => void;
}

const WEATHER_CONFIG: Record<WeatherType, { 
  label: string; 
  icon: any; 
  multiplier: number; 
  valenceTarget: 'positive' | 'negative';
  badgeTag: string;
  color: string; 
  desc: string 
}> = {
  sunny: { 
    label: '晴朗', 
    icon: Sun, 
    multiplier: 1.2, 
    valenceTarget: 'positive',
    badgeTag: '吉×1.2',
    color: 'text-amber-600 bg-amber-50 border-amber-200', 
    desc: '晴日舒朗，正向吉事函数加权×1.2倍' 
  },
  cloudy: { 
    label: '多云', 
    icon: Cloud, 
    multiplier: 1.6, 
    valenceTarget: 'positive',
    badgeTag: '吉×1.6',
    color: 'text-sky-600 bg-sky-50 border-sky-200', 
    desc: '拨云见日，正向吉事函数高倍加权×1.6倍' 
  },
  rainy: { 
    label: '雨天', 
    icon: CloudRain, 
    multiplier: 1.6, 
    valenceTarget: 'negative',
    badgeTag: '凶×1.6',
    color: 'text-blue-600 bg-blue-50 border-blue-200', 
    desc: '雨落阴盛，凶相阻力加权×1.6倍' 
  },
  storm: { 
    label: '暴雨', 
    icon: CloudLightning, 
    multiplier: 2.0, 
    valenceTarget: 'negative',
    badgeTag: '凶×2.0',
    color: 'text-indigo-700 bg-indigo-50 border-indigo-200', 
    desc: '风雨如磐，凶势阻力翻倍×2.0倍' 
  },
};

const PRESET_SAMPLE_EVENTS: FortuneEvent[] = [
  {
    id: 'sample-1',
    title: '完成连续第 8 天晨跑5公里与深度复盘，神清气爽',
    valence: 'auspicious',
    intensity: 4,
    scoreChange: 50,
    weather: 'sunny',
    timestamp: Date.now() - 3600 * 1000 * 20,
    dateStr: new Date(Date.now() - 3600 * 1000 * 20).toISOString().split('T')[0],
    magnitude: '大吉',
    butterflyFactor: 2.1,
    weatherBonus: 5,
    streakDays: 8,
    isStreakContinuation: true,
    evaluationRationale: '【精算评判】：连续坚持正向活动已达 8 天，心智势能形成复利效应（坚持增益 ×1.64 倍，基础 +26 分）。适逢晴日朗照，函数加权赋予 1.2 倍正向吉运放大，最终大吉核定为 +50 分！',
    conservationForecast: '守恒预警：吉气充盈势能高位，后续时段警惕轻浮自满（物极必反），宜守正内敛。'
  },
  {
    id: 'sample-2',
    title: '雨天通勤路上严重塞车且鞋袜湿透，心烦意乱',
    valence: 'inauspicious',
    intensity: 3,
    scoreChange: -32,
    weather: 'rainy',
    timestamp: Date.now() - 3600 * 1000 * 8,
    dateStr: new Date(Date.now() - 3600 * 1000 * 8).toISOString().split('T')[0],
    magnitude: '中凶',
    butterflyFactor: 1.4,
    weatherDrag: 12,
    evaluationRationale: '【精算评判】：通勤受阻伴随不可逆的身体湿冷不适，情绪熵增明显（基准 -20分）。雨天阻力加权 ×1.6 倍，额外加重凶性损耗 12 分，最终精算核定 -32 分。',
    conservationForecast: '守恒推演：逆境负熵已随此事件加速释放，守恒蓄水池正迎来谷底回温，后续吉相回弹势能攀升。'
  },
  {
    id: 'sample-3',
    title: '多云天收到朋友送来的意外暖心咖啡',
    valence: 'auspicious',
    intensity: 2,
    scoreChange: 24,
    weather: 'cloudy',
    timestamp: Date.now() - 3600 * 1000 * 2,
    dateStr: new Date(Date.now() - 3600 * 1000 * 2).toISOString().split('T')[0],
    magnitude: '中吉',
    butterflyFactor: 1.1,
    weatherBonus: 9,
    evaluationRationale: '【精算评判】：偶发社交温情回馈（基准 +15 分）。在多云天气下，系统函数给予 1.6 倍正向强加权（加成额外 +9 分），最终核定为 +24 分！',
    conservationForecast: '守恒状态：微量温和充能，有助于维持当下身心阴阳平衡。'
  }
];

export const QuantitativeFortuneEngine: React.FC<QuantitativeFortuneEngineProps> = ({
  currentDate = new Date(),
  onSelectDay
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [currentWeather, setCurrentWeather] = useState<WeatherType>('sunny'); // Default sunny with 1.2x positive weighting
  const [events, setEvents] = useState<FortuneEvent[]>(() => {
    try {
      const saved = localStorage.getItem('lunar_fortune_events_v4');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to parse saved events', e);
    }
    return PRESET_SAMPLE_EVENTS;
  });

  // Habit & Continuous Discipline State (坚持正向活动机制)
  const [habitName, setHabitName] = useState<string>(() => {
    return localStorage.getItem('lunar_habit_name') || '晨起练息与深度专注';
  });
  const [habitStreakDays, setHabitStreakDays] = useState<number>(() => {
    const val = localStorage.getItem('lunar_habit_streak_days');
    return val !== null ? Math.max(0, parseInt(val, 10) || 0) : 8; // Default 8 days
  });
  const [isEditingHabitName, setIsEditingHabitName] = useState(false);
  const [tempHabitName, setTempHabitName] = useState(habitName);

  // Reset Confirmation State (No window.confirm, 100% works in iFrame)
  const [isResetConfirming, setIsResetConfirming] = useState(false);
  const [resetFeedbackMsg, setResetFeedbackMsg] = useState<string | null>(null);

  // Form State
  const [eventTitle, setEventTitle] = useState('');
  const [showEventForm, setShowEventForm] = useState(false);
  const [formCategory, setFormCategory] = useState<'normal' | 'streak_continue' | 'streak_break'>('streak_continue');
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(0);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Live AI Evaluation State
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [liveEvaluation, setLiveEvaluation] = useState<FortuneEventEvaluationResult | null>(null);

  // Persist events & habits
  useEffect(() => {
    localStorage.setItem('lunar_fortune_events_v4', JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem('lunar_habit_name', habitName);
    localStorage.setItem('lunar_habit_streak_days', habitStreakDays.toString());
  }, [habitName, habitStreakDays]);

  // Current Streak Multipliers
  const streakBonusMultiplier = useMemo(() => {
    return 1.0 + Math.min(1.8, habitStreakDays * 0.08);
  }, [habitStreakDays]);

  const streakBreakPenaltyMultiplier = useMemo(() => {
    return 1.0 + Math.min(2.2, Math.max(1, habitStreakDays) * 0.12);
  }, [habitStreakDays]);

  // Calculate Net Accumulated Energy & Conservation Delta
  const { totalPositiveEnergy, totalNegativeEnergy, netHistoricalBalance } = useMemo(() => {
    let pos = 0;
    let neg = 0;
    events.forEach(e => {
      if (e.scoreChange > 0) {
        pos += e.scoreChange;
      } else {
        neg += Math.abs(e.scoreChange);
      }
    });
    return {
      totalPositiveEnergy: pos,
      totalNegativeEnergy: neg,
      netHistoricalBalance: pos - neg
    };
  }, [events]);

  // Handle Event Evaluation Trigger (Rigorous calculation with streak & weather positive multipliers)
  const handlePerformEvaluation = async (textToEval: string) => {
    if (!textToEval.trim()) return;
    setIsEvaluating(true);
    try {
      const isInterruption = formCategory === 'streak_break';
      const streakParam = formCategory === 'streak_continue' 
        ? habitStreakDays + 1 
        : (formCategory === 'streak_break' ? habitStreakDays : 0);

      const evalResult = await evaluateFortuneEvent(
        textToEval.trim(), 
        currentWeather, 
        netHistoricalBalance,
        streakParam,
        isInterruption
      );
      setLiveEvaluation(evalResult);
    } catch (err) {
      console.error("Evaluation error:", err);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Handle Event Add
  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;

    const isInterruption = formCategory === 'streak_break';
    const streakParam = formCategory === 'streak_continue' 
      ? habitStreakDays + 1 
      : (formCategory === 'streak_break' ? habitStreakDays : 0);

    let finalEval = liveEvaluation;
    if (!finalEval) {
      setIsEvaluating(true);
      try {
        finalEval = await evaluateFortuneEvent(
          eventTitle.trim(), 
          currentWeather, 
          netHistoricalBalance,
          streakParam,
          isInterruption
        );
      } catch (err) {
        console.error("Evaluation error during submit:", err);
      } finally {
        setIsEvaluating(false);
      }
    }

    const calculatedScore = finalEval ? finalEval.finalScore : 15;
    const valence = finalEval ? finalEval.valence : (calculatedScore >= 0 ? 'auspicious' : 'inauspicious');

    const newEvt: FortuneEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title: eventTitle.trim(),
      valence,
      intensity: finalEval?.intensity || 3,
      scoreChange: calculatedScore,
      weather: currentWeather,
      timestamp: Date.now(),
      dateStr: new Date().toISOString().split('T')[0],
      magnitude: finalEval?.magnitude || (calculatedScore >= 0 ? '中吉' : '中凶'),
      butterflyFactor: finalEval?.butterflyFactor || (isInterruption ? 2.1 : 1.5),
      weatherDrag: finalEval?.weatherDrag || 0,
      weatherBonus: finalEval?.weatherBonus || 0,
      streakDays: formCategory !== 'normal' ? streakParam : undefined,
      isStreakContinuation: formCategory === 'streak_continue',
      isStreakInterruption: formCategory === 'streak_break',
      evaluationRationale: finalEval?.evaluationRationale || '【系统精算评判】：依据语义深度测算与动力学加权完成核定。',
      conservationForecast: finalEval?.conservationForecast || '【守恒推演】：吉凶守恒天平动态平衡中。'
    };

    // Update streak according to user action:
    if (formCategory === 'streak_continue') {
      setHabitStreakDays(prev => prev + 1);
    } else if (formCategory === 'streak_break') {
      setHabitStreakDays(0); // Interrupted, reset streak
    }

    setEvents(prev => [newEvt, ...prev]);
    setEventTitle('');
    setLiveEvaluation(null);
    setShowEventForm(false);
  };

  const handleRemoveEvent = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  const handleLoadSampleEvents = () => {
    setEvents(PRESET_SAMPLE_EVENTS);
    setHabitStreakDays(8);
    setResetFeedbackMsg("已成功载入初始示例！");
    setTimeout(() => setResetFeedbackMsg(null), 3000);
  };

  const handleClearAllEvents = () => {
    setEvents([]);
    setResetFeedbackMsg("已清空实况事件列表");
    setTimeout(() => setResetFeedbackMsg(null), 3000);
  };

  // Immediate Reset Streak Handler (Fixing "点重置没反应")
  const handleResetStreak = () => {
    if (!isResetConfirming) {
      setIsResetConfirming(true);
      setTimeout(() => setIsResetConfirming(false), 4000);
    } else {
      setHabitStreakDays(0);
      localStorage.setItem('lunar_habit_streak_days', '0');
      setIsResetConfirming(false);
      setResetFeedbackMsg("连续坚持天数已清零！");
      setTimeout(() => setResetFeedbackMsg(null), 3000);
    }
  };

  // Compute 7-day quantitative forecasting curve
  const weekForecast = useMemo<DayForecastPoint[]>(() => {
    const now = currentDate;
    const currentDayOfWeek = now.getDay();
    const diffToMonday = (currentDayOfWeek + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const points: DayForecastPoint[] = [];
    const weekdayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

    const conservationPull = -netHistoricalBalance * 0.45;

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + i);

      const y = dayDate.getFullYear();
      const m = dayDate.getMonth() + 1;
      const d = dayDate.getDate();

      const solar = Solar.fromYmd(y, m, d);
      const lunar = solar.getLunar();
      const dayYi = lunar.getDayYi?.() || [];
      const dayJi = lunar.getDayJi?.() || [];
      const dateStr = `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const fullDateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      const naturalBase = Math.round((dayYi.length - dayJi.length) * 2.8);

      const dayOffset = i; // 0 to 6
      const conservationDecay = Math.cos((dayOffset * Math.PI) / 3.2);
      const conservationEffect = Math.round(conservationPull * conservationDecay);

      let butterflyRipple = 0;
      events.forEach((evt, idx) => {
        const timeDiffDays = (dayDate.getTime() - evt.timestamp) / (1000 * 3600 * 24);
        if (timeDiffDays >= -1 && timeDiffDays <= 7) {
          const distance = Math.max(0, timeDiffDays);
          const factor = evt.butterflyFactor || 1.5;
          const ripple = (evt.scoreChange * 0.35 * (factor / 1.5)) * Math.exp(-distance * 0.35) * Math.sin(distance * 1.8 + idx);
          butterflyRipple += ripple;
        }
      });
      butterflyRipple = Math.round(butterflyRipple);

      // Weather function weighting vector:
      // 晴朗时正向加权 1.2 (+6)，多云时正向加权 1.6 (+14)，雨天凶相强化 1.6 (-10)，暴雨凶相强化 2.0 (-18)
      let weatherModifierScore = 0;
      if (currentWeather === 'sunny') {
        weatherModifierScore = 6; // +1.2x positive uplift
      } else if (currentWeather === 'cloudy') {
        weatherModifierScore = 14; // +1.6x positive high boost
      } else if (currentWeather === 'rainy') {
        weatherModifierScore = -10; // -1.6x negative drag
      } else if (currentWeather === 'storm') {
        weatherModifierScore = -18; // -2.0x negative drag
      }

      let rawScore = naturalBase + conservationEffect + butterflyRipple + weatherModifierScore;
      const quantifiedScore = Math.max(-95, Math.min(95, rawScore));

      let predictedState: DayForecastPoint['predictedState'] = '守恒平衡';
      if (quantifiedScore >= 35) {
        predictedState = netHistoricalBalance > 20 ? '偏吉·防亏' : '大吉';
      } else if (quantifiedScore >= 10) {
        predictedState = '偏吉·防亏';
      } else if (quantifiedScore <= -35) {
        predictedState = netHistoricalBalance < -20 ? '否极泰来' : '凶相回补';
      } else if (quantifiedScore <= -10) {
        predictedState = '潜凶·慎行';
      }

      const eventImpactTotal = events
        .filter(e => e.dateStr === fullDateStr)
        .reduce((acc, curr) => acc + curr.scoreChange, 0);

      points.push({
        dayIndex: i,
        dateStr,
        fullDateStr,
        weekday: weekdayNames[i],
        displayLabel: `${weekdayNames[i]} (${dateStr})`,
        baseScore: naturalBase,
        butterflyRipple,
        conservationCounter: conservationEffect,
        quantifiedScore,
        predictedState,
        weatherModifierScore,
        eventImpactTotal
      });
    }

    return points;
  }, [currentDate, events, currentWeather, netHistoricalBalance]);

  const activeDay = weekForecast[selectedDayIdx] || weekForecast[0];

  return (
    <div className="my-4 bg-gradient-to-br from-zinc-50 via-white to-orange-50/20 border border-zinc-200/80 rounded-3xl p-5 shadow-xs transition-all">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0">
            <Activity size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-zinc-900 text-sm tracking-tight">
                量化吉凶动力学预测系统
              </h4>
              <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sun size={11} className="text-amber-600" />
                晴朗加权×1.2 · 多云加权×1.6
              </span>
              <span className="text-[10px] bg-orange-100 text-orange-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Flame size={11} className="text-orange-600" />
                坚持复利增多 · 中断加倍严惩
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              晴朗赋予 1.2 倍正向加权，多云赋予 1.6 倍正向强加权；正向活动坚持越久加分越多，中断时沉没反噬严厉重扣
            </p>
          </div>
        </div>

        {/* Current Weather Selector (晴朗1.2x，多云1.6x，雨天凶1.6x，暴雨凶2.0x) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-zinc-100 p-1 rounded-2xl border border-zinc-200/60 text-xs">
            {(Object.keys(WEATHER_CONFIG) as WeatherType[]).map((wKey) => {
              const cfg = WEATHER_CONFIG[wKey];
              const Icon = cfg.icon;
              const isActive = currentWeather === wKey;
              return (
                <button
                  key={wKey}
                  type="button"
                  onClick={() => setCurrentWeather(wKey)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                  title={`${cfg.label}：${cfg.desc}`}
                >
                  <Icon size={14} className={isActive ? (wKey === 'rainy' || wKey === 'storm' ? 'text-blue-600' : 'text-amber-500') : ''} />
                  <span>{cfg.label}</span>
                  <span className={`text-[9px] px-1 rounded font-mono font-bold ${
                    wKey === 'sunny' ? 'bg-amber-100 text-amber-800' :
                    wKey === 'cloudy' ? 'bg-sky-100 text-sky-800' :
                    wKey === 'rainy' ? 'bg-blue-100 text-blue-700' :
                    'bg-indigo-100 text-indigo-700'
                  }`}>
                    {cfg.badgeTag}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-colors shrink-0 cursor-pointer"
            title={isExpanded ? '收起量化预测' : '展开量化预测'}
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4 pt-4">
          {/* Continuous Positive Habit Momentum Banner (坚持正向活动连击链动力学) */}
          <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-emerald-500/10 border border-amber-200/80 rounded-2xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-sm shrink-0">
                <Flame size={20} className="animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  {isEditingHabitName ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={tempHabitName}
                        onChange={(e) => setTempHabitName(e.target.value)}
                        className="text-xs px-2 py-0.5 bg-white border border-amber-300 rounded font-semibold focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (tempHabitName.trim()) setHabitName(tempHabitName.trim());
                          setIsEditingHabitName(false);
                        }}
                        className="p-1 bg-amber-600 text-white rounded hover:bg-amber-700 cursor-pointer"
                      >
                        <Check size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-zinc-900 text-xs">
                        正向活动追踪：【{habitName}】
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setTempHabitName(habitName);
                          setIsEditingHabitName(true);
                        }}
                        className="text-zinc-400 hover:text-zinc-700 p-0.5 cursor-pointer"
                        title="修改正向活动名称"
                      >
                        <Edit2 size={11} />
                      </button>
                    </div>
                  )}

                  <span className="text-[10px] bg-amber-600 text-white font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                    连续坚持 {habitStreakDays} 天
                  </span>

                  {resetFeedbackMsg && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full animate-fade-in">
                      {resetFeedbackMsg}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-[11px] text-zinc-600 mt-1 flex-wrap">
                  <span className="flex items-center gap-1 text-emerald-800 font-semibold">
                    🔥 坚持复利增益：
                    <strong className="font-mono text-emerald-700">+{Math.round(habitStreakDays * 8)}% (×{streakBonusMultiplier.toFixed(2)})</strong>
                    <span className="text-[10px] text-zinc-400 font-normal">（坚持越久加分越多）</span>
                  </span>
                  <span className="text-zinc-300">|</span>
                  <span className="flex items-center gap-1 text-rose-800 font-semibold">
                    🚨 中断重挫严惩：
                    <strong className="font-mono text-rose-700">×{streakBreakPenaltyMultiplier.toFixed(2)}倍</strong>
                    <span className="text-[10px] text-zinc-400 font-normal">（沉没惯性反噬，中断扣的也多）</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Adjustment Controls with Responsive Zero-Failure Reset */}
            <div className="flex items-center gap-1.5 self-end md:self-center">
              <button
                type="button"
                onClick={() => setHabitStreakDays(prev => prev + 1)}
                className="text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded-xl shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
                title="手动快速增加1天坚持连击"
              >
                <Plus size={12} />
                <span>连击+1天</span>
              </button>
              
              {/* Reliable Reset Button (No window.confirm to avoid iFrame suppression) */}
              <button
                type="button"
                onClick={handleResetStreak}
                className={`text-[11px] border font-medium px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 cursor-pointer ${
                  isResetConfirming 
                    ? "bg-rose-600 border-rose-700 text-white font-bold animate-pulse shadow-sm"
                    : "bg-white hover:bg-rose-50 border-zinc-200 hover:border-rose-200 text-zinc-600 hover:text-rose-600"
                }`}
                title={isResetConfirming ? "请再次点击以确认将连续坚持天数清零" : "点击重置坚持天数"}
              >
                <RotateCcw size={11} className={isResetConfirming ? "animate-spin" : ""} />
                <span>{isResetConfirming ? "确定归零？" : "重置天数"}</span>
              </button>
            </div>
          </div>

          {/* Key Quantitative Indicators Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Metric 1: Real-time Net Index */}
            <div className="bg-white rounded-2xl p-3.5 border border-zinc-200/70 shadow-2xs">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
                今日量化运势净值
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-2xl font-black font-mono tracking-tight ${
                  activeDay.quantifiedScore >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {activeDay.quantifiedScore > 0 ? `+${activeDay.quantifiedScore}` : activeDay.quantifiedScore}
                </span>
                <span className="text-xs font-bold text-zinc-700">
                  {activeDay.predictedState}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1 truncate">
                基准 {activeDay.baseScore > 0 ? `+${activeDay.baseScore}` : activeDay.baseScore} | 扰动 {activeDay.butterflyRipple > 0 ? `+${activeDay.butterflyRipple}` : activeDay.butterflyRipple}
              </p>
            </div>

            {/* Metric 2: Conservation Equilibrium Potential */}
            <div className="bg-white rounded-2xl p-3.5 border border-zinc-200/70 shadow-2xs">
              <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                <span>吉凶守恒天平</span>
                <Scale size={13} className="text-zinc-400" />
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-base font-black text-zinc-800 font-mono">
                  {netHistoricalBalance >= 0 ? `吉积 +${netHistoricalBalance}` : `凶耗 ${netHistoricalBalance}`}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">势能差</span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-1 truncate">
                {netHistoricalBalance > 15 
                  ? '⚠️ 吉盛达峰：后续凶相回补中' 
                  : netHistoricalBalance < -15 
                    ? '✨ 凶煞已散：正蓄力回弹吉相' 
                    : '阴阳相济，守恒平衡'}
              </p>
            </div>

            {/* Metric 3: Weather Weighting (晴朗正向1.2，多云正向1.6，雨天凶1.6，暴雨凶2.0) */}
            <div className={`rounded-2xl p-3.5 border shadow-2xs transition-all ${WEATHER_CONFIG[currentWeather].color}`}>
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                <span>天气函数加权</span>
                <span>{WEATHER_CONFIG[currentWeather].label}</span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-1 font-mono">
                <span className="text-xl font-black">
                  ×{WEATHER_CONFIG[currentWeather].multiplier.toFixed(1)}
                </span>
                <span className="text-xs font-semibold">
                  {WEATHER_CONFIG[currentWeather].valenceTarget === 'positive' ? '正向吉相乘数' : '凶相阻力乘数'}
                </span>
              </div>
              <p className="text-[10px] opacity-80 mt-1 truncate">
                {WEATHER_CONFIG[currentWeather].desc}
              </p>
            </div>

            {/* Metric 4: Butterfly Ripple Power */}
            <div className="bg-white rounded-2xl p-3.5 border border-zinc-200/70 shadow-2xs">
              <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                <span>蝴蝶扰动波幅</span>
                <span>🦋 混沌级联</span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className={`text-xl font-black font-mono ${
                  activeDay.butterflyRipple >= 0 ? 'text-amber-600' : 'text-indigo-600'
                }`}>
                  {activeDay.butterflyRipple > 0 ? `+${activeDay.butterflyRipple}` : activeDay.butterflyRipple}
                </span>
                <span className="text-[10px] text-zinc-500 font-medium">波动级联</span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-1 truncate">
                实录事件非线性谐振涟漪
              </p>
            </div>
          </div>

          {/* Interactive Non-linear Chart */}
          <div className="bg-white rounded-2xl p-4 border border-zinc-200/70 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUp size={15} className="text-orange-600" />
                <span className="text-xs font-bold text-zinc-800">
                  七日量化预测走势 · 守恒反扑与蝴蝶波形
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  偏吉高位
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                  凶势回补
                </span>
                <span className="text-zinc-300">|</span>
                <span className="font-mono text-zinc-500">基准平衡线 (0)</span>
              </div>
            </div>

            <div className="h-44 w-full -ml-3">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={weekForecast}
                  margin={{ top: 12, right: 14, left: -16, bottom: 0 }}
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload.length) {
                      const stat = e.activePayload[0].payload as DayForecastPoint;
                      setSelectedDayIdx(stat.dayIndex);
                      onSelectDay?.({ fullDateStr: stat.fullDateStr });
                    }
                  }}
                >
                  <defs>
                    <linearGradient id="quantGradientPositive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="displayLabel" 
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <YAxis 
                    domain={[-100, 100]} 
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    ticks={[-80, -40, 0, 40, 80]}
                  />
                  <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="2 2" />

                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload as DayForecastPoint;
                        return (
                          <div className="bg-zinc-900/95 text-white p-3 rounded-xl shadow-xl text-xs backdrop-blur-md border border-white/10 space-y-1.5 min-w-[200px]">
                            <div className="flex items-center justify-between font-bold border-b border-white/10 pb-1">
                              <span>{data.fullDateStr} ({data.weekday})</span>
                              <span className={data.quantifiedScore >= 0 ? "text-emerald-400" : "text-rose-400"}>
                                {data.quantifiedScore > 0 ? `+${data.quantifiedScore}` : data.quantifiedScore} 分
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-300 space-y-0.5">
                              <div>运势状态：<strong className="text-white">{data.predictedState}</strong></div>
                              <div>守恒反冲：<span className="font-mono">{data.conservationCounter > 0 ? `+${data.conservationCounter}` : data.conservationCounter}</span></div>
                              <div>蝴蝶扰动：<span className="font-mono">{data.butterflyRipple > 0 ? `+${data.butterflyRipple}` : data.butterflyRipple}</span></div>
                              {data.weatherModifierScore !== 0 && (
                                <div className={data.weatherModifierScore > 0 ? "text-amber-300" : "text-blue-300"}>
                                  {data.weatherModifierScore > 0 
                                    ? `天气正向加权：+${data.weatherModifierScore}` 
                                    : `天气阻力耗损：${data.weatherModifierScore}`}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />

                  <Area
                    type="monotone"
                    dataKey="quantifiedScore"
                    stroke="#f97316"
                    strokeWidth={2.5}
                    fill="url(#quantGradientPositive)"
                    dot={{ r: 3, fill: '#f97316', strokeWidth: 2, stroke: '#ffffff' }}
                    activeDot={{ r: 6, fill: '#ea580c' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Bottom Insight Interpretation */}
            <div className="mt-2 pt-3 border-t border-zinc-100 flex items-start gap-2.5 text-xs text-zinc-600 bg-amber-50/40 rounded-xl p-3">
              <Compass size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold text-amber-950 mr-1">
                  动力学机理洞察：
                </span>
                {netHistoricalBalance > 15 ? (
                  <span>
                    您近期累积了较多<strong>【正向坚持或心境舒畅】</strong>事件。依照<strong>吉凶守恒原理</strong>，吉盛则凶相在后渐次反扑，系统已在后续预测中加入了<strong>凶相回补衰减波</strong>。
                    {currentWeather === 'sunny' && '今日适逢晴朗模式，正向吉事拥有 1.2 倍加成，可借朗朗晴空积极谋事。'}
                    {currentWeather === 'cloudy' && '今日适逢多云模式，拨云见日正向吉事加权 1.6 倍，破阻成吉势能极强。'}
                    {currentWeather === 'rainy' && '雨天凶相比重加权 1.6 倍，提醒戒躁缓行。'}
                  </span>
                ) : netHistoricalBalance < -15 ? (
                  <span>
                    您近期承受了较多<strong>【习惯中断或挫折郁结】</strong>事件。依照<strong>吉凶守恒原理</strong>，凶煞与沉没熵增已然出尽，负熵已释放完毕。
                    {currentWeather === 'sunny' ? '叠加晴日 1.2 倍正向加权，蝴蝶效应曲线正加速回弹，即将否极泰来！' : '后续时段吉气正加速回填，曙光在望！'}
                  </span>
                ) : (
                  <span>
                    当前阴阳守恒维持在平衡态。每次您录入的新事件都会由精算引擎严密计算并如<strong>蝴蝶扇动翅膀</strong>般，在未来数日的走势中扩散出非线性的谐振涟漪。
                    {currentWeather === 'sunny' && '当前设为晴朗模式，正向吉事享有 1.2 倍函数加权。'}
                    {currentWeather === 'cloudy' && '当前设为多云模式，正向吉事享有 1.6 倍高倍函数加权。'}
                    {currentWeather === 'rainy' && '当前设为雨天模式，凶相比重提升 1.6 倍。'}
                    {currentWeather === 'storm' && '当前设为暴雨模式，凶相阻力翻倍至 2.0 倍。'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Life Event Logger */}
          <div className="bg-white rounded-2xl p-4 border border-zinc-200/70 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <span className="text-xs font-bold text-zinc-900">
                  现实生活事件录入录（触发守恒与蝴蝶效应）
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  ({events.length} 条实录 · 均经过系统量化评判)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadSampleEvents}
                  className="text-[11px] text-orange-700 hover:text-orange-900 font-medium px-2 py-0.5 rounded-lg bg-orange-50 border border-orange-200 cursor-pointer"
                  title="载入示例事件"
                >
                  载入示例实况
                </button>
                <button
                  type="button"
                  onClick={handleClearAllEvents}
                  className="text-[11px] text-zinc-500 hover:text-rose-600 font-medium px-2 py-0.5 rounded-lg bg-zinc-50 border border-zinc-200 cursor-pointer"
                  title="清空当前所有事件"
                >
                  清空列表
                </button>
                <button
                  type="button"
                  onClick={() => setShowEventForm(!showEventForm)}
                  className="flex items-center gap-1 px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <Plus size={13} />
                  <span>记录新事件</span>
                </button>
              </div>
            </div>

            {/* Quick Add Form Drawer */}
            {showEventForm && (
              <form onSubmit={handleAddEvent} className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200/80 space-y-3.5">
                {/* Mode Selector */}
                <div>
                  <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">
                    选择事件性质与习惯连击关联：
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFormCategory('streak_continue');
                        setLiveEvaluation(null);
                        if (!eventTitle) setEventTitle(`坚持【${habitName}】打卡达标`);
                      }}
                      className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                        formCategory === 'streak_continue'
                          ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20 text-emerald-950'
                          : 'bg-white border-zinc-200 hover:bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-xs">
                        <span className="flex items-center gap-1 text-emerald-700">
                          <Flame size={13} />
                          <span>坚持正向活动打卡</span>
                        </span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-mono">
                          第 {habitStreakDays + 1} 天
                        </span>
                      </div>
                      <span className="text-[10px] opacity-75">
                        分值随坚持时间复利递增（当前加成 ×{(1.0 + Math.min(1.8, (habitStreakDays + 1) * 0.08)).toFixed(2)}）
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFormCategory('streak_break');
                        setLiveEvaluation(null);
                        if (!eventTitle || eventTitle.includes('坚持')) setEventTitle(`偷懒破戒，中断了连续${habitStreakDays}天的【${habitName}】`);
                      }}
                      className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                        formCategory === 'streak_break'
                          ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/20 text-rose-950'
                          : 'bg-white border-zinc-200 hover:bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-xs">
                        <span className="flex items-center gap-1 text-rose-700">
                          <AlertOctagon size={13} />
                          <span>中断正向活动 / 破戒</span>
                        </span>
                        <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded font-mono font-bold">
                          严厉重扣
                        </span>
                      </div>
                      <span className="text-[10px] opacity-75">
                        沉没惯性反噬，中断时按天数扣的更多（惩罚 ×{streakBreakPenaltyMultiplier.toFixed(2)}倍）
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFormCategory('normal');
                        setLiveEvaluation(null);
                      }}
                      className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                        formCategory === 'normal'
                          ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20 text-amber-950'
                          : 'bg-white border-zinc-200 hover:bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-xs">
                        <span className="flex items-center gap-1 text-zinc-800">
                          <Compass size={13} />
                          <span>日常随手记事</span>
                        </span>
                        <span className="text-[10px] bg-zinc-100 text-zinc-600 px-1.5 py-0.2 rounded font-mono">
                          常规
                        </span>
                      </div>
                      <span className="text-[10px] opacity-75">
                        常规生活遭遇事件，不牵涉长期正向习惯连击
                      </span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={eventTitle}
                      onChange={(e) => {
                        setEventTitle(e.target.value);
                        setLiveEvaluation(null);
                      }}
                      placeholder={
                        formCategory === 'streak_continue'
                          ? `输入今日坚持正向活动详情（如：晨跑5公里完成并进行冥想反思，连续第${habitStreakDays + 1}天）`
                          : formCategory === 'streak_break'
                            ? `输入中断原因（如：今天因熬夜打游戏严重拖延，中断了连续${habitStreakDays}天的运动计划）`
                            : "输入刚才遇到的事情（例如：重要报告获领导赞赏 / 下午下雨鞋子湿透心烦 / 解决了一个顽固Bug）"
                      }
                      className="w-full px-3.5 py-2.5 bg-white border border-zinc-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all pr-24"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handlePerformEvaluation(eventTitle)}
                      disabled={!eventTitle.trim() || isEvaluating}
                      className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-40 text-zinc-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      {isEvaluating ? <Loader2 size={12} className="animate-spin text-orange-600" /> : <Calculator size={12} />}
                      <span>精算评定</span>
                    </button>
                  </div>
                </div>

                {/* Real-time Calculation & Evaluation Preview Card */}
                {liveEvaluation && (
                  <div className={`p-3.5 rounded-xl border text-xs space-y-2 transition-all ${
                    liveEvaluation.valence === 'auspicious'
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      : 'bg-rose-50/70 border-rose-200 text-rose-950'
                  }`}>
                    <div className="flex items-center justify-between font-bold flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] text-white ${
                          liveEvaluation.valence === 'auspicious' ? 'bg-emerald-600' : 'bg-rose-600'
                        }`}>
                          {liveEvaluation.magnitude}
                        </span>
                        <span>系统精算核定：</span>
                        <span className="font-mono text-sm">
                          {liveEvaluation.finalScore > 0 ? `+${liveEvaluation.finalScore}` : liveEvaluation.finalScore} 分
                        </span>
                        {liveEvaluation.weatherBonus && liveEvaluation.weatherBonus > 0 ? (
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-mono">
                            {currentWeather === 'sunny' ? '☀️ 晴朗加成 +1.2x' : '⛅ 多云加成 +1.6x'} (+{liveEvaluation.weatherBonus})
                          </span>
                        ) : null}
                        {liveEvaluation.weatherDrag && liveEvaluation.weatherDrag > 0 ? (
                          <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono">
                            雨天加权耗损 -{liveEvaluation.weatherDrag}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[11px] font-mono text-zinc-500 font-normal">
                        蝴蝶潜能系数：{liveEvaluation.butterflyFactor}x
                      </span>
                    </div>

                    <div className="text-[11px] leading-relaxed opacity-90 pl-1 border-l-2 border-current/30">
                      {liveEvaluation.evaluationRationale}
                    </div>

                    <div className="text-[10px] opacity-75 flex items-center gap-1">
                      <Info size={12} className="shrink-0" />
                      <span>{liveEvaluation.conservationForecast}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                  <div className="text-[11px] text-zinc-500 font-medium">
                    {currentWeather === 'sunny' && (
                      <span className="text-amber-700 font-semibold">
                        ☀️ 晴朗模式：正向吉事函数加权 1.2 倍
                      </span>
                    )}
                    {currentWeather === 'cloudy' && (
                      <span className="text-sky-700 font-semibold">
                        ⛅ 多云模式：正向吉事函数高倍加权 1.6 倍
                      </span>
                    )}
                    {currentWeather === 'rainy' && (
                      <span className="text-blue-600 font-semibold">
                        🌧️ 雨天模式：凶相阻力加权 1.6 倍
                      </span>
                    )}
                    {currentWeather === 'storm' && (
                      <span className="text-indigo-700 font-semibold">
                        ⛈️ 暴雨模式：凶相阻力翻倍 2.0 倍
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEventForm(false);
                        setLiveEvaluation(null);
                      }}
                      className="px-3 py-1.5 text-zinc-500 hover:text-zinc-800 font-medium text-xs cursor-pointer"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={!eventTitle.trim() || isEvaluating}
                      className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white font-bold rounded-xl transition-all shadow-xs cursor-pointer text-xs flex items-center gap-1.5"
                    >
                      {isEvaluating ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                      <span>{liveEvaluation ? "确认提交并推演" : "精算核定并推演"}</span>
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* List of Recent Logged Events */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {events.length === 0 ? (
                <div className="text-center py-6 text-zinc-400 text-xs border border-dashed border-zinc-200 rounded-xl">
                  暂无记录，点击右上角【记录新事件】输入您生活中的好心情或烦心事，系统将即刻进行严谨评判定级！
                </div>
              ) : (
                events.map((evt) => {
                  const isExpandedThis = expandedEventId === evt.id;
                  return (
                    <div
                      key={evt.id}
                      className={`rounded-xl border transition-all ${
                        evt.valence === 'auspicious'
                          ? 'bg-emerald-50/40 border-emerald-200/60'
                          : 'bg-rose-50/40 border-rose-200/60'
                      }`}
                    >
                      <div className="flex items-center justify-between p-2.5">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            evt.valence === 'auspicious' ? 'bg-emerald-500' : 'bg-rose-500'
                          }`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-zinc-900 truncate">
                                {evt.title}
                              </span>
                              {evt.magnitude && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                                  evt.valence === 'auspicious' 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {evt.magnitude}
                                </span>
                              )}
                              {evt.isStreakContinuation && (
                                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded shrink-0">
                                  🔥 连击第 {evt.streakDays} 天 (复利加成)
                                </span>
                              )}
                              {evt.isStreakInterruption && (
                                <span className="text-[10px] bg-rose-600 text-white font-bold px-1.5 py-0.2 rounded shrink-0">
                                  🚨 中断破戒 (重挫严惩)
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5 font-mono">
                              <span>{evt.dateStr}</span>
                              <span>·</span>
                              <span>{WEATHER_CONFIG[evt.weather].label}</span>
                              <span>·</span>
                              <span className={evt.scoreChange > 0 ? "text-emerald-700 font-bold" : "text-rose-700 font-bold"}>
                                核定 {evt.scoreChange > 0 ? `+${evt.scoreChange}` : evt.scoreChange} 分
                              </span>
                              {evt.weatherBonus && evt.weatherBonus > 0 ? (
                                <span className="text-amber-600 font-semibold">(天气加权 +{evt.weatherBonus})</span>
                              ) : null}
                              {evt.weatherDrag ? (
                                <span className="text-blue-600 font-semibold">(雨天加权耗损 -{evt.weatherDrag})</span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <button
                            type="button"
                            onClick={() => setExpandedEventId(isExpandedThis ? null : evt.id)}
                            className="text-[10px] text-zinc-500 hover:text-zinc-800 px-2 py-0.5 rounded-md hover:bg-zinc-100 transition-colors cursor-pointer flex items-center gap-0.5"
                            title="查看精算依据"
                          >
                            <span>评判依据</span>
                            {isExpandedThis ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveEvent(evt.id)}
                            className="p-1 text-zinc-400 hover:text-rose-600 rounded-md hover:bg-zinc-100 transition-colors cursor-pointer"
                            title="删除此项记录"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Expandable Evaluation & Calculation Mechanism Drawer */}
                      {isExpandedThis && (
                        <div className="px-3 pb-3 pt-1 border-t border-zinc-200/50 text-[11px] text-zinc-600 space-y-1.5 bg-white/60 rounded-b-xl">
                          <div className="font-medium leading-relaxed">
                            {evt.evaluationRationale || '【系统精算评判】：依据语义现实影响力及心理定式完成分值核定。'}
                          </div>
                          {evt.conservationForecast && (
                            <div className="text-[10px] text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200/60 leading-relaxed">
                              {evt.conservationForecast}
                            </div>
                          )}
                          <div className="text-[10px] text-zinc-400 font-mono flex items-center gap-3">
                            <span>蝴蝶扰动潜能：{evt.butterflyFactor || 1.5}x</span>
                            <span>天气函数加权：×{WEATHER_CONFIG[evt.weather].multiplier.toFixed(1)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
