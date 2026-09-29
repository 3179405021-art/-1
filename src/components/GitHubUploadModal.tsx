import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Github, 
  CloudUpload, 
  Check, 
  ExternalLink, 
  GitBranch, 
  Copy, 
  Key, 
  AlertCircle, 
  Loader2, 
  X,
  UserCheck,
  FolderGit2,
  FolderPlus,
  Eye,
  EyeOff,
  GitCommit,
  Layers,
  FileCode,
  FileJson,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

interface GitHubUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataToExport: Record<string, any>;
  onUploadSuccess?: (result: { url: string; repo: string; path?: string; isFullProject: boolean }) => void;
}

interface GitHubUser {
  login: string;
  name: string;
  avatar_url: string;
  html_url: string;
  public_repos: number;
  total_private_repos?: number;
}

interface GitHubRepoItem {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  description: string | null;
}

export const GitHubUploadModal: React.FC<GitHubUploadModalProps> = ({
  isOpen,
  onClose,
  dataToExport,
  onUploadSuccess
}) => {
  // Upload mode: 'full_project' (entire codebase + data) or 'data_only' (single JSON file in repo)
  const [uploadMode, setUploadMode] = useState<'full_project' | 'data_only'>('full_project');

  // Token state
  const [token, setToken] = useState(() => localStorage.getItem('github_backup_pat') || '');
  const [showToken, setShowToken] = useState(false);
  const [rememberToken, setRememberToken] = useState(() => localStorage.getItem('github_remember_pat') !== 'false');

  // Target Repository settings
  const [repoFullName, setRepoFullName] = useState(() => localStorage.getItem('github_backup_repo') || '');
  const [branch, setBranch] = useState(() => localStorage.getItem('github_backup_branch') || 'main');
  const [forcePush, setForcePush] = useState(true);
  const [commitMessage, setCommitMessage] = useState('');

  // Single-file settings (only for data_only mode)
  const [filePath, setFilePath] = useState(() => localStorage.getItem('github_backup_filepath') || 'backups/lunar_backup_latest.json');
  const [includeTimestampInPath, setIncludeTimestampInPath] = useState(false);

  // GitHub user & repositories list
  const [isValidatingToken, setIsValidatingToken] = useState(false);
  const [gitHubUser, setGitHubUser] = useState<GitHubUser | null>(null);
  const [userRepos, setUserRepos] = useState<GitHubRepoItem[]>([]);

  // Auto-create repo state
  const [isCreatingRepo, setIsCreatingRepo] = useState(false);
  const [showCreateRepoInput, setShowCreateRepoInput] = useState(false);
  const [newRepoName, setNewRepoName] = useState('lunar-mindful-dashboard');
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);

  // Upload progress & result
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    url: string;
    branchUrl?: string;
    repo: string;
    branch: string;
    isFullProject: boolean;
    path?: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Sync token & repo preferences to localStorage
  useEffect(() => {
    if (rememberToken && token) {
      localStorage.setItem('github_backup_pat', token);
      localStorage.setItem('github_remember_pat', 'true');
    } else if (!rememberToken) {
      localStorage.removeItem('github_backup_pat');
      localStorage.setItem('github_remember_pat', 'false');
    }
  }, [token, rememberToken]);

  useEffect(() => {
    if (repoFullName) localStorage.setItem('github_backup_repo', repoFullName.trim());
    if (filePath) localStorage.setItem('github_backup_filepath', filePath.trim());
    if (branch) localStorage.setItem('github_backup_branch', branch.trim());
  }, [repoFullName, filePath, branch]);

  // Set default commit message with current timestamp
  useEffect(() => {
    if (isOpen) {
      const nowStr = new Date().toLocaleString('zh-CN', { hour12: false });
      setCommitMessage(
        uploadMode === 'full_project'
          ? `feat: 完整工程源码与笔记数据全量发布 [${nowStr}]`
          : `chore(data): 同步更新 Lunar 笔记及数据 [${nowStr}]`
      );
      setErrorMsg(null);
      if (token && !gitHubUser) {
        verifyGitHubToken(token, false);
      }
    }
  }, [isOpen, uploadMode]);

  // Verify Token & fetch user info + repo list
  const verifyGitHubToken = async (pat: string, isManual = true) => {
    const cleanToken = pat.trim();
    if (!cleanToken) {
      if (isManual) setErrorMsg('请输入 GitHub Personal Access Token (PAT)');
      return;
    }
    setIsValidatingToken(true);
    setErrorMsg(null);

    try {
      const res = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Token 无效或已过期，请检查 Token 并确保勾选了 repo 权限');
        } else {
          throw new Error(`GitHub API 响应异常: HTTP ${res.status}`);
        }
      }

      const userData: GitHubUser = await res.json();
      setGitHubUser(userData);

      // Fetch user's existing repositories for quick selection
      fetchUserRepositories(cleanToken);
    } catch (err: any) {
      setGitHubUser(null);
      if (isManual) {
        setErrorMsg(err.message || 'Token 验证失败，请确认网络连接及 Token 格式');
      }
    } finally {
      setIsValidatingToken(false);
    }
  };

  const fetchUserRepositories = async (cleanToken: string) => {
    try {
      const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator', {
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
      if (res.ok) {
        const repos: GitHubRepoItem[] = await res.json();
        setUserRepos(repos);
        if (!repoFullName && repos.length > 0) {
          const matched = repos.find(r => r.name.toLowerCase().includes('lunar') || r.name.toLowerCase().includes('note'));
          if (matched) {
            setRepoFullName(matched.full_name);
            setBranch(matched.default_branch || 'main');
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch repositories list', e);
    }
  };

  // 1-Click Create new Private/Public Repository on GitHub
  const handleCreateNewRepo = async () => {
    if (!token.trim()) {
      setErrorMsg('请先输入 Token 并验证');
      return;
    }
    const cleanRepoName = newRepoName.trim();
    if (!cleanRepoName) {
      setErrorMsg('请输入新建仓库名称');
      return;
    }

    setIsCreatingRepo(true);
    setErrorMsg(null);

    try {
      const res = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.trim()}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({
          name: cleanRepoName,
          description: 'Lunar Calendar & Mindful Notes Dashboard Full Project',
          private: newRepoPrivate,
          auto_init: true
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `创建仓库失败: HTTP ${res.status}`);
      }

      const createdRepo: GitHubRepoItem = await res.json();
      setRepoFullName(createdRepo.full_name);
      setBranch(createdRepo.default_branch || 'main');
      setUserRepos(prev => [createdRepo, ...prev]);
      setShowCreateRepoInput(false);
    } catch (err: any) {
      setErrorMsg(err.message || '新建仓库发生错误');
    } finally {
      setIsCreatingRepo(false);
    }
  };

  // Perform upload
  const handleStartUpload = async () => {
    const cleanToken = token.trim();
    const cleanRepo = repoFullName.trim();
    const cleanBranch = branch.trim() || 'main';

    if (!cleanToken) {
      setErrorMsg('请填写 GitHub Personal Access Token (PAT)');
      return;
    }
    if (!cleanRepo || !cleanRepo.includes('/')) {
      setErrorMsg('请输入规范的目标仓库全名，格式必须为：用户名/仓库名 (例如: octocat/my-lunar-project)');
      return;
    }

    setErrorMsg(null);
    setIsUploading(true);
    setUploadResult(null);

    try {
      if (uploadMode === 'full_project') {
        // --- 模式一：完整工程全量推送 ---
        const response = await fetch('/api/github/push-full-project', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token: cleanToken,
            repo: cleanRepo,
            branch: cleanBranch,
            commitMessage: commitMessage.trim() || `feat: 完整工程及所有卡片数据全量提交 [${new Date().toISOString()}]`,
            userData: dataToExport,
            force: forcePush
          })
        });

        const resData = await response.json();
        if (!response.ok) {
          throw new Error(resData.error || `推送失败: HTTP ${response.status}`);
        }

        setUploadResult({
          url: resData.repoUrl,
          branchUrl: resData.branchUrl,
          repo: cleanRepo,
          branch: cleanBranch,
          isFullProject: true
        });

        onUploadSuccess?.({
          url: resData.repoUrl,
          repo: cleanRepo,
          isFullProject: true
        });
      } else {
        // --- 模式二：仅数据文件归档 ---
        let cleanPath = filePath.trim() || 'backups/lunar_backup_latest.json';
        if (includeTimestampInPath) {
          const todayStr = new Date().toISOString().split('T')[0];
          cleanPath = cleanPath.endsWith('.json')
            ? cleanPath.replace(/\.json$/, `_${todayStr}.json`)
            : `${cleanPath}_${todayStr}.json`;
        }

        const jsonContent = JSON.stringify(dataToExport, null, 2);
        const contentBase64 = btoa(unescape(encodeURIComponent(jsonContent)));

        // Check if file already exists in repo
        let existingSha: string | null = null;
        try {
          const checkRes = await fetch(
            `https://api.github.com/repos/${cleanRepo}/contents/${cleanPath}?ref=${cleanBranch}`,
            {
              headers: {
                'Authorization': `Bearer ${cleanToken}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
              }
            }
          );
          if (checkRes.ok) {
            const fileMeta = await checkRes.json();
            existingSha = fileMeta.sha;
          }
        } catch {
          // File does not exist yet
        }

        const commitPayload: any = {
          message: commitMessage.trim() || `chore(data): update lunar notes backup [${new Date().toISOString()}]`,
          content: contentBase64,
          branch: cleanBranch
        };
        if (existingSha) {
          commitPayload.sha = existingSha;
        }

        const putRes = await fetch(
          `https://api.github.com/repos/${cleanRepo}/contents/${cleanPath}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${cleanToken}`,
              'Accept': 'application/vnd.github+json',
              'Content-Type': 'application/json',
              'X-GitHub-Api-Version': '2022-11-28'
            },
            body: JSON.stringify(commitPayload)
          }
        );

        if (!putRes.ok) {
          const errJson = await putRes.json().catch(() => ({}));
          throw new Error(errJson.message || `文件推送至仓库失败: HTTP ${putRes.status}`);
        }

        const commitData = await putRes.json();
        const fileUrl = commitData.content?.html_url || `https://github.com/${cleanRepo}/blob/${cleanBranch}/${cleanPath}`;

        setUploadResult({
          url: fileUrl,
          repo: cleanRepo,
          branch: cleanBranch,
          path: cleanPath,
          isFullProject: false
        });

        onUploadSuccess?.({
          url: fileUrl,
          repo: cleanRepo,
          path: cleanPath,
          isFullProject: false
        });
      }
    } catch (err: any) {
      console.error('GitHub upload error:', err);
      setErrorMsg(err.message || '上传过程发生异常，请检查网络与 Token 权限');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopyLink = () => {
    const link = uploadResult?.branchUrl || uploadResult?.url;
    if (link) {
      navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
      />

      {/* Modal Dialog */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="relative bg-white w-full max-w-xl rounded-3xl p-6 shadow-2xl border border-zinc-200 overflow-hidden max-h-[92vh] flex flex-col z-10"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-950 text-white flex items-center justify-center shadow-md shadow-black/10 shrink-0">
              <Github size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 tracking-tight flex items-center gap-2">
                <span>上传至我的指定 GitHub 仓库</span>
                <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1">
                  <Sparkles size={10} className="text-amber-600" />
                  完整上传
                </span>
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                将您当前做的完整工程与数据全量推送到您指定的个人代码仓库
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-full transition-colors cursor-pointer"
            title="关闭窗口"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="py-4 space-y-4 overflow-y-auto flex-1 pr-1 text-xs">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100/90 rounded-2xl border border-zinc-200/80">
            <button
              type="button"
              onClick={() => setUploadMode('full_project')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold transition-all cursor-pointer ${
                uploadMode === 'full_project'
                  ? 'bg-zinc-950 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/50'
              }`}
            >
              <FileCode size={15} className={uploadMode === 'full_project' ? 'text-amber-400' : ''} />
              <span>完整工程代码库上传 (推荐)</span>
            </button>
            <button
              type="button"
              onClick={() => setUploadMode('data_only')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-semibold transition-all cursor-pointer ${
                uploadMode === 'data_only'
                  ? 'bg-zinc-950 text-white shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/50'
              }`}
            >
              <FileJson size={15} className={uploadMode === 'data_only' ? 'text-amber-400' : ''} />
              <span>仅上传数据备份文件</span>
            </button>
          </div>

          {/* Mode Explanation Banner */}
          {uploadMode === 'full_project' ? (
            <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-3.5 flex items-start gap-2.5 text-amber-950">
              <Layers size={16} className="text-amber-700 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold">【完整工程全量推送】：</span>
                将当前开发的所有前端源码（React 19 / TypeScript / Tailwind）、后端 Express 代理服务、量化预测引擎、配置文件（`package.json`, `vite.config.ts`, `README.md`）以及您此时此刻保存的<strong>全部卡片笔记与习惯数据</strong>全量推送到目标仓库。推送后任何人 `git clone` 即可在本地直接运行！
              </div>
            </div>
          ) : (
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3.5 flex items-start gap-2.5 text-zinc-700">
              <FileJson size={16} className="text-zinc-500 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold">【仅数据文件归档】：</span>
                仅将当前您创建的个人卡片、反省记录、连击习惯和吉凶动力学数据打包为一个单一的 JSON 文件，推送到目标仓库的指定文件路径中。
              </div>
            </div>
          )}

          {/* Step 1: GitHub Personal Access Token */}
          <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold text-zinc-800 flex items-center gap-1.5">
                <Key size={14} className="text-zinc-600" />
                <span>1. GitHub Personal Access Token (PAT)</span>
              </label>
              <a
                href="https://github.com/settings/tokens/new?scopes=repo&description=Lunar+App+Full+Project+Push"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-zinc-600 hover:text-zinc-950 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                title="打开 GitHub 官方设置页快速新建 Token (需勾选 repo 权限)"
              >
                <span>创建 Token (需勾选 repo 权限)</span>
                <ExternalLink size={11} />
              </a>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx 或 github_pat_..."
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-zinc-950/10 focus:border-zinc-950 pr-8"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                  title={showToken ? '隐藏 Token' : '显示 Token'}
                >
                  {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              <button
                type="button"
                onClick={() => verifyGitHubToken(token, true)}
                disabled={isValidatingToken || !token.trim()}
                className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                {isValidatingToken ? <Loader2 size={13} className="animate-spin" /> : <UserCheck size={13} />}
                <span>验证授权</span>
              </button>
            </div>

            {/* Token verified indicator */}
            {gitHubUser && (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-emerald-950 text-xs">
                <div className="flex items-center gap-2">
                  <img
                    src={gitHubUser.avatar_url}
                    alt={gitHubUser.login}
                    className="w-6 h-6 rounded-full border border-emerald-300 shrink-0"
                  />
                  <span>
                    已验证账号: <strong className="font-mono">@{gitHubUser.login}</strong>
                    {gitHubUser.name ? ` (${gitHubUser.name})` : ''}
                  </span>
                </div>
                <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                  Repo 权限有效
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pt-0.5 text-[11px] text-zinc-500">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberToken}
                  onChange={(e) => setRememberToken(e.target.checked)}
                  className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-950"
                />
                <span>在本地记住 Token（仅安全存储于您当前的本地浏览器中）</span>
              </label>
              <span className="text-[10px] text-zinc-400">
                权限: repo (全量读写)
              </span>
            </div>
          </div>

          {/* Step 2: Target Repository Details */}
          <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200/80 space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-zinc-800 flex items-center gap-1.5">
                <FolderGit2 size={14} className="text-zinc-600" />
                <span>2. 指定推送目标仓库</span>
              </label>

              {gitHubUser && (
                <button
                  type="button"
                  onClick={() => setShowCreateRepoInput(!showCreateRepoInput)}
                  className="text-[11px] text-orange-600 hover:text-orange-700 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <FolderPlus size={12} />
                  <span>{showCreateRepoInput ? '取消新建' : '在 GitHub 新建仓库'}</span>
                </button>
              )}
            </div>

            {/* Quick Create Repo Drawer */}
            {showCreateRepoInput && (
              <div className="bg-orange-50/70 border border-orange-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between font-bold text-orange-950">
                  <span>在您的 GitHub 一键创建空仓库：</span>
                  <label className="flex items-center gap-1 font-normal text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newRepoPrivate}
                      onChange={(e) => setNewRepoPrivate(e.target.checked)}
                      className="rounded border-orange-300 text-orange-600"
                    />
                    <span>私有仓库 (Private)</span>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center flex-1 bg-white border border-orange-300 rounded-lg px-2.5 py-1 text-xs">
                    <span className="text-zinc-400 font-mono">{gitHubUser?.login || 'user'}/</span>
                    <input
                      type="text"
                      value={newRepoName}
                      onChange={(e) => setNewRepoName(e.target.value)}
                      placeholder="lunar-mindful-dashboard"
                      className="flex-1 font-mono focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateNewRepo}
                    disabled={isCreatingRepo || !newRepoName.trim()}
                    className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {isCreatingRepo ? <Loader2 size={12} className="animate-spin" /> : <PlusIcon />}
                    <span>立即创建</span>
                  </button>
                </div>
              </div>
            )}

            {/* Target Repo Name */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-zinc-700">
                  目标仓库全称 (格式: 用户名/仓库名)
                </label>
                {userRepos.length > 0 && (
                  <span className="text-[10px] text-zinc-400">
                    可直接从下拉选择，或手动输入
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={repoFullName}
                  onChange={(e) => setRepoFullName(e.target.value)}
                  placeholder="例如: octocat/my-lunar-project"
                  className="flex-1 px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-zinc-950/10 focus:border-zinc-950"
                />

                {userRepos.length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        setRepoFullName(e.target.value);
                        const sel = userRepos.find(r => r.full_name === e.target.value);
                        if (sel) setBranch(sel.default_branch || 'main');
                      }
                    }}
                    value={userRepos.some(r => r.full_name === repoFullName) ? repoFullName : ''}
                    className="px-2 py-2 bg-white border border-zinc-300 rounded-xl text-xs text-zinc-700 max-w-[150px] truncate focus:outline-none cursor-pointer"
                    title="从已获取的仓库列表中点选"
                  >
                    <option value="">快捷点选仓库...</option>
                    {userRepos.map((r) => (
                      <option key={r.id} value={r.full_name}>
                        {r.private ? '🔒 ' : '🌐 '}{r.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Branch and options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-zinc-700 block mb-1 flex items-center gap-1">
                  <GitBranch size={12} className="text-zinc-500" />
                  <span>目标分支 (Branch)</span>
                </label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-zinc-950/10 focus:border-zinc-950"
                />
              </div>

              {uploadMode === 'data_only' ? (
                <div>
                  <label className="font-semibold text-zinc-700 block mb-1">
                    保存文件路径 (File Path)
                  </label>
                  <input
                    type="text"
                    value={filePath}
                    onChange={(e) => setFilePath(e.target.value)}
                    placeholder="backups/lunar_backup_latest.json"
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-zinc-950/10 focus:border-zinc-950"
                  />
                  <label className="flex items-center gap-1 text-[10px] text-zinc-500 cursor-pointer mt-1">
                    <input
                      type="checkbox"
                      checked={includeTimestampInPath}
                      onChange={(e) => setIncludeTimestampInPath(e.target.checked)}
                      className="rounded border-zinc-300 text-zinc-900"
                    />
                    <span>添加日期后缀</span>
                  </label>
                </div>
              ) : (
                <div>
                  <label className="font-semibold text-zinc-700 block mb-1 flex items-center gap-1">
                    <ShieldCheck size={12} className="text-emerald-600" />
                    <span>覆盖同步策略</span>
                  </label>
                  <div className="h-9 flex items-center">
                    <label className="flex items-center gap-1.5 text-xs text-zinc-700 cursor-pointer font-medium">
                      <input
                        type="checkbox"
                        checked={forcePush}
                        onChange={(e) => setForcePush(e.target.checked)}
                        className="rounded border-zinc-300 text-zinc-900"
                      />
                      <span>强制覆盖远程分支 (--force 避免历史冲突)</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Commit Message */}
            <div>
              <label className="font-semibold text-zinc-700 block mb-1 flex items-center gap-1">
                <GitCommit size={12} className="text-zinc-500" />
                <span>提交说明 (Commit Message)</span>
              </label>
              <input
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="feat: 完整工程及所有卡片数据全量提交"
                className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-zinc-950/10 focus:border-zinc-950"
              />
            </div>
          </div>

          {/* Error Message Alert */}
          {errorMsg && (
            <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-xs animate-fade-in">
              <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <strong>提示：</strong>{errorMsg}
              </div>
            </div>
          )}

          {/* Success Banner */}
          {uploadResult && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 text-emerald-950 space-y-2.5"
            >
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                <Check size={18} className="text-emerald-600" />
                <span>
                  {uploadResult.isFullProject ? '🎉 完整工程已成功全量推送到 GitHub 仓库！' : '🎉 备份文件已成功推送到仓库！'}
                </span>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed">
                {uploadResult.isFullProject ? (
                  <>
                    整套应用源代码（前端、后端服务、配置、README）以及全部笔记数据已成功提交至仓库 <strong className="font-mono">{uploadResult.repo}</strong> 的 <strong className="font-mono">{uploadResult.branch}</strong> 分支！
                  </>
                ) : (
                  <>
                    数据文件已提交至仓库 <strong className="font-mono">{uploadResult.repo}</strong> 的 <strong className="font-mono">{uploadResult.path}</strong>！
                  </>
                )}
                已自动重置 7 天数据安全监护定时器。
              </p>
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <a
                  href={uploadResult.branchUrl || uploadResult.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                >
                  <ExternalLink size={13} />
                  <span>{uploadResult.isFullProject ? '在 GitHub 浏览完整项目仓库' : '在 GitHub 打开文件'}</span>
                </a>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  {copiedLink ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  <span>{copiedLink ? "已复制仓库链接" : "复制仓库链接"}</span>
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Modal Bottom Actions */}
        <div className="pt-4 border-t border-zinc-100 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-zinc-400">
            {repoFullName ? (
              <span>目标仓库：<strong className="text-zinc-700 font-mono">{repoFullName}</strong></span>
            ) : (
              <span>请输入或选择目标 GitHub 仓库</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors font-medium text-xs cursor-pointer"
            >
              关闭
            </button>
            <button
              type="button"
              onClick={handleStartUpload}
              disabled={isUploading || !token.trim() || !repoFullName.trim()}
              className="px-5 py-2.5 bg-zinc-950 hover:bg-zinc-850 disabled:opacity-40 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-black/10 flex items-center gap-2 cursor-pointer active:scale-98"
            >
              {isUploading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>正在上传完整项目至 GitHub...</span>
                </>
              ) : (
                <>
                  <CloudUpload size={14} className="text-amber-400" />
                  <span>{uploadMode === 'full_project' ? '立即上传完整项目至仓库' : '立即推送数据至仓库'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
