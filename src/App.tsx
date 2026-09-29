/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  RefreshCw, 
  User, 
  Layout, 
  Sparkles,
  ChevronRight,
  Download,
  Upload,
  Check,
  GripHorizontal,
  FolderUp,
  Compass,
  Timer,
  AlertCircle,
  HardDriveDownload,
  Github,
  CloudUpload
} from 'lucide-react';
import Markdown from 'react-markdown';
import { QuantitativeFortuneEngine } from './components/QuantitativeFortuneEngine';
import { ReflectionFolderModal, ReflectionCardProject, ReflectionMeta } from './components/ReflectionFolderModal';
import { ReflectionCardContent } from './components/ReflectionCardContent';
import { GitHubUploadModal } from './components/GitHubUploadModal';
import { getChineseLunarInfo, generateProjectIdea } from './services/geminiService';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Project {
  id: string;
  title: string;
  content: string;
  type: 'lunar' | 'custom' | 'placeholder' | 'whiteboard' | 'reflection';
  isLoading?: boolean;
  isEditing?: boolean;
  githubUrl?: string;
  folder?: string;
  reflectionMeta?: ReflectionMeta;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  bio: string;
  avatarUrl: string;
}

function getGithubUrlByTitleAndContent(title: string, content: string): string {
  const text = (title + ' ' + content).toLowerCase();
  if (text.includes('excalidraw') || text.includes('白板') || text.includes('画板') || text.includes('绘图') || text.includes('whiteboard')) {
    return 'https://github.com/excalidraw/excalidraw';
  }
  if (text.includes('tldraw')) {
    return 'https://github.com/tldraw/tldraw';
  }
  if (text.includes('d3') || text.includes('图表') || text.includes('可视化') || text.includes('chart') || text.includes('visualization')) {
    return 'https://github.com/d3/d3';
  }
  if (text.includes('游戏') || text.includes('game') || text.includes('phaser')) {
    return 'https://github.com/phaserjs/phaser';
  }
  if (text.includes('chatgpt') || text.includes('gpt') || text.includes('ai') || text.includes('llm') || text.includes('对话') || text.includes('机器人')) {
    return 'https://github.com/ChatGPTNextWeb/ChatGPT-Next-Web';
  }
  if (text.includes('notion') || text.includes('笔记') || text.includes('文档') || text.includes('appflowy')) {
    return 'https://github.com/AppFlowy-IO/AppFlowy';
  }
  if (text.includes('工具') || text.includes('cyberchef') || text.includes('套件') || text.includes('it-tools') || text.includes('ittools')) {
    return 'https://github.com/CorentinTh/it-tools';
  }
  if (text.includes('localsend') || text.includes('局域网') || text.includes('传输') || text.includes('文件共享')) {
    return 'https://github.com/localsend/localsend';
  }
  if (text.includes('mermaid') || text.includes('流程图') || text.includes('拓扑图')) {
    return 'https://github.com/mermaid-js/mermaid';
  }
  if (text.includes('nocodb') || text.includes('表格') || text.includes('数据库') || text.includes('lowcode')) {
    return 'https://github.com/nocodb/nocodb';
  }
  return 'https://github.com/trending';
}

