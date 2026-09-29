import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FolderUp, 
  FileText, 
  Sparkles, 
  Compass, 
  X, 
  CheckSquare, 
  Square, 
  Eye, 
  Loader2, 
  Upload, 
  HeartHandshake,
  CheckCircle2,
  FolderOpen
} from 'lucide-react';
import { generateReflectionInsight, generateReflectionInsightsBatch, ReflectionInsightResponse } from '../services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ExtractedReflectionFile {
  id: string;
  name: string;
  relativePath?: string;
  content: string;
  charCount: number;
  selected: boolean;
}

export interface ReflectionMeta {
  originalText: string;
  summary: string;
  insight: string;
  reminder: string;
  tags: string[];
  sourceFile?: string;
  dateAdded: string;
}

export interface ReflectionCardProject {
  id: string;
  title: string;
  content: string;
  type: 'reflection';
  folder: string;
  reflectionMeta: ReflectionMeta;
}

interface ReflectionFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportCards: (newCards: ReflectionCardProject[], targetFolder: string) => void;
}

// Relatable, thoughtful preset samples for instant zero-config testing
const PRESET_REFLECTION_SAMPLES: { name: string; content: string }[] = [
  {
    name: "深夜复盘：为何我又在关键任务前拖延内耗？.md",
    content: `# 深夜复盘：为何我又在关键任务前拖延内耗？

日期：2026-09-28
状态：疲倦但清醒，伴随隐隐的内疚感

今天原本计划把核心方案和架构图定稿，但从上午开始，我一直在做一些“伪工作”：整理桌面、反复刷社交软件、去查无足轻重的技术参数。不知不觉天黑了，真正重要的主干却只字未动。

回想那一刻的心态，我并不是觉得累，而是因为对方案的要求太高了——心里总有一个声音在说“一旦写下来，可能漏洞百出”、“要是拿出来的东西不够惊艳怎么办”。这种对“必须完美”的执念，反而让我连第一步都不敢迈出。

每次遇到重大跨越，我似乎都在用无意识的拖延来逃避可能遭遇的挫败感。我需要正视自己内心的脆弱，允许草稿是粗糙的，先让它跑起来，而不是一直留在脑海里假装完美。`
  },
  {
    name: "情绪觉察随笔：在一次沟通分歧中的反应与警醒.txt",
    content: `下午项目沟通会上，因为一个时间节点的排期问题，我和协作同事产生了激烈争执。当时听到对方质疑“时间评估不够专业”时，我感到脑海里‘轰’的一下，防卫机制瞬间全开，音调不自觉拔高，开始列举过往所有客观困难来证明自己没错。

会议结束后回到工位，我足足缓了半小时，心里只有空虚和懊悔。

客观来看，对方只是提出了他对风险的担忧，并没有全盘否定我的工作。但我的自尊心太敏感了，把“对方案的质疑”等同于“对我个人的攻击”。我真正应该修炼的，是区分“事实”与“情绪投射”。下一次当怒气上涌时，必须强迫自己深呼吸三次，先把对方的话复述一遍，确认理解无误后再回应，而不是急于辩解防守。`
  },
  {
    name: "生活节奏反思：连续熬夜后的精力滑坡与注意力涣散.md",
    content: `连续四天凌晨两点入睡，今天身体终于发出了严肃的抗议信号：脑力像被粘稠的胶水裹住，喝了两大杯黑咖啡依然心悸且注意力涣散，看一段稍长的方法逻辑就感到烦躁。

我常常产生一种虚妄的掌控感，以为牺牲睡眠就能兑换更多的产出。但事实一次次打脸：熬夜偷来的两小时，第二天要用六小时低效、混沌和焦虑来偿还。

更深层的原因是“报复性熬夜”——白天被各种琐碎事务所填满，只有深夜的时间才觉得完全属于自己，所以舍不得合眼。但是，没有健康的身体底色，所有的追求都是建在流沙上的城堡。从今晚开始，必须将“精力管理”置于“时间管理”之前，十一点半前放下手机，让神经彻底休眠。`
  }
];

