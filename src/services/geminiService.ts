function logRequest(endpoint: "getChineseLunarInfo" | "generateProjectIdea" | "generateReflectionInsight" | "generateReflectionInsightsBatch", status: "success" | "quota_limit" | "error", details?: string) {
  try {
    const saved = localStorage.getItem("gemini_api_requests_log");
    const logs = saved ? JSON.parse(saved) : [];
    logs.unshift({
      id: Math.random().toString(36).substring(2, 9),
      endpoint,
      timestamp: new Date().toISOString(),
      status,
      details
    });
    localStorage.setItem("gemini_api_requests_log", JSON.stringify(logs.slice(0, 50)));
    window.dispatchEvent(new Event("gemini_api_log_updated"));
  } catch (e) {
    console.error("Failed to write to request log", e);
  }
}

export async function getChineseLunarInfo(date: string): Promise<string> {
  try {
    const response = await fetch(`/api/lunar-info?date=${encodeURIComponent(date)}`);
    if (!response.ok) {
      const errText = await response.text();
      let parsedError = "未知服务错误";
      try {
        const parsed = JSON.parse(errText);
        parsedError = parsed.error || errText;
      } catch {
        parsedError = errText || `HTTP ${response.status}`;
      }
      throw new Error(parsedError);
    }
    const data = await response.json();
    if (data.isFallback) {
      logRequest("getChineseLunarInfo", "quota_limit", "提示：共享 Gemini 官方 API 配额已超限，系统已无缝热切换至 ｢本地高性能黄历引擎｣！\n触发原因: " + (data.errorContext || "RESOURCE_EXHAUSTED"));
    } else {
      logRequest("getChineseLunarInfo", "success");
    }
    const finalResult = data.result;
    return finalResult;
  } catch (error: any) {
    console.error("Error fetching lunar info client-side:", error);
    const errorMsg = error?.message || error?.toString() || "未知错误";
    const isQuota = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("Quota") || errorMsg.includes("LimitExceeded") || errorMsg.includes("RESOURCE_EXHAUSTED");
    
    logRequest("getChineseLunarInfo", isQuota ? "quota_limit" : "error", errorMsg);
    
    if (isQuota) {
      return "提示：AI 接口请求过快或配额已超限，请稍后再试（点击刷新重试）。";
    }
    return "获取黄历信息时出错，请点击刷新重试：\n" + errorMsg;
  }
}

export async function generateProjectIdea(existingProjects: string[]): Promise<string> {
  try {
    const response = await fetch("/api/project-idea", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ existingProjects })
    });
    if (!response.ok) {
      const errText = await response.text();
      let parsedError = "未知服务错误";
      try {
        const parsed = JSON.parse(errText);
        parsedError = parsed.error || errText;
      } catch {
        parsedError = errText || `HTTP ${response.status}`;
      }
      throw new Error(parsedError);
    }
    const data = await response.json();
    if (data.isFallback) {
      logRequest("generateProjectIdea", "quota_limit", "提示：共享 Gemini 官方 API 配额已超限，系统已无缝热切换至 ｢本地开源灵感库｣！\n触发原因: " + (data.errorContext || "RESOURCE_EXHAUSTED"));
    } else {
      logRequest("generateProjectIdea", "success");
    }
    return JSON.stringify(data);
  } catch (error: any) {
    console.error("Error generating project idea client-side:", error);
    const errorMsg = error?.message || error?.toString() || "未知错误";
    const isQuota = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("Quota") || errorMsg.includes("LimitExceeded") || errorMsg.includes("RESOURCE_EXHAUSTED");
    
    logRequest("generateProjectIdea", isQuota ? "quota_limit" : "error", errorMsg);
    
    if (isQuota) {
      return JSON.stringify({ 
        projectName: "配额超限", 
        description: "请求过快或配额限流已触发，请稍后重试。详情: " + errorMsg, 
        githubUrl: "https://github.com/trending" 
      });
    }
    return JSON.stringify({ 
      projectName: "调用失败", 
      description: "无法生成新项目建议，请重试。详情: " + errorMsg, 
      githubUrl: "https://github.com/trending" 
    });
  }
}

export interface ReflectionInsightResponse {
  reflectionSummary: string;
  personalInsight: string;
  coreReminder: string;
  tags: string[];
  isFallback?: boolean;
}