function SortableProjectCard({ 
  project, 
  updateProjectTitle, 
  updateProjectContent, 
  updateProjectReflectionMeta,
  updateProjectGithubUrl,
  updateProjectFolder,
  removeProject, 
  fetchLunarData, 
  addNewProject, 
  toggleEdit 
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    position: 'relative' as const,
  };

  const handleBlur = (e: React.FocusEvent<any>) => {
    const card = e.currentTarget.closest('.group');
    if (card && card.contains(e.relatedTarget as Node)) {
      return;
    }
    toggleEdit(project.id);
  };

  const isLunar = project.type === 'lunar';

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(
        isDragging ? "opacity-50" : "h-full",
        isLunar ? "col-span-1 md:col-span-2 lg:col-span-3" : "col-span-1"
      )}
    >
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="group bg-white rounded-2xl border border-black/5 p-6 shadow-sm hover:shadow-md transition-all flex flex-col h-full relative"
      >
        {/* Drag Handle */}
        <div 
          {...attributes} 
          {...listeners} 
          className="absolute top-2 left-1/2 -translate-x-1/2 p-1 text-zinc-300 hover:text-zinc-500 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripHorizontal size={20} />
        </div>

        <div className="flex items-start justify-between mb-4 mt-2">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={cn(
              "p-2 rounded-lg shrink-0",
              project.type === 'lunar' ? "bg-orange-50 text-orange-600" : 
              project.type === 'placeholder' ? "bg-zinc-100 text-zinc-600" : 
              project.type === 'whiteboard' ? "bg-blue-50 text-blue-600" :
              project.type === 'reflection' ? "bg-amber-100 text-amber-800 shadow-2xs" :
              "bg-emerald-50 text-emerald-600"
            )}>
              {project.type === 'lunar' ? <Calendar size={18} /> : 
               project.type === 'placeholder' ? <Sparkles size={18} /> : 
               project.type === 'whiteboard' ? <Layout size={18} /> :
               project.type === 'reflection' ? <Compass size={18} /> :
               <ChevronRight size={18} />}
            </div>
            <div className="flex-1 min-w-0">
              {project.isEditing ? (
                <textarea
                  autoFocus
                  value={project.title}
                  onChange={(e) => updateProjectTitle(project.id, e.target.value)}
                  onBlur={handleBlur}
                  className="font-semibold text-lg tracking-tight bg-zinc-50 border-b border-zinc-200 focus:outline-none focus:border-black transition-all w-full px-1 resize-y min-h-[32px] leading-tight py-0.5"
                  placeholder="项目标题"
                  rows={1}
                />
              ) : (
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-lg tracking-tight break-words leading-tight py-0.5">{project.title}</h3>
                    {isLunar && (
                      <span className="text-[10px] bg-orange-100/80 text-orange-800 font-semibold px-2 py-0.5 rounded-full border border-orange-200/50">
                        通栏宽幅 (占用三列)
                      </span>
                    )}
                  </div>
                  {project.folder && (
                    <span className="inline-flex items-center gap-1 mt-1 bg-zinc-50 border border-zinc-100 text-[10px] text-zinc-400 px-2 py-0.5 rounded font-mono">
                      📁 {project.folder}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-4">
            {project.type === 'lunar' && !project.isEditing && (
              <button 
                onClick={() => fetchLunarData(project.id)}
                className="p-2 hover:bg-zinc-100 rounded-lg transition-colors text-zinc-500"
                title="刷新数据"
              >
                <RefreshCw size={16} className={project.isLoading ? "animate-spin" : ""} />
              </button>
            )}
            {project.type !== 'placeholder' && (
              <button 
                onClick={() => toggleEdit(project.id)}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  project.isEditing ? "bg-emerald-500 text-white" : "hover:bg-zinc-100 text-zinc-500"
                )}
                title={project.isEditing ? "保存" : "编辑"}
              >
                {project.isEditing ? <Check size={16} /> : <Plus size={16} className="rotate-45" />}
              </button>
            )}
            <button 
              onClick={() => removeProject(project.id)}
              className="p-2 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors text-zinc-400"
              title="删除项目"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {project.type === 'lunar' && !project.isEditing && (
          <div className="not-prose mb-2 shrink-0">
            <QuantitativeFortuneEngine 
              onSelectDay={(stat) => {
                fetchLunarData(project.id, stat.fullDateStr);
              }}
            />
          </div>
        )}

        {project.type === 'reflection' ? (
          <div className="flex-grow overflow-auto">
            <ReflectionCardContent
              cardId={project.id}
              title={project.title}
              content={project.content}
              reflectionMeta={project.reflectionMeta}
              isEditing={project.isEditing}
              onUpdateMeta={updateProjectReflectionMeta}
              onUpdateContent={updateProjectContent}
              onUpdateFolder={updateProjectFolder}
            />
            {project.isEditing && (
              <div className="pt-3 mt-3 border-t border-zinc-100 text-left">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                  文件夹 / 分组
                </span>
                <input
                  type="text"
                  value={project.folder || ''}
                  onChange={(e) => updateProjectFolder(project.id, e.target.value)}
                  onBlur={handleBlur}
                  className="w-full px-3 py-1.5 bg-zinc-50 border border-zinc-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-xs"
                  placeholder="输入或选择分组"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex-grow overflow-auto prose prose-sm prose-zinc max-w-none">
            {project.isLoading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-4 bg-zinc-100 rounded w-3/4"></div>
                <div className="h-4 bg-zinc-100 rounded w-full"></div>
                <div className="h-4 bg-zinc-100 rounded w-5/6"></div>
              </div>
            ) : project.isEditing ? (
              <div className="space-y-3 h-full flex flex-col">
                <textarea
                  autoFocus
                  value={project.content}
                  onChange={(e) => updateProjectContent(project.id, e.target.value)}
                  onBlur={handleBlur}
                  className="w-full min-h-[120px] p-4 bg-zinc-50 border border-zinc-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-sm resize-none font-sans flex-grow"
                />
                <div className="pt-2 border-t border-zinc-100 grid grid-cols-2 gap-3 text-left">
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">文件夹 / 分组</span>
                    <input
                      type="text"
                      value={project.folder || ''}
                      onChange={(e) => updateProjectFolder(project.id, e.target.value)}
                      onBlur={handleBlur}
                      className="w-full px-3 py-1.5 bg-zinc-50 border border-zinc-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-xs"
                      placeholder="输入或选择分组"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1">GitHub 仓库 (选填)</span>
                    <input
                      type="text"
                      value={project.githubUrl || ''}
                      onChange={(e) => updateProjectGithubUrl(project.id, e.target.value)}
                      onBlur={handleBlur}
                      className="w-full px-3 py-1.5 bg-zinc-50 border border-zinc-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 transition-all text-xs font-mono"
                      placeholder="https://github.com/..."
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-zinc-600 leading-relaxed">
                <Markdown>{project.content}</Markdown>
              </div>
            )}
          </div>
        )}

        {project.githubUrl && !project.isEditing && (
          <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between text-xs">
            <span className="text-zinc-400 font-medium">灵感来源库</span>
            <a 
              href={project.githubUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-bold text-emerald-600 hover:text-emerald-700 transition-colors uppercase tracking-wider cursor-pointer"
            >
              <svg className="w-4 h-4 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-.134-3.593-.76-.127-.324-.676-1.113-1.152-1.378-.392-.213-.949-.726-.02-.74.887-.013 1.52.817 1.73 1.153 1.012 1.7 2.628 1.21 3.27.925.101-.733.395-1.21.72-1.486-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.395.1 2.648.64.699 1.028 1.581 1.028 2.68 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.479C19.138 20.162 22 16.415 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
              参考仓库 ↗
            </a>
          </div>
        )}

        {project.type === 'placeholder' && (
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button 
              onClick={() => {
                removeProject(project.id);
                addNewProject('gemini');
              }}
              className="py-2.5 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles size={12} />
              AI 灵感
            </button>
            <button 
              onClick={() => {
                removeProject(project.id);
                addNewProject('whiteboard');
              }}
              className="py-2.5 bg-blue-50 text-blue-700 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
            >
              <Layout size={12} />
              白板
            </button>
          </div>
        )}

        {project.type === 'lunar' && !project.isLoading && project.content.includes('点击刷新') && (
          <button 
            onClick={() => fetchLunarData(project.id)}
            className="mt-6 w-full py-2.5 bg-orange-50 text-orange-700 rounded-xl text-sm font-medium hover:bg-orange-100 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw size={14} />
            获取今日黄历
          </button>
        )}
      </motion.div>
    </div>
  );
}

export default function App() {
  const [time, setTime] = useState(new Date());
  const [profile, setProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('lunar_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            id: parsed.id || `USER-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
            name: parsed.name || '访客用户',
            email: parsed.email || 'guest@example.com',
            bio: parsed.bio || '这是一个热爱探索的数字游民。',
            avatarUrl: parsed.avatarUrl || 'https://picsum.photos/seed/user/200/200'
          };
        }
      }
    } catch (e) {
      console.error("Failed to parse avatar/profile", e);
    }
    return {
      id: `USER-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      name: '访客用户',
      email: 'guest@example.com',
      bio: '这是一个热爱探索的数字游民。',
      avatarUrl: 'https://picsum.photos/seed/user/200/200'
    };
  });
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [tempProfile, setTempProfile] = useState<UserProfile>(profile);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const importInputRef = React.useRef<HTMLInputElement>(null);
  const importFolderInputRef = React.useRef<HTMLInputElement>(null);

  const [pendingImportData, setPendingImportData] = useState<{ projects: Project[], profile?: UserProfile } | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'overwrite'>('append');
  const [importTargetFolder, setImportTargetFolder] = useState<string>('');
  const [selectedFolder, setSelectedFolder] = useState<string>('全部');

  const [requestLogs, setRequestLogs] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('gemini_api_requests_log');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      }
      return [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const handleLogUpdate = () => {
      try {
        const saved = localStorage.getItem('gemini_api_requests_log');
        if (saved) {
          const parsed = JSON.parse(saved);
          setRequestLogs(Array.isArray(parsed) ? parsed : []);
        } else {
          setRequestLogs([]);
        }
      } catch (e) {
        console.error(e);
      }
    };
    window.addEventListener('gemini_api_log_updated', handleLogUpdate);
    return () => window.removeEventListener('gemini_api_log_updated', handleLogUpdate);
  }, []);

  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem('lunar_projects');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((p: any) => {
            if (p && typeof p === 'object') {
              if (p.type === 'custom' && !p.githubUrl) {
                return {
                  ...p,
                  githubUrl: getGithubUrlByTitleAndContent(p.title || '', p.content || '')
                };
              }
              return p;
            }
            return null;
          }).filter(Boolean) as Project[];
        }
      }
    } catch (e) {
      console.error("Migration/parsing error:", e);
    }
    return [
      {
        id: 'p1',
        title: '中国黄历每日信息',
        content: '点击刷新获取今日黄历...',
        type: 'lunar',
      },
      {
        id: 'p2',
        title: '暂留项目',
        content: '这是一个预留的项目位，您可以点击下方的添加按钮来生成新的灵感。',
        type: 'placeholder',
      }
    ];
  });
  const [isAdding, setIsAdding] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [isReflectionModalOpen, setIsReflectionModalOpen] = useState(false);
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState<string>('');

  // 7-Day Backup Monitor Timer State
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const [lastExportTime, setLastExportTime] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('last_data_export_time');
      if (saved) {
        const val = parseInt(saved, 10);
        return isNaN(val) ? null : val;
      }
    } catch (e) {
      console.warn(e);
    }
    // Default to 8 days ago so user sees the 7-day reminder until they export
    return Date.now() - (8 * 24 * 60 * 60 * 1000);
  });
  const [isCornerTimerOpen, setIsCornerTimerOpen] = useState(false);
  const [backupTicker, setBackupTicker] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setBackupTicker(Date.now());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const isBackupOverdue = React.useMemo(() => {
    if (!lastExportTime) return true;
    return (backupTicker - lastExportTime) >= SEVEN_DAYS_MS;
  }, [lastExportTime, backupTicker, SEVEN_DAYS_MS]);

  const backupStats = React.useMemo(() => {
    if (!lastExportTime) {
      return {
        days: 8,
        hours: 0,
        daysRemaining: 0,
        formattedLastTime: '尚未进行过手动导出备份',
        isOverdue: true
      };
    }
    const elapsed = Math.max(0, backupTicker - lastExportTime);
    const days = Math.floor(elapsed / (24 * 3600 * 1000));
    const hours = Math.floor((elapsed % (24 * 3600 * 1000)) / (3600 * 1000));
    const remainingMs = SEVEN_DAYS_MS - elapsed;
    const daysRemaining = Math.max(0, Math.ceil(remainingMs / (24 * 3600 * 1000)));

    return {
      days,
      hours,
      daysRemaining,
      formattedLastTime: new Date(lastExportTime).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }),
      isOverdue: elapsed >= SEVEN_DAYS_MS
    };
  }, [lastExportTime, backupTicker, SEVEN_DAYS_MS]);

  useEffect(() => {
    localStorage.setItem('lunar_profile', JSON.stringify(profile));
    setLastSaved(new Date().toLocaleTimeString());
  }, [profile]);

  useEffect(() => {
    localStorage.setItem('lunar_projects', JSON.stringify(projects));
    setLastSaved(new Date().toLocaleTimeString());
  }, [projects]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchLunarData = async (id: string, customDateStr?: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, isLoading: true } : p));
    const now = new Date();
    const defaultDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const dateStr = customDateStr || defaultDateStr;
    const info = await getChineseLunarInfo(dateStr);
    setProjects(prev => prev.map(p => p.id === id ? { ...p, content: info, isLoading: false } : p));
  };

  const addNewProject = async (type: 'gemini' | 'whiteboard') => {
    setIsAdding(true);
    setShowAddMenu(false);
    
    if (type === 'gemini') {
      const existingTitles = projects.map(p => p.title);
      const ideaJson = await generateProjectIdea(existingTitles);
      
      let title = '新互动项目';
      let content = ideaJson;
      let githubUrl = '';
      try {
        const parsed = JSON.parse(ideaJson);
        title = parsed.projectName || title;
        content = parsed.description || content;
        githubUrl = parsed.githubUrl || '';
      } catch (e) {
        title = ideaJson.split('\n')[0].replace(/^[#\s*]+/, '') || title;
      }

      const newProject: Project = {
        id: `p-${Date.now()}`,
        title: title,
        content: content,
        type: 'custom',
        githubUrl: githubUrl,
      };
      setProjects(prev => [...prev, newProject]);
    } else {
      const newProject: Project = {
        id: `p-${Date.now()}`,
        title: '新白板项目',
        content: '在这里输入您的想法...',
        type: 'whiteboard',
        isEditing: true
      };
      setProjects(prev => [...prev, newProject]);
    }
    
    setIsAdding(false);
  };

  const updateProjectContent = (id: string, newContent: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, content: newContent } : p));
  };

  const updateProjectTitle = (id: string, newTitle: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, title: newTitle } : p));
  };

  const updateProjectGithubUrl = (id: string, newUrl: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, githubUrl: newUrl } : p));
  };

  const updateProjectFolder = (id: string, newFolder: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, folder: newFolder } : p));
  };

  const updateProjectReflectionMeta = (id: string, meta: ReflectionMeta) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, reflectionMeta: meta } : p));
  };

  const toggleEdit = (id: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, isEditing: !p.isEditing } : p));
  };

  const removeProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempProfile({ ...tempProfile, avatarUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const exportData = () => {
    const data = {
      profile,
      projects,
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lunar_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    // Record export time to reset 7-day monitor
    const now = Date.now();
    setLastExportTime(now);
    localStorage.setItem('last_data_export_time', now.toString());
  };

  const simulateOverdue = () => {
    const eightDaysAgo = Date.now() - (8 * 24 * 60 * 60 * 1000);
    setLastExportTime(eightDaysAgo);
    localStorage.setItem('last_data_export_time', eightDaysAgo.toString());
  };

  const simulateJustExported = () => {
    const now = Date.now();
    setLastExportTime(now);
    localStorage.setItem('last_data_export_time', now.toString());
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed && typeof parsed === 'object') {
            const parsedProjects = Array.isArray(parsed.projects) ? parsed.projects : [];
            const parsedProfile = parsed.profile || undefined;
            if (parsedProjects.length > 0 || parsedProfile) {
              setPendingImportData({
                projects: parsedProjects,
                profile: parsedProfile
              });
              setImportTargetFolder(`备份导入_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}`);
              setImportMode('append');
            } else {
              alert('该备份文件无可识别的数据！');
            }
          } else {
            alert('无效的备份文件结构！导致无法导入项目！');
          }
        } catch (err) {
          alert('解析备份文件时出错，请确认是有效的 JSON 备份！');
          console.error(err);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    }
  };

  const importFolderData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let importedProjects: Project[] = [];
    let importedProfile: UserProfile | undefined = undefined;
    let mainFolderName = "";

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.name.toLowerCase();
      
      if (!mainFolderName && file.webkitRelativePath) {
        mainFolderName = file.webkitRelativePath.split('/')[0];
      }

      if (fileName.endsWith('.json')) {
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed.projects)) {
              importedProjects.push(...parsed.projects);
            } else if (parsed.id && parsed.title) {
              importedProjects.push(parsed);
            }
            if (parsed.profile) {
              importedProfile = parsed.profile;
            }
          }
        } catch (err) {
          console.warn("Skip JSON file due to parse error:", file.name, err);
        }
      } else if (fileName.endsWith('.md')) {
        try {
          const text = await file.text();
          importedProjects.push({
            id: `p-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            title: file.name.replace(/\.[^/.]+$/, ""),
            content: text,
            type: 'custom',
            folder: mainFolderName || '导入文件夹'
          });
        } catch (err) {
          console.warn("Skip MD file due to parse error:", file.name, err);
        }
      }
    }

    if (importedProjects.length > 0 || importedProfile) {
      setPendingImportData({
        projects: importedProjects,
        profile: importedProfile
      });
      const targetFolderStr = mainFolderName || `备份导入_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}`;
      setImportTargetFolder(targetFolderStr);
      setImportMode('append');
    } else {
      alert('未能在该文件夹内寻找并读取到任何有效的备份 JSON 或 Markdown 气运卡片文件！');
    }
    e.target.value = '';
  };

  const executeImport = () => {
    if (!pendingImportData) return;

    let finalProjects = [...projects];

    if (importMode === 'overwrite') {
      if (pendingImportData.profile) {
        setProfile(pendingImportData.profile);
        localStorage.setItem('lunar_profile', JSON.stringify(pendingImportData.profile));
      }
      finalProjects = pendingImportData.projects.map((p: any) => ({
        ...p,
        folder: p.folder || '未分类'
      }));
    } else {
      const folderName = importTargetFolder.trim() || '未分类';
      const formattedAppend = pendingImportData.projects.map((p: any) => ({
        ...p,
        id: `p-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        folder: folderName
      }));
      finalProjects = [...projects, ...formattedAppend];

      if (pendingImportData.profile) {
        if (confirm('发现备份中包含个人资料信息。是否同时覆盖您当前的头像与昵称等个人资料？')) {
          setProfile(pendingImportData.profile);
          localStorage.setItem('lunar_profile', JSON.stringify(pendingImportData.profile));
        }
      }
    }

    setProjects(finalProjects);
    localStorage.setItem('lunar_projects', JSON.stringify(finalProjects));
    setPendingImportData(null);
    setSelectedFolder(importMode === 'overwrite' ? '全部' : importTargetFolder.trim() || '未分类');
    alert('备份数据导入配置成功！');
  };

  const clearData = () => {
    if (confirm('确定要清除所有本地数据吗？这将重置您的个人信息和所有项目。')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setProjects((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const allFoldersSet = new Set(projects.map(p => p.folder?.trim() || '默认'));
  const allFolders = ['全部', ...Array.from(allFoldersSet).filter(f => f !== '默认'), '默认'].filter((v, i, a) => a.indexOf(v) === i);
  
  const filteredProjects = selectedFolder === '全部'
    ? projects
    : projects.filter(p => (p.folder?.trim() || '默认') === selectedFolder);

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-[#1A1A1A] font-sans selection:bg-emerald-100">
      {/* Profile Modal */}
      <AnimatePresence>
        {isProfileOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProfileOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-black/5"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">个人信息中心</h2>
                    <p className="text-sm text-zinc-500 mt-1">管理您的基本信息和账户设置</p>
                  </div>
                  <button 
                    onClick={() => setIsProfileOpen(false)}
                    className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                  >
                    <Plus size={24} className="rotate-45 text-zinc-400" />
                  </button>
                </div>

                <div className="flex flex-col items-center mb-10">
                  <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                    <div className="w-28 h-28 rounded-[2rem] overflow-hidden border-4 border-zinc-50 shadow-2xl ring-1 ring-black/5">
                      <img 
                        src={tempProfile.avatarUrl} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center rounded-[2rem] text-white">
                      <Plus size={24} />
                      <span className="text-[10px] font-bold uppercase tracking-wider mt-1">上传图片</span>
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      className="hidden" 
                      accept="image/*"
                    />
                  </div>
                  <div className="mt-4 w-full max-w-sm">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1.5 text-center">或输入图片链接</label>
                    <input 
                      type="text" 
                      value={tempProfile.avatarUrl}
                      onChange={(e) => setTempProfile({ ...tempProfile, avatarUrl: e.target.value })}
                      placeholder="https://example.com/avatar.jpg"
                      className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all text-xs text-center font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 ml-1">用户 ID</label>
                      <input 
                        type="text" 
                        value={tempProfile.id}
                        onChange={(e) => setTempProfile({ ...tempProfile, id: e.target.value })}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 ml-1">姓名</label>
                      <input 
                        type="text" 
                        value={tempProfile.name}
                        onChange={(e) => setTempProfile({ ...tempProfile, name: e.target.value })}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 ml-1">电子邮箱</label>
                    <input 
                      type="email" 
                      value={tempProfile.email}
                      onChange={(e) => setTempProfile({ ...tempProfile, email: e.target.value })}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 ml-1">个人简介</label>
                    <textarea 
                      rows={3}
                      value={tempProfile.bio}
                      onChange={(e) => setTempProfile({ ...tempProfile, bio: e.target.value })}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all text-sm resize-none"
                    />
                  </div>
                </div>

                {/* Gemini API Quota Status */}
                <div className="mt-8 pt-8 border-t border-zinc-100">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold tracking-tight text-zinc-800 flex items-center gap-2">
                        <Sparkles size={16} className="text-emerald-500" />
                        Gemini 智能接口配额监控及诊断
                      </h3>
                      <p className="text-[10px] text-zinc-400 mt-1 uppercase tracking-wider font-semibold">
                        基于本地调用的健康度诊断与流控日志
                      </p>
                    </div>
                    {requestLogs.length > 0 && (
                      <button 
                        onClick={() => {
                          localStorage.removeItem('gemini_api_requests_log');
                          setRequestLogs([]);
                        }}
                        className="px-2.5 py-1 text-[10px] font-bold text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-md transition-all uppercase tracking-wider"
                        title="清除本地调用历史日志"
                      >
                        清空日志
                      </button>
                    )}
                  </div>

                  {/* Quota Overview Cards */}
                  <div className="grid grid-cols-3 gap-3 mb-4 text-left">
                    <div className="bg-zinc-50 rounded-2xl p-3 border border-zinc-100 flex flex-col">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">成功调用次数</span>
                      <span className="text-xl font-black text-emerald-600 mt-1 font-mono">
                        {requestLogs.filter(l => l.status === 'success').length}
                      </span>
                    </div>
                    <div className="bg-zinc-50 rounded-2xl p-3 border border-zinc-100 flex flex-col">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">配额限制次数 (429)</span>
                      <span className={cn(
                        "text-xl font-black mt-1 font-mono",
                        requestLogs.filter(l => l.status === 'quota_limit').length > 0 ? "text-amber-500 animate-pulse" : "text-zinc-500"
                      )}>
                        {requestLogs.filter(l => l.status === 'quota_limit').length}
                      </span>
                    </div>
                    <div className="bg-zinc-50 rounded-2xl p-3 border border-zinc-100 flex flex-col">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">其它错误频次</span>
                      <span className={cn(
                        "text-xl font-black mt-1 font-mono",
                        requestLogs.filter(l => l.status === 'error').length > 0 ? "text-red-500 animate-pulse" : "text-zinc-500"
                      )}>
                        {requestLogs.filter(l => l.status === 'error').length}
                      </span>
                    </div>
                  </div>

                  {/* Quota Estimator Banner */}
                  <div className="bg-[#FAF9F6] border border-[#F5EEDC] rounded-2xl p-4 mb-4 text-xs text-amber-900 flex gap-2.5 text-left">
                    <div className="shrink-0 p-1 bg-[#F5EEDC] rounded-lg h-fit text-amber-700">
                      <Clock size={14} className="mt-0.5" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-amber-850">
                        <span>Gemini 官方配额限额规则说明建议</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-zinc-600 font-sans">
                        AI 仪表盘每日黄历及灵感由 Google Gemini API 驱动，默认使用免收费共享配额。其官方流控上限设定为 <strong>15 RPM</strong>（请求 / 分钟）及 <strong>1500 RPD</strong>（请求 / 天）。
                        若近期频繁请求，极可能被平台熔断，报错中通常会出现 <em>RESOURCE_EXHAUSTED</em> (无配额使用空间) 。建议您稍候，点击相应卡片重新加载或刷新！
                      </p>
                    </div>
                  </div>

                  {/* Call Logs Stream */}
                  <div className="space-y-2 text-left">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block ml-1 leading-none">
                      活跃调用路径监视记录 (最近 {Math.min(requestLogs.length, 5)} 条)
                    </span>
                    {requestLogs.length === 0 ? (
                      <div className="text-center py-6 bg-zinc-50 border border-dashed border-zinc-200 rounded-2xl text-xs text-zinc-400">
                        暂无本地会话诊断数据。在主页点击黄历刷新或点击添加 “AI 灵感” 进行调用。
                      </div>
                    ) : (
                      <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1 font-mono text-xs">
                        {requestLogs.slice(0, 5).map((log) => (
                          <div 
                            key={log.id} 
                            className="flex flex-col gap-1 p-2.5 rounded-xl border border-zinc-200 bg-zinc-50/50 hover:bg-zinc-50/100 transition-all text-left"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-zinc-700">
                                {log.endpoint === 'getChineseLunarInfo' ? '📅 每日黄历信息获取' : '✨ 创意项目灵感推荐'}
                              </span>
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[9px] font-black tracking-wider text-white",
                                log.status === 'success' ? "bg-emerald-500" :
                                log.status === 'quota_limit' ? "bg-amber-500 animate-pulse" : "bg-red-500"
                              )}>
                                {log.status === 'success' ? 'SUCCESS' : log.status === 'quota_limit' ? 'QUOTA_429' : 'ERR_FAIL'}
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-1">
                              <span>{new Date(log.timestamp).toLocaleTimeString()} ({new Date(log.timestamp).toLocaleDateString()})</span>
                              <span className="font-bold">CALL_ID: {log.id}</span>
                            </div>

                            {log.details && (
                              <div className="text-[10px] text-zinc-500 mt-1.5 bg-zinc-100/70 p-2 rounded border border-zinc-200 break-all leading-normal whitespace-pre-wrap max-h-[60px] overflow-y-auto font-mono text-left">
                                {log.details}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-10 pt-8 border-t border-zinc-100">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">数据管理</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button 
                      onClick={() => setIsGitHubModalOpen(true)}
                      className="col-span-1 sm:col-span-2 flex items-center justify-center gap-2.5 px-4 py-3.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-2xl border border-zinc-900 transition-all text-sm font-bold cursor-pointer shadow-md shadow-black/10 active:scale-98"
                    >
                      <Github size={18} className="text-amber-400" />
                      <span>上传备份至我的指定 GitHub 仓库</span>
                    </button>
                    <button 
                      onClick={exportData}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-zinc-50 hover:bg-zinc-100 rounded-2xl border border-zinc-200 transition-all text-sm font-medium text-zinc-700 cursor-pointer"
                    >
                      <Download size={18} />
                      导出单一 `.json` 备份
                    </button>
                    <button 
                      onClick={() => importInputRef.current?.click()}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-zinc-50 hover:bg-zinc-100 rounded-2xl border border-zinc-200 transition-all text-sm font-medium text-zinc-700 cursor-pointer"
                    >
                      <Upload size={18} />
                      导入备份文件 (.json)
                    </button>
                    <button 
                      onClick={() => importFolderInputRef.current?.click()}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-zinc-50 hover:bg-zinc-100 rounded-2xl border border-zinc-200 transition-all text-sm font-medium text-zinc-700 cursor-pointer"
                    >
                      <FolderUp size={18} className="text-emerald-600" />
                      导入本地备份/卡片文件夹
                    </button>
                    <button 
                      onClick={clearData}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 rounded-2xl border border-red-100 transition-all text-sm font-medium text-red-600 cursor-pointer"
                    >
                      <RefreshCw size={18} />
                      清空/重置主页所有卡片数据
                    </button>
                  </div>
                  
                  {/* File picker */}
                  <input 
                    type="file" 
                    ref={importInputRef} 
                    onChange={importData} 
                    className="hidden" 
                    accept=".json" 
                  />

                  {/* Folder directory picker */}
                  <input 
                    type="file" 
                    ref={importFolderInputRef} 
                    onChange={importFolderData} 
                    className="hidden" 
                    {...({
                      webkitdirectory: "",
                      directory: ""
                    } as any)}
                    multiple
                  />
                </div>

                <div className="mt-10 flex items-center justify-end gap-3">
                  <button 
                    onClick={() => setIsProfileOpen(false)}
                    className="px-6 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors"
                  >
                    取消
                  </button>
                  <button 
                    onClick={() => {
                      setProfile(tempProfile);
                      setIsProfileOpen(false);
                    }}
                    className="px-8 py-2.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition-all active:scale-95 shadow-lg shadow-black/10"
                  >
                    保存更改
                  </button>
                </div>
              </div>
              
              <div className="bg-zinc-50 px-8 py-4 border-t border-zinc-100 flex items-center gap-2 text-[10px] text-zinc-400 uppercase tracking-widest">
                <Sparkles size={12} />
                <span>您的信息仅保存在本地会话中</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-black/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="relative">
              {/* Gentle Yellow Breathing-Light Reminder (出现于超过7天未导出备份时) */}
              {isBackupOverdue && (
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setTempProfile(profile);
                    setIsProfileOpen(true);
                  }}
                  className="absolute -top-3 left-2 z-20 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-500 hover:to-yellow-500 text-amber-950 text-[10px] font-bold shadow-md shadow-amber-500/30 cursor-pointer animate-pulse transition-all border border-amber-300 tracking-tight"
                  title="超过7天未手动导出备份，建议点击进入个人信息-数据管理进行备份导出"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-900 animate-ping shrink-0" />
                  <span>建议导出备份 (已超7天)</span>
                </div>
              )}

              <button 
                onClick={() => {
                  setTempProfile(profile);
                  setIsProfileOpen(true);
                }}
                className={cn(
                  "group flex items-center gap-4 hover:bg-black/5 p-1.5 pr-4 rounded-2xl transition-all cursor-pointer text-left relative",
                  isBackupOverdue && "ring-2 ring-amber-400/70 ring-offset-2 bg-amber-50/20"
                )}
                title={isBackupOverdue ? "超过7天未手动导出备份，建议点击进入数据管理进行导出备份" : "查看与管理个人信息"}
              >
                <div className="w-12 h-12 rounded-xl overflow-hidden border border-black/5 shadow-sm group-hover:shadow-md transition-all relative">
                  <img 
                    src={profile.avatarUrl} 
                    alt="Avatar" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {isBackupOverdue && (
                    <span 
                      className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-white animate-pulse" 
                      title="备份过期提醒"
                    />
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-bold tracking-tight leading-tight">{profile.name}</span>
                  <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">{profile.id}</span>
                </div>
              </button>
            </div>

            <div className="flex items-center gap-3 bg-black/5 px-6 py-3 rounded-[2rem] border border-black/5 shadow-inner relative group">
              <Clock size={20} className="text-zinc-400" />
              <span className="text-2xl sm:text-4xl font-black text-black font-mono tracking-tighter tabular-nums leading-none">
                {time.toLocaleTimeString('zh-CN', { 
                  timeZone: 'Asia/Shanghai', 
                  hour: '2-digit', 
                  minute: '2-digit', 
                  second: '2-digit',
                  hour12: false 
                })}
              </span>
              {lastSaved && (
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-[8px] text-zinc-400 uppercase tracking-widest">
                  自动保存于 {lastSaved}
                </div>
              )}
            </div>

            {requestLogs.length > 0 && (
              <button
                onClick={() => {
                  setTempProfile(profile);
                  setIsProfileOpen(true);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full border transition-all hover:scale-105 active:scale-95 shadow-sm uppercase tracking-wider h-fit mt-1 sm:mt-0 font-sans cursor-pointer",
                  requestLogs[0]?.status === 'quota_limit' 
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : requestLogs[0]?.status === 'error'
                      ? "bg-red-50 text-red-600 border-red-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                )}
                title="查看 Gemini API 接口配额与诊断日志"
              >
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full animate-pulse shrink-0",
                  requestLogs[0]?.status === 'quota_limit' ? "bg-amber-500" :
                  requestLogs[0]?.status === 'error' ? "bg-red-500" : "bg-emerald-500"
                )} />
                <span className="truncate max-w-[100px] sm:max-w-none text-[10px] tracking-widest font-extrabold">
                  {requestLogs[0]?.status === 'quota_limit' ? "API已限流 ⚠️" :
                   requestLogs[0]?.status === 'error' ? "API调用故障 ❌" : "API连接正常 ✓"}
                </span>
              </button>
            )}
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setShowAddMenu(!showAddMenu)}
              disabled={isAdding}
              className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl hover:bg-zinc-800 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isAdding ? <RefreshCw size={18} className="animate-spin" /> : <Plus size={18} />}
              <span className="text-sm font-medium">添加互动项目</span>
            </button>

            <AnimatePresence>
              {showAddMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowAddMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-black/5 overflow-hidden z-20"
                  >
                    <button
                      onClick={() => {
                        setShowAddMenu(false);
                        setIsReflectionModalOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-amber-50/60 transition-colors border-b border-zinc-100 group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Compass size={17} />
                      </div>
                      <div>
                        <div className="text-sm font-bold flex items-center gap-1.5 text-zinc-900">
                          自身反省与提醒
                          <span className="text-[9px] bg-amber-200/80 text-amber-900 font-extrabold px-1.5 py-0.2 rounded-full">新</span>
                        </div>
                        <div className="text-[10px] text-zinc-400">从选择的文件夹文字生成 · 伴读总结与见解</div>
                      </div>
                    </button>
                    <button
                      onClick={() => addNewProject('gemini')}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 transition-colors border-b border-zinc-100"
                    >
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <Sparkles size={16} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">Gemini 灵感生成</div>
                        <div className="text-[10px] text-zinc-400 uppercase tracking-wider">AI 驱动</div>
                      </div>
                    </button>
                    <button
                      onClick={() => addNewProject('whiteboard')}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                        <Layout size={16} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">空白白板项目</div>
                        <div className="text-[10px] text-zinc-400 uppercase tracking-wider">自由编辑</div>
                      </div>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 pb-16">
        {/* 文件夹分类导航标签页 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/50 pb-5 mb-8">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-xl font-bold tracking-tight">灵感桌面</h2>
            <p className="text-xs text-zinc-400">使用文件夹优雅隔离您的周易黄历与互动应用卡片</p>
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none max-w-full">
            {allFolders.map(folder => (
              <button
                key={folder}
                onClick={() => setSelectedFolder(folder)}
                className={cn(
                  "px-4 py-2 text-xs font-semibold rounded-full border transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5",
                  selectedFolder === folder 
                    ? "bg-black text-white border-black hover:bg-zinc-800" 
                    : "bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-600"
                )}
              >
                <span>📁</span>
                <span>{folder}</span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-mono",
                  selectedFolder === folder ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-400"
                )}>
                  {folder === '全部' ? projects.length : projects.filter(p => (p.folder || '默认') === folder).length}
                </span>
              </button>
            ))}
          </div>
        </div>

        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={filteredProjects.map(p => p.id)}
            strategy={rectSortingStrategy}
          >
            {filteredProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center text-zinc-400 bg-white border border-black/5 rounded-3xl p-8 max-w-md mx-auto">
                <span className="text-3xl mb-3">📂</span>
                <h3 className="font-bold text-zinc-800 text-sm">该文件夹目前为空</h3>
                <p className="text-xs mt-1">您可以在这里添加新的内容，或者选择其他分类分组进行查看。</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                  {filteredProjects.map((project) => (
                    <SortableProjectCard 
                      key={project.id} 
                      project={project}
                      updateProjectTitle={updateProjectTitle}
                      updateProjectContent={updateProjectContent}
                      updateProjectReflectionMeta={updateProjectReflectionMeta}
                      updateProjectGithubUrl={updateProjectGithubUrl}
                      updateProjectFolder={updateProjectFolder}
                      removeProject={removeProject}
                      fetchLunarData={fetchLunarData}
                      addNewProject={addNewProject}
                      toggleEdit={toggleEdit}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </SortableContext>
        </DndContext>
      </main>

      {/* 导入备份文件夹选定与确认流程弹窗 */}
      <AnimatePresence>
        {pendingImportData !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPendingImportData(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-xl overflow-hidden border border-black/5 flex flex-col z-10 p-6 sm:p-8"
            >
              <div className="flex items-center gap-3 border-b border-zinc-100 pb-4 mb-4 text-left">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Upload size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg tracking-tight">导入备份配置</h3>
                  <p className="text-xs text-zinc-400">请选择并指定项目文件的导入和文件夹归属</p>
                </div>
              </div>

              <div className="space-y-5 text-left text-sm text-zinc-650">
                <div className="bg-zinc-50 border border-zinc-100 p-4 rounded-2xl flex flex-col gap-1.5 text-xs text-zinc-600">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">📝 备份概览</div>
                  <div>👥 个人属性：{pendingImportData.profile ? "✅ 已包含" : "❌ 未包含"}</div>
                  <div>📊 项目卡片：{pendingImportData.projects.length} 个卡片项目</div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">⚡️ 导入行为</span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setImportMode('append')}
                      className={cn(
                        "p-4 rounded-2xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer",
                        importMode === 'append'
                          ? "border-emerald-500 bg-emerald-50/20 text-emerald-950"
                          : "border-zinc-200 bg-white hover:bg-zinc-50"
                      )}
                    >
                      <span className="font-semibold text-xs text-emerald-700">🌱 增量导入</span>
                      <span className="text-[10px] text-zinc-400 leading-normal">保留你当前内容，并将此备份所有卡片整理至单独文件夹中。</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMode('overwrite')}
                      className={cn(
                        "p-4 rounded-2xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer",
                        importMode === 'overwrite'
                          ? "border-red-400 bg-red-50/10 text-red-950"
                          : "border-zinc-200 bg-white hover:bg-zinc-50"
                      )}
                    >
                      <span className="font-semibold text-xs text-red-600">⚠️ 覆盖现有</span>
                      <span className="text-[10px] text-zinc-400 leading-normal">彻底清空重置，全部以上载备份的文件数据覆盖。</span>
                    </button>
                  </div>
                </div>

                {importMode === 'append' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">指定归宿文件夹 / 分组名称</span>
                    </div>
                    <div className="space-y-1">
                      <input
                        type="text"
                        value={importTargetFolder}
                        onChange={(e) => setImportTargetFolder(e.target.value)}
                        className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-sans text-sm"
                        placeholder="例如: 工作、传统黄历..."
                      />
                      <p className="text-[10px] text-zinc-400">这有利于避免数据错乱，并在侧边/顶部自动呈现该新文件夹列表。</p>
                    </div>

                    {allFolders.filter(f => f !== '全部').length > 0 && (
                      <div className="pt-1.5">
                        <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">或在此处“选定”项目当前的文件夹分类：</span>
                        <div className="flex flex-wrap gap-1.5">
                          {allFolders.filter(f => f !== '全部').map(folder => (
                            <button
                              key={folder}
                              onClick={() => setImportTargetFolder(folder)}
                              type="button"
                              className={cn(
                                "px-2.5 py-1.5 text-[11px] rounded-lg border transition-all cursor-pointer flex items-center gap-1",
                                importTargetFolder === folder
                                  ? "bg-emerald-600 border-emerald-600 text-white shadow-sm font-medium"
                                  : "bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-600"
                              )}
                            >
                              <span>📁</span>
                              <span>{folder}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-zinc-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setPendingImportData(null)}
                  className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:bg-zinc-50 rounded-xl transition-all cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={executeImport}
                  className="px-8 py-2.5 bg-black hover:bg-zinc-800 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  确认导入
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 自身反省与提醒文件夹导入及小旁白生成弹窗 */}
      <ReflectionFolderModal
        isOpen={isReflectionModalOpen}
        onClose={() => setIsReflectionModalOpen(false)}
        onImportCards={(newCards, targetFolder) => {
          setProjects(prev => [...newCards, ...prev]);
          setSelectedFolder(targetFolder);
        }}
      />

      {/* 上传备份至 GitHub 弹窗 (Upload to GitHub Modal) */}
      <GitHubUploadModal
        isOpen={isGitHubModalOpen}
        onClose={() => setIsGitHubModalOpen(false)}
        dataToExport={{
          profile,
          projects,
          exportDate: new Date().toISOString(),
          version: '2.0',
          habitName: localStorage.getItem('lunar_habit_name') || '晨起练息与深度专注',
          habitStreakDays: localStorage.getItem('lunar_habit_streak_days') || '0',
          fortuneEvents: (() => {
            try {
              return JSON.parse(localStorage.getItem('lunar_fortune_events_v4') || '[]');
            } catch {
              return [];
            }
          })()
        }}
        onUploadSuccess={(result) => {
          const now = Date.now();
          setLastExportTime(now);
          localStorage.setItem('last_data_export_time', now.toString());
        }}
      />

      {/* 页面角落小的备份监测定时器 (Small Backup Monitor Timer in Page Corner) */}
      <div className="fixed bottom-10 right-6 z-30 flex flex-col items-end">
        {/* Expanded Details Popover */}
        <AnimatePresence>
          {isCornerTimerOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="mb-2 w-80 bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-zinc-200/90 text-xs space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                <div className="flex items-center gap-1.5 font-bold text-zinc-900">
                  <Timer size={15} className="text-orange-600" />
                  <span>数据备份安全定时器</span>
                </div>
                <span className="text-[10px] font-mono bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full font-semibold">
                  7天建议周期
                </span>
              </div>

              <div className="space-y-1.5 bg-zinc-50 rounded-xl p-3 border border-zinc-100">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500">上次手动备份：</span>
                  <span className="font-semibold text-zinc-800 font-mono">
                    {backupStats.formattedLastTime}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500">已过去时长：</span>
                  <span className={`font-bold font-mono ${isBackupOverdue ? 'text-amber-600' : 'text-emerald-700'}`}>
                    {backupStats.days} 天 {backupStats.hours} 小时
                  </span>
                </div>
              </div>

              {/* Status explanation */}
              <div className={`p-2.5 rounded-xl border text-[11px] leading-relaxed ${
                isBackupOverdue
                  ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                  : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
              }`}>
                {isBackupOverdue ? (
                  <div className="flex items-start gap-1.5">
                    <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>⚠️ 已超过 7 天未备份！</strong> 个人信息头像上方已亮起黄色呼吸灯。鼓励您立即执行一次手动备份，防止数据意外丢失。
                    </span>
                  </div>
                ) : (
                  <div className="flex items-start gap-1.5">
                    <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>🛡️ 数据处于安全备份期内。</strong> 距下一次 7 天推荐备份节点约还剩 {backupStats.daysRemaining} 天。
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsCornerTimerOpen(false);
                    setIsGitHubModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-zinc-950 hover:bg-zinc-850 text-white font-bold rounded-xl transition-all shadow-xs cursor-pointer text-xs"
                >
                  <Github size={14} className="text-amber-400" />
                  <span>上传备份到我的指定 GitHub 仓库</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    exportData();
                    setIsCornerTimerOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold rounded-xl transition-all cursor-pointer text-xs border border-zinc-200"
                >
                  <HardDriveDownload size={14} />
                  <span>下载本地数据文件 (.json)</span>
                </button>

                {/* State Simulation Debug Helpers for testing the 7-day behavior */}
                <div className="flex items-center justify-between pt-1 border-t border-zinc-100 text-[10px] text-zinc-400">
                  <span>演示/测试调试：</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={simulateOverdue}
                      className="text-amber-700 hover:underline cursor-pointer"
                      title="模拟超过7天未导出（触发黄色呼吸灯）"
                    >
                      模拟超期(&gt;7天)
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={simulateJustExported}
                      className="text-emerald-700 hover:underline cursor-pointer"
                      title="重置为刚刚完成备份（熄灭黄色呼吸灯）"
                    >
                      重置为已备份
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Capsule Widget */}
        <button
          type="button"
          onClick={() => setIsCornerTimerOpen(!isCornerTimerOpen)}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all shadow-md backdrop-blur-md cursor-pointer",
            isBackupOverdue
              ? "bg-amber-50/95 border-amber-300 text-amber-900 hover:bg-amber-100 shadow-amber-500/15"
              : "bg-white/95 border-zinc-200 text-zinc-700 hover:bg-zinc-50 shadow-black/5"
          )}
          title="点击查看数据备份安全定时器"
        >
          <div className="relative flex items-center justify-center">
            <Timer size={14} className={isBackupOverdue ? "text-amber-600" : "text-zinc-500"} />
            {isBackupOverdue && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white animate-pulse" />
            )}
          </div>
          <span className="font-mono">
            {isBackupOverdue ? `备份提醒: 距上次 ${backupStats.days}天 (超期)` : `备份定时器: 上次 ${backupStats.days}天前`}
          </span>
          <ChevronRight size={13} className={cn("transition-transform duration-200", isCornerTimerOpen && "rotate-90")} />
        </button>
      </div>

      {/* Footer / Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/50 backdrop-blur-sm border-t border-black/5 px-6 py-2 text-[10px] uppercase tracking-widest text-zinc-400 flex justify-between items-center z-10">
        <span>System Status: Operational</span>
        <span>© {new Date().getFullYear()} Lunar Dashboard v1.0</span>
      </footer>
    </div>
  );
}