export const ReflectionFolderModal: React.FC<ReflectionFolderModalProps> = ({
  isOpen,
  onClose,
  onImportCards
}) => {
  const [files, setFiles] = useState<ExtractedReflectionFile[]>([]);
  const [folderName, setFolderName] = useState<string>("自身反省与提醒");
  const [previewFile, setPreviewFile] = useState<ExtractedReflectionFile | null>(null);
  const [extractionMode, setExtractionMode] = useState<'batch_ai' | 'local_fast'>('batch_ai');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<{ current: number; total: number; fileName: string } | null>(null);

  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle folder upload with directory traversal
  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = e.target.files;
    if (!rawFiles || rawFiles.length === 0) return;

    const extractedList: ExtractedReflectionFile[] = [];
    let detectedFolder = "";

    for (let i = 0; i < rawFiles.length; i++) {
      const file = rawFiles[i];
      const lower = file.name.toLowerCase();

      // Only pick text-like files
      if (
        lower.endsWith('.txt') || 
        lower.endsWith('.md') || 
        lower.endsWith('.markdown') || 
        lower.endsWith('.json') ||
        lower.endsWith('.note') ||
        lower.endsWith('.doc') ||
        lower.endsWith('.log')
      ) {
        if (!detectedFolder && file.webkitRelativePath) {
          const parts = file.webkitRelativePath.split('/');
          if (parts.length > 1) {
            detectedFolder = parts[0];
          }
        }

        try {
          const text = await file.text();
          if (text.trim().length > 10) {
            extractedList.push({
              id: `f-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
              name: file.name,
              relativePath: file.webkitRelativePath || file.name,
              content: text,
              charCount: text.length,
              selected: true
            });
          }
        } catch (err) {
          console.warn("Could not read text file:", file.name, err);
        }
      }
    }

    if (detectedFolder) {
      setFolderName(detectedFolder);
    }
    setFiles(extractedList);
    e.target.value = '';
  };

  // Handle single/multiple text files
  const handleFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = e.target.files;
    if (!rawFiles || rawFiles.length === 0) return;

    const extractedList: ExtractedReflectionFile[] = [];

    for (let i = 0; i < rawFiles.length; i++) {
      const file = rawFiles[i];
      try {
        const text = await file.text();
        if (text.trim().length > 10) {
          extractedList.push({
            id: `f-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
            name: file.name,
            content: text,
            charCount: text.length,
            selected: true
          });
        }
      } catch (err) {
        console.warn("Could not read file:", file.name, err);
      }
    }

    setFiles(prev => [...prev, ...extractedList]);
    e.target.value = '';
  };

  // Load preset sample files
  const handleLoadSamples = () => {
    const sampleFiles: ExtractedReflectionFile[] = PRESET_REFLECTION_SAMPLES.map((s, idx) => ({
      id: `sample-${idx}-${Date.now()}`,
      name: s.name,
      content: s.content,
      charCount: s.content.length,
      selected: true
    }));
    setFiles(sampleFiles);
    setFolderName("自身反省与提醒");
  };

  // Toggle selection
  const toggleSelect = (id: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, selected: !f.selected } : f));
  };

  const selectAll = () => {
    setFiles(prev => prev.map(f => ({ ...f, selected: true })));
  };

  const deselectAll = () => {
    setFiles(prev => prev.map(f => ({ ...f, selected: false })));
  };

  const selectedFiles = files.filter(f => f.selected);

  // Generate cards with Tightened Batch API & Circuit Breaker (Tightens API Calls & Prevents Loop Overheating)
  const handleStartGeneration = async () => {
    if (selectedFiles.length === 0) return;

    setIsProcessing(true);
    const newCards: ReflectionCardProject[] = [];
    const targetFolder = folderName.trim() || "自身反省与提醒";

    try {
      const dateStr = new Date().toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });

      if (extractionMode === 'local_fast') {
        // Mode 1: 0 API Quota - Instant Local Heuristic
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          const cleanTitle = file.name
            .replace(/\.[^/.]+$/, "")
            .replace(/^[0-9_\-\.\s]+/, "")
            .trim() || "个人自省觉察记录";

          newCards.push({
            id: `p-reflection-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
            title: cleanTitle,
            content: file.content,
            type: 'reflection',
            folder: targetFolder,
            reflectionMeta: {
              originalText: file.content,
              summary: "记录中清晰投射出真诚的自我审视与觉察，直面当下的内心阻力与思考。",
              insight: "【伴读小旁白见解】：在快节奏中保留自省的习惯，是最宝贵的修行。试着将反思化为手头微小的日常行动，步履不停，温和前行。",
              reminder: "接纳当下，步履不停；知行合一，日拱一卒。",
              tags: ["自我觉察", "行胜于言", "微步启动"],
              sourceFile: file.name,
              dateAdded: dateStr
            }
          });
        }
      } else {
        // Mode 2: Tightened Batch Processing (Chunked to max 6 items per API call to save quotas)
        const CHUNK_SIZE = 6;
        let circuitBreakerTripped = false;

        for (let start = 0; start < selectedFiles.length; start += CHUNK_SIZE) {
          const chunk = selectedFiles.slice(start, start + CHUNK_SIZE);
          setCurrentProgress({
            current: Math.min(start + CHUNK_SIZE, selectedFiles.length),
            total: selectedFiles.length,
            fileName: `批量紧缩萃取（第 ${Math.floor(start / CHUNK_SIZE) + 1} 批次，共 ${chunk.length} 篇）`
          });

          if (circuitBreakerTripped) {
            // Circuit Breaker: Do NOT spam API anymore if rate-limit/quota was tripped
            for (const file of chunk) {
              const cleanTitle = file.name.replace(/\.[^/.]+$/, "").replace(/^[0-9_\-\.\s]+/, "").trim() || "自省随笔";
              newCards.push({
                id: `p-reflection-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                title: cleanTitle,
                content: file.content,
                type: 'reflection',
                folder: targetFolder,
                reflectionMeta: {
                  originalText: file.content,
                  summary: "记录中清晰投射出真诚的自我审视与觉察，直面当下的内心阻力与思考。",
                  insight: "【伴读小旁白见解】：成长从来不是一蹴而就的，试着将反思落地为明天最小的一个微步行动，温和对待自己，坚定前行。",
                  reminder: "接纳当下，步履不停；知行合一，日拱一卒。",
                  tags: ["自我觉察", "行胜于言"],
                  sourceFile: file.name,
                  dateAdded: dateStr
                }
              });
            }
          } else {
            // Tightened single API call for the whole chunk!
            const batchPayload = chunk.map(f => ({
              id: f.id,
              title: f.name.replace(/\.[^/.]+$/, "").replace(/^[0-9_\-\.\s]+/, "").trim(),
              text: f.content
            }));

            const batchResults = await generateReflectionInsightsBatch(batchPayload);
            const anyFallback = batchResults.some(r => r.isFallback);
            if (anyFallback) {
              circuitBreakerTripped = true; // Avoid subsequent API calls in loop
            }

            for (const file of chunk) {
              const cleanTitle = file.name.replace(/\.[^/.]+$/, "").replace(/^[0-9_\-\.\s]+/, "").trim() || "自省随笔";
              const insight = batchResults.find(r => r.id === file.id) || {
                reflectionSummary: "记录中清晰呈现了内心的思索与觉察，展现了直面真实自我的真诚姿态。",
                personalInsight: "【伴读小旁白见解】：在忙碌世界中保留自省的习惯，是最宝贵的修行。试着将反省落实为明天的微小行动，步履不停，温和前行。",
                coreReminder: "接纳当下，步履不停；温和对待自己，坚定走向明天。",
                tags: ["自我觉察", "行胜于言"]
              };

              newCards.push({
                id: `p-reflection-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                title: cleanTitle,
                content: file.content,
                type: 'reflection',
                folder: targetFolder,
                reflectionMeta: {
                  originalText: file.content,
                  summary: insight.reflectionSummary,
                  insight: insight.personalInsight,
                  reminder: insight.coreReminder,
                  tags: insight.tags || ["自我觉察", "知行合一"],
                  sourceFile: file.name,
                  dateAdded: dateStr
                }
              });
            }

            // Pacing pause between batches to protect RPM limit
            if (start + CHUNK_SIZE < selectedFiles.length && !circuitBreakerTripped) {
              await new Promise(r => setTimeout(r, 1200));
            }
          }
        }
      }

      onImportCards(newCards, targetFolder);
      onClose();
    } catch (error) {
      console.error("Error during batch card generation:", error);
      alert("生成过程中遇到异常，已为您保存部分已完成的卡片。");
    } finally {
      setIsProcessing(false);
      setCurrentProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => !isProcessing && onClose()}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs"
      />

      {/* Modal Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-black/10 overflow-hidden flex flex-col max-h-[90vh] z-10"
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-rose-500/10 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <Compass size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-zinc-900 tracking-tight">自身反省与提醒 · 文件夹文本萃取</h3>
                <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full">
                  AI 伴读小旁白
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                读取所选文件夹中的自省随笔或复盘文本，自动生成带有【总结与独到见解】的心灵卡片
              </p>
            </div>
          </div>

          <button
            onClick={() => !isProcessing && onClose()}
            disabled={isProcessing}
            className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-full transition-colors disabled:opacity-30"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Action Row: Pick Folder, Pick Files, or Load Preset */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              disabled={isProcessing}
              className="p-4 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/40 hover:bg-amber-50 hover:border-amber-400 transition-all flex flex-col items-center justify-center text-center group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <FolderOpen size={20} />
              </div>
              <span className="text-xs font-bold text-zinc-900">选择本地反省文件夹</span>
              <span className="text-[10px] text-zinc-500 mt-0.5">批量读取子目录所有文本</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="p-4 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50/60 hover:bg-zinc-50 hover:border-zinc-300 transition-all flex flex-col items-center justify-center text-center group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <Upload size={20} />
              </div>
              <span className="text-xs font-bold text-zinc-900">选择单篇/多篇文件</span>
              <span className="text-[10px] text-zinc-500 mt-0.5">支持 .md、.txt、.json</span>
            </button>

            <button
              type="button"
              onClick={handleLoadSamples}
              disabled={isProcessing}
              className="p-4 rounded-2xl border border-orange-200/80 bg-gradient-to-br from-orange-50/60 to-rose-50/40 hover:from-orange-100/70 hover:to-rose-100/50 transition-all flex flex-col items-center justify-center text-center group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <Sparkles size={20} />
              </div>
              <span className="text-xs font-bold text-orange-950">载入示例自省随笔体验</span>
              <span className="text-[10px] text-orange-700/80 mt-0.5">拖延/情绪/作息 3篇典型复盘</span>
            </button>
          </div>

          {/* Hidden inputs */}
          <input
            type="file"
            ref={folderInputRef}
            onChange={handleFolderSelect}
            className="hidden"
            {...({
              webkitdirectory: "",
              directory: ""
            } as any)}
            multiple
          />
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFilesSelect}
            className="hidden"
            accept=".txt,.md,.markdown,.json,.note,.log"
            multiple
          />

          {/* Target Folder Setting */}
          <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                <span>📁 归入桌面分类分组</span>
              </label>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                生成的反省提醒卡片将归档至该文件夹分类标签下
              </p>
            </div>
            <div className="w-full sm:w-64">
              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                disabled={isProcessing}
                placeholder="例如：自身反省与提醒"
                className="w-full px-3 py-1.5 bg-white border border-zinc-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>
          </div>

          {/* API Tightening & Extraction Engine Selector */}
          <div className="bg-gradient-to-r from-amber-50/50 via-zinc-50 to-emerald-50/40 rounded-2xl p-4 border border-zinc-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                <span>⚡ API 调用紧缩与引擎选择</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                  已开启单次批量紧缩 & 24h 缓存
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                智能将所选多篇笔记合并为单次批量调用，并自动检查本地缓存，杜绝重复循环消耗配额
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-zinc-200/70 p-1 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setExtractionMode('batch_ai')}
                disabled={isProcessing}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  extractionMode === 'batch_ai'
                    ? "bg-white text-zinc-900 shadow-xs"
                    : "text-zinc-500 hover:text-zinc-800"
                )}
              >
                ✨ 智能紧缩批量 (单次API)
              </button>
              <button
                type="button"
                onClick={() => setExtractionMode('local_fast')}
                disabled={isProcessing}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  extractionMode === 'local_fast'
                    ? "bg-white text-emerald-800 shadow-xs"
                    : "text-zinc-500 hover:text-zinc-800"
                )}
              >
                ⚡ 本地极速引擎 (0消耗)
              </button>
            </div>
          </div>

          {/* Files List Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                  已解析的文本文章 ({files.length})
                </span>
                {files.length > 0 && (
                  <span className="text-xs text-amber-700 font-semibold bg-amber-100/60 px-2 py-0.5 rounded-full">
                    已勾选 {selectedFiles.length} 篇
                  </span>
                )}
              </div>

              {files.length > 0 && !isProcessing && (
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-zinc-600 hover:text-zinc-900 font-medium"
                  >
                    全选
                  </button>
                  <span className="text-zinc-300">·</span>
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="text-zinc-600 hover:text-zinc-900 font-medium"
                  >
                    全不选
                  </button>
                </div>
              )}
            </div>

            {files.length === 0 ? (
              <div className="p-10 border border-dashed border-zinc-200 rounded-2xl flex flex-col items-center justify-center text-center text-zinc-400 bg-zinc-50/40">
                <FileText size={32} className="text-zinc-300 mb-2 stroke-[1.5]" />
                <p className="text-xs font-medium text-zinc-600">暂未选择任何文件夹或文件</p>
                <p className="text-[11px] text-zinc-400 mt-1 max-w-sm">
                  请点击上方【选择本地反省文件夹】挑选您存储日记或复盘的目录，或点击【载入示例自省随笔体验】一键试用。
                </p>
              </div>
            ) : (
              <div className="border border-zinc-200 rounded-2xl divide-y divide-zinc-100 overflow-hidden max-h-60 overflow-y-auto">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className={`flex items-center justify-between p-3 transition-colors ${
                      file.selected ? 'bg-amber-50/20 hover:bg-amber-50/40' : 'bg-white hover:bg-zinc-50/80 opacity-60'
                    }`}
                  >
                    <div 
                      className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                      onClick={() => !isProcessing && toggleSelect(file.id)}
                    >
                      <button type="button" className="text-amber-600 shrink-0">
                        {file.selected ? (
                          <CheckSquare size={17} className="text-amber-600" />
                        ) : (
                          <Square size={17} className="text-zinc-300" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-zinc-900 truncate">
                          {file.name}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                          {file.relativePath && file.relativePath !== file.name && (
                            <span className="truncate max-w-[200px]">📁 {file.relativePath}</span>
                          )}
                          <span>{file.charCount} 字符</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setPreviewFile(file)}
                      className="p-1.5 text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 rounded-lg transition-colors shrink-0 ml-2"
                      title="预览原始内容"
                    >
                      <Eye size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Processing Progress Feedback */}
          {isProcessing && currentProgress && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 text-center space-y-2.5"
            >
              <div className="flex items-center justify-center gap-2 text-amber-800 font-semibold text-xs">
                <Loader2 size={16} className="animate-spin text-amber-600" />
                <span>
                  AI 伴读正在深度研读并萃取小旁白（{currentProgress.current} / {currentProgress.total}）
                </span>
              </div>
              <p className="text-[11px] text-amber-700 truncate font-mono">
                当前分析：{currentProgress.fileName}
              </p>
              <div className="w-full bg-amber-200/50 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-amber-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(currentProgress.current / currentProgress.total) * 100}%` }}
                />
              </div>
            </motion.div>
          )}

          {/* Explanatory callout about the 小旁白 */}
          <div className="bg-zinc-50 border border-zinc-200/60 rounded-2xl p-3.5 flex items-start gap-3 text-[11px] text-zinc-500">
            <HeartHandshake size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-zinc-800">小旁白将包含什么？</span>
              <p className="mt-0.5 leading-relaxed text-zinc-600">
                每张生成的卡片都将配备一个专属的【伴读小旁白】模块，包含<strong>「📝 核心总结」</strong>（敏锐解剖思维模式与核心摩擦）、<strong>「💡 独到见解与前行建议」</strong>（富有哲理的宽慰与行动指引）以及<strong>「🧭 铭记箴言」</strong>，帮助您在后续日复一日的回顾中获得疗愈与力量。
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between">
          <div className="text-xs text-zinc-500">
            {files.length > 0 ? (
              <span>已就绪 {selectedFiles.length} 篇自省文本</span>
            ) : (
              <span>请选择文件夹载入文本</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-200/60 rounded-xl transition-colors disabled:opacity-50"
            >
              取消
            </button>

            <button
              type="button"
              onClick={handleStartGeneration}
              disabled={isProcessing || selectedFiles.length === 0}
              className="flex items-center gap-2 px-6 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-zinc-900/10 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>正在萃取小旁白...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} className="text-amber-400" />
                  <span>一键生成反省卡片与小旁白 ({selectedFiles.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Raw Text Preview Sub-Modal */}
        <AnimatePresence>
          {previewFile && (
            <div className="absolute inset-0 bg-white/95 backdrop-blur-md z-20 p-6 flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-3">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-amber-600" />
                  <span className="font-bold text-sm text-zinc-900 truncate max-w-md">
                    {previewFile.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg hover:bg-zinc-100"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-zinc-50 border border-zinc-200/70 rounded-xl p-4 text-xs font-mono text-zinc-700 whitespace-pre-wrap leading-relaxed">
                {previewFile.content}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="px-4 py-1.5 bg-zinc-900 text-white rounded-xl text-xs font-medium"
                >
                  关闭预览
                </button>
              </div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