export async function generateReflectionInsight(title: string, text: string): Promise<ReflectionInsightResponse> {
  try {
    const response = await fetch("/api/reflection-insight", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ title, text })
    });

    if (!response.ok) {
      const errText = await response.text();
      let parsedError = "服务请求失败";
      try {
        const parsed = JSON.parse(errText);
        parsedError = parsed.error || errText;
      } catch {
        parsedError = errText || `HTTP ${response.status}`;
      }
      throw new Error(parsedError);
    }

    const data: ReflectionInsightResponse = await response.json();
    if (data.isFallback) {
      logRequest("generateReflectionInsight", "quota_limit", "提示：共享 Gemini 官方 API 配额超限，已无缝切换至 ｢本地反省洞察引擎｣！");
    } else {
      logRequest("generateReflectionInsight", "success");
    }
    return data;
  } catch (error: any) {
    console.error("Error generating reflection insight client-side:", error);
    const errorMsg = error?.message || error?.toString() || "未知错误";
    const isQuota = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("Quota") || errorMsg.includes("LimitExceeded") || errorMsg.includes("RESOURCE_EXHAUSTED");
    
    logRequest("generateReflectionInsight", isQuota ? "quota_limit" : "error", errorMsg);
    
    // Graceful client fallback
    return {
      reflectionSummary: "这是一次可贵的内心对话。无论经历了怎样的波折与不顺，只要愿意慢下来直视真相，就已经迈出了关键的一步。",
      personalInsight: "【伴读小旁白见解】：很多时候我们过于焦虑结果，反而消耗了当下的心力。试着卸下过多的自我防备，将目光放在今天这几个小时里自己能做好的微小行动上。生活不在别处，就在这一刻的坦然与笃定中。",
      coreReminder: "接纳当下，步履不停；温和地对待自己，坚定地走向明天。",
      tags: ["温和自律", "聚焦当下", "心灵复苏"],
      isFallback: true
    };
  }
}

export async function generateReflectionInsightsBatch(
  items: Array<{ id: string; title: string; text: string }>
): Promise<Array<ReflectionInsightResponse & { id: string }>> {
  if (!items || items.length === 0) return [];

  try {
    const response = await fetch("/api/reflection-insights-batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ items })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || `HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.isFallback) {
      logRequest("generateReflectionInsightsBatch", "quota_limit", `提示：共享 Gemini 官方 API 配额超限，批量任务（${items.length} 篇）已自动热切换至 ｢本地反省洞察引擎｣！`);
    } else {
      logRequest("generateReflectionInsightsBatch", "success");
    }

    return data.results || [];
  } catch (error: any) {
    console.error("Batch reflection generation error:", error);
    const errorMsg = error?.message || error?.toString() || "未知错误";
    const isQuota = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("Quota") || errorMsg.includes("LimitExceeded") || errorMsg.includes("RESOURCE_EXHAUSTED");
    
    logRequest("generateReflectionInsightsBatch", isQuota ? "quota_limit" : "error", errorMsg);

    // High quality offline fallback mapping
    return items.map(item => ({
      id: item.id,
      reflectionSummary: "记录中清晰呈现了内心的思索与觉察，展现了直面真实自我的真诚姿态。",
      personalInsight: "【伴读小旁白见解】：成长从来不是一蹴而就的，试着将反思落地为明天最小的一个微步行动，温和对待自己，坚定前行。",
      coreReminder: "接纳当下，步履不停；知行合一，日拱一卒。",
      tags: ["自我觉察", "行胜于言", "微步启动"],
      isFallback: true
    }));
  }
}

export interface FortuneEventEvaluationResult {
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
  isFallback: boolean;
  isCached: boolean;
}

