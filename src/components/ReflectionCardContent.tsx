import React, { useState } from 'react';
import { 
  Sparkles, 
  Quote, 
  Lightbulb, 
  RefreshCw, 
  Compass, 
  Tag, 
  Check, 
  Heart,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import Markdown from 'react-markdown';
import { generateReflectionInsight } from '../services/geminiService';
import { ReflectionMeta } from './ReflectionFolderModal';

interface ReflectionCardContentProps {
  cardId: string;
  title: string;
  content: string;
  reflectionMeta?: ReflectionMeta;
  isEditing?: boolean;
  onUpdateMeta: (cardId: string, newMeta: ReflectionMeta) => void;
  onUpdateContent: (cardId: string, newContent: string) => void;
  onUpdateFolder?: (cardId: string, folder: string) => void;
}

export const ReflectionCardContent: React.FC<ReflectionCardContentProps> = ({
  cardId,
  title,
  content,
  reflectionMeta,
  isEditing,
  onUpdateMeta,
  onUpdateContent
}) => {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isExpandedExcerpt, setIsExpandedExcerpt] = useState(false);

  // If no meta exists yet, build a clean default
  const meta: ReflectionMeta = reflectionMeta || {
    originalText: content,
    summary: "记录了个人的反思与内心觉察。",
    insight: "【伴读小旁白见解】：在忙碌的世界中保留自省的习惯，是最宝贵的修行。步履不停，温和前行。",
    reminder: "接纳当下，步履不停；温和对待自己，坚定走向明天。",
    tags: ["自我觉察", "行胜于言"],
    dateAdded: new Date().toLocaleDateString('zh-CN')
  };

  const handleRegenerateVoiceover = async () => {
    setIsRegenerating(true);
    try {
      const result = await generateReflectionInsight(title, content);
      onUpdateMeta(cardId, {
        ...meta,
        summary: result.reflectionSummary,
        insight: result.personalInsight,
        reminder: result.coreReminder,
        tags: result.tags || meta.tags
      });
    } catch (err) {
      console.error("Regeneration failed", err);
    } finally {
      setIsRegenerating(false);
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-3 text-left">
        <div>
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
            原始自省 / 复盘记录
          </label>
          <textarea
            value={content}
            onChange={(e) => onUpdateContent(cardId, e.target.value)}
            className="w-full min-h-[90px] p-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-xs font-sans resize-y"
            placeholder="输入您的自省、随笔或复盘文本..."
          />
        </div>

        <div className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-600" />
              伴读小旁白设置
            </span>
            <button
              type="button"
              onClick={handleRegenerateVoiceover}
              disabled={isRegenerating}
              className="text-[10px] font-medium text-amber-700 hover:text-amber-900 flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-amber-200 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={11} className={isRegenerating ? "animate-spin" : ""} />
              {isRegenerating ? "重新推演中..." : "重新由 AI 萃取小旁白"}
            </button>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-zinc-500 block mb-1">
              📝 核心本质总结
            </label>
            <textarea
              value={meta.summary}
              onChange={(e) => onUpdateMeta(cardId, { ...meta, summary: e.target.value })}
              className="w-full min-h-[60px] p-2 bg-white border border-amber-200/70 rounded-lg text-xs resize-y"
              placeholder="对该自省背后的心理定势与核心痛点的提炼..."
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-zinc-500 block mb-1">
              💡 你的见解与前行建议
            </label>
            <textarea
              value={meta.insight}
              onChange={(e) => onUpdateMeta(cardId, { ...meta, insight: e.target.value })}
              className="w-full min-h-[80px] p-2 bg-white border border-amber-200/70 rounded-lg text-xs resize-y"
              placeholder="导师独到的见解与建议..."
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-zinc-500 block mb-1">
              🧭 铭记警言 / 箴言
            </label>
            <input
              type="text"
              value={meta.reminder}
              onChange={(e) => onUpdateMeta(cardId, { ...meta, reminder: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-white border border-amber-200/70 rounded-lg text-xs"
              placeholder="例如：先完成，再完美；只要迈出一小步，惯性就会站在你这一边。"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 not-prose text-left">
      {/* 1. Original Reflection Excerpt */}
      <div className="relative group/excerpt">
        <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400 mb-1">
          <span className="flex items-center gap-1">
            <Quote size={12} className="text-zinc-400" />
            自省记录原文
          </span>
          {meta.sourceFile && (
            <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[150px]">
              📄 {meta.sourceFile}
            </span>
          )}
        </div>

        <div className="bg-zinc-50/80 rounded-xl p-3 border-l-2 border-amber-500 border-zinc-200/60 text-xs text-zinc-600 leading-relaxed font-sans relative">
          <div className={!isExpandedExcerpt && content.length > 220 ? "line-clamp-3" : ""}>
            <Markdown>{content}</Markdown>
          </div>

          {content.length > 220 && (
            <button
              type="button"
              onClick={() => setIsExpandedExcerpt(!isExpandedExcerpt)}
              className="mt-1 text-[10px] font-medium text-amber-700 hover:text-amber-800 flex items-center gap-0.5 cursor-pointer"
            >
              {isExpandedExcerpt ? (
                <>
                  <span>收起全文</span>
                  <ChevronUp size={11} />
                </>
              ) : (
                <>
                  <span>展开完整原文 ({content.length} 字)</span>
                  <ChevronDown size={11} />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 2. Distinctive AI Voiceover Commentary Box (伴读小旁白: 总结与见解) */}
      <div className="bg-gradient-to-br from-amber-50/90 via-orange-50/50 to-stone-50/80 border border-amber-200/80 rounded-2xl p-4 shadow-2xs space-y-3 relative overflow-hidden group/voiceover">
        {/* Subtle decorative watermark/accent */}
        <div className="absolute top-2 right-2 text-amber-200/50 pointer-events-none font-mono text-3xl font-black select-none">
          ”
        </div>

        {/* Voiceover Header */}
        <div className="flex items-center justify-between border-b border-amber-200/50 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles size={11} />
            </div>
            <span className="text-xs font-bold text-amber-950 tracking-tight flex items-center gap-1">
              伴读小旁白
              <span className="text-[10px] font-normal text-amber-800/80">· 总结与见解</span>
            </span>
          </div>

          <button
            type="button"
            onClick={handleRegenerateVoiceover}
            disabled={isRegenerating}
            className="text-[10px] text-amber-700 hover:text-amber-900 flex items-center gap-1 opacity-70 group-hover/voiceover:opacity-100 transition-opacity cursor-pointer disabled:opacity-40"
            title="重新由 AI 萃取与见解润色"
          >
            <RefreshCw size={11} className={isRegenerating ? "animate-spin" : ""} />
            <span>{isRegenerating ? "更新中" : "重析"}</span>
          </button>
        </div>

        {/* Section 1: Summary */}
        <div className="space-y-1">
          <div className="text-[11px] font-bold text-amber-900/90 flex items-center gap-1">
            <span>📝</span>
            <span>核心本质总结</span>
          </div>
          <p className="text-xs text-zinc-700 leading-relaxed pl-1">
            {meta.summary}
          </p>
        </div>

        {/* Section 2: Personal Insight & Counsel */}
        <div className="space-y-1 pt-1 border-t border-amber-200/40">
          <div className="text-[11px] font-bold text-amber-900/90 flex items-center gap-1">
            <span>💡</span>
            <span>你的见解与前行建议</span>
          </div>
          <p className="text-xs text-zinc-700 leading-relaxed pl-1 whitespace-pre-wrap">
            {meta.insight}
          </p>
        </div>

        {/* Section 3: Core Reminder Banner */}
        {meta.reminder && (
          <div className="bg-white/80 backdrop-blur-xs rounded-xl p-2.5 border border-amber-200/70 shadow-2xs flex items-start gap-2">
            <Compass size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-950 font-medium leading-tight">
              <span className="font-bold text-amber-900 mr-1">铭记提醒：</span>
              {meta.reminder}
            </div>
          </div>
        )}

        {/* Footer: Tags & Date */}
        <div className="flex items-center justify-between pt-1 text-[10px] text-zinc-400">
          <div className="flex items-center flex-wrap gap-1">
            {meta.tags?.map((tag) => (
              <span 
                key={tag}
                className="bg-amber-100/70 text-amber-800 font-medium px-1.5 py-0.5 rounded-md"
              >
                #{tag.replace(/^#/, '')}
              </span>
            ))}
          </div>

          {meta.dateAdded && (
            <span className="font-mono">{meta.dateAdded}</span>
          )}
        </div>
      </div>
    </div>
  );
};