export async function evaluateFortuneEvent(
  eventText: string,
  weather: string,
  currentBalance: number,
  streakDays: number = 0,
  isInterruption: boolean = false
): Promise<FortuneEventEvaluationResult> {
  try {
    const response = await fetch("/api/evaluate-fortune-event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        eventText,
        weather,
        currentBalance,
        streakDays,
        isInterruption
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || `HTTP ${response.status}`);
    }

    const data: FortuneEventEvaluationResult = await response.json();
    return data;
  } catch (error: any) {
    console.warn("Client fallback for event evaluation:", error);
    // Safe client deterministic evaluation
    const isNeg = isInterruption || /堵车|迟到|批评|挨骂|生病|损坏|摔|倒霉|扣钱|吵架|烦|郁闷|湿透|失误|中断|破戒|摆烂/.test(eventText);
    const abs = /极|非常|严重|大/.test(eventText) ? 35 : 20;
    // Weather multiplier: sunny +1.2x, cloudy +1.6x, rainy -1.6x, storm -2.0x
    let weatherMult = 1.0;
    let weatherBonus = 0;
    if (weather === 'sunny') {
      weatherMult = !isNeg ? 1.2 : 1.0;
      if (!isNeg) weatherBonus = Math.round(abs * 0.2);
    } else if (weather === 'cloudy') {
      weatherMult = !isNeg ? 1.6 : 1.0;
      if (!isNeg) weatherBonus = Math.round(abs * 0.6);
    } else if (weather === 'rainy') {
      weatherMult = isNeg ? 1.6 : 0.85;
    } else if (weather === 'storm') {
      weatherMult = isNeg ? 2.0 : 0.70;
    }
    
    // Streak compounding & interruption penalty
    const streakMult = (!isNeg && streakDays > 0) ? (1.0 + Math.min(1.8, streakDays * 0.08)) : 1.0;
    const breakMult = (isNeg && (isInterruption || streakDays > 0)) ? (1.0 + Math.min(2.2, Math.max(1, streakDays) * 0.12)) : 1.0;

    const finalScore = isNeg 
      ? -Math.min(75, Math.round(abs * weatherMult * breakMult))
      : Math.min(75, Math.round(abs * weatherMult * streakMult));

    let rationale = isNeg 
      ? `【精算评判】：依据语义深度测算，判定为现实阻碍事件（基础 ${-abs} 分）${weather === 'rainy' ? '，雨天阴盛阻力放大至 1.6 倍' : weather === 'storm' ? '，暴雨阻力放大至 2.0 倍' : ''}。`
      : `【精算评判】：依据语义深度测算，判定为舒畅积极事件（基础 +${abs} 分）。`;

    if (!isNeg && weather === 'sunny') {
      rationale += ` ☀️【晴朗正向加权】：适逢晴日朗照，函数加权赋予 1.2 倍正向吉运放大（加成额外 +${weatherBonus} 分）。`;
    } else if (!isNeg && weather === 'cloudy') {
      rationale += ` ⛅【多云正向强加权】：云开雾散见晴明，函数加权赋予 1.6 倍正向吉势高倍放大（加成额外 +${weatherBonus} 分）。`;
    }

    if (!isNeg && streakDays > 0) {
      rationale += ` 🔥【正向坚持复利】：已连续坚持 ${streakDays} 天，习惯势能爆发加成 ×${streakMult.toFixed(2)} 倍，核定 +${finalScore} 分！`;
    } else if (isNeg && (isInterruption || streakDays > 0)) {
      rationale += ` 🚨【坚持中断重挫严惩】：中断了连续坚持 ${streakDays} 天的正向行动，沉没势能反噬重罚 ×${breakMult.toFixed(2)} 倍，严厉核定 ${finalScore} 分！`;
    }

    return {
      valence: isNeg ? 'inauspicious' : 'auspicious',
      rawScore: isNeg ? -abs : abs,
      finalScore,
      magnitude: isNeg ? (Math.abs(finalScore) >= 35 ? '大凶' : '中凶') : (finalScore >= 35 ? '大吉' : '中吉'),
      intensity: Math.abs(finalScore) >= 35 ? 5 : 3,
      butterflyFactor: isInterruption ? 2.1 : 1.5,
      weatherDrag: (weather === 'rainy' && isNeg) ? Math.round(abs * 0.6) : (weather === 'storm' && isNeg) ? Math.round(abs * 1.0) : 0,
      weatherBonus,
      evaluationRationale: rationale,
      conservationForecast: isNeg 
        ? "守恒推演：逆境负熵已随此事件释放，后续吉相回弹概率提升。" 
        : "守恒状态：吉运累积中，建议守正平稳，戒躁戒骄。",
      isFallback: true,
      isCached: false
    };
  }
}



