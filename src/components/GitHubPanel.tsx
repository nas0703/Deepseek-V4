import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase-client';
import { ProjectFile } from '../types/project';
import { Github, RefreshCw, UploadCloud, Plus, X, Loader2, Check, AlertCircle } from 'lucide-react';
import { User } from '@supabase/supabase-js';

interface GitHubPanelProps {
  files: ProjectFile[];
  activeProjectName: string;
  onClose: () => void;
}

export function GitHubPanel({ files, activeProjectName, onClose }: GitHubPanelProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [repos, setRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'error' | 'success', text: string} | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkConnection(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('github_connected') === 'true') {
      setMessage({ type: 'success', text: 'Berjaya menyambung ke GitHub!' });
      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  const checkConnection = async (userId: string) => {
    setLoading(true);
    const { data } = await supabase.from('github_connections').select('github_username').eq('user_id', userId).single();
    if (data) {
      setIsConnected(true);
      setGithubUsername(data.github_username);
      fetchRepos(userId);
    } else {
      setLoading(false);
    }
  };

  const fetchRepos = async (userId: string) => {
    try {
      const res = await fetch(`/api/github/repos?user_id=${userId}`);
      if (!res.ok) throw new Error('Gagal mengambil senarai repositori');
      const data = await res.json();
      setRepos(data);
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = () => {
    if (!user) return alert('Sila login terlebih dahulu.');
    window.location.href = `/api/github/connect?user_id=${user.id}`;
  };

  const handleCreateRepo = async () => {
    if (!user) return;
    const name = prompt('Nama repositori baru:', activeProjectName.toLowerCase().replace(/\s+/g, '-'));
    if (!name) return;
    
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/github/create-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, name, isPrivate: false })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal mencipta repositori');
      
      setMessage({ type: 'success', text: `Repositori ${data.full_name} berjaya dicipta!` });
      await fetchRepos(user.id);
      setSelectedRepo(data.full_name);
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePush = async () => {
    if (!user || !selectedRepo) return;
    
    setActionLoading(true);
    setMessage(null);
    try {
      const [repoOwner, repoName] = selectedRepo.split('/');
      const res = await fetch('/api/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          repoOwner,
          repoName,
          files,
          commitMessage: `Update ${activeProjectName} dari DeepSeek App Builder`
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal push kod');
      
      setMessage({ type: 'success', text: `Berjaya push ke GitHub!` });
    } catch (e: any) {
      console.error(e);
      setMessage({ type: 'error', text: e.message });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[#121212] border border-white/10 rounded-lg w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
        <div className="h-12 border-b border-white/10 flex items-center justify-between px-4 bg-[#0a0a0a]">
          <div className="flex items-center space-x-2">
            <Github className="w-4 h-4 text-white" />
            <span className="font-semibold text-white text-sm tracking-wide">GitHub Integration</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          {message && (
            <div className={`mb-4 p-3 rounded text-xs flex items-start space-x-2 ${message.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="flex-1 leading-relaxed">{message.text}</span>
            </div>
          )}

          {!user ? (
            <div className="text-center text-gray-400 text-sm py-4">
              Sila login terlebih dahulu untuk menggunakan GitHub.
            </div>
          ) : loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : !isConnected ? (
            <div className="text-center py-4 space-y-4">
              <p className="text-gray-400 text-sm">Sambung dengan GitHub untuk simpan dan kongsi kod anda.</p>
              <button 
                onClick={handleConnect}
                className="mx-auto flex items-center space-x-2 bg-[#24292F] hover:bg-[#24292F]/80 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                <Github className="w-4 h-4" />
                <span>Sambung dengan GitHub</span>
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center space-x-2 text-sm text-gray-300">
                <span className="text-green-400"><Check className="w-4 h-4" /></span>
                <span>Disambungkan sebagai <strong className="text-white">{githubUsername}</strong></span>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Pilih Repositori</label>
                <div className="flex space-x-2">
                  <select 
                    value={selectedRepo}
                    onChange={(e) => setSelectedRepo(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                  >
                    <option value="" disabled>-- Pilih Repositori --</option>
                    {repos.map(r => (
                      <option key={r.id} value={r.full_name}>{r.full_name}</option>
                    ))}
                  </select>
                  <button 
                    onClick={handleCreateRepo}
                    disabled={actionLoading}
                    title="Cipta Repositori Baru"
                    className="flex-shrink-0 bg-white/5 hover:bg-white/10 text-white p-2 rounded border border-white/10 transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button 
                  onClick={handlePush}
                  disabled={actionLoading || !selectedRepo || files.length === 0}
                  className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-md text-sm font-medium transition-colors disabled:bg-white/10 disabled:text-gray-500"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                  <span>Push ke {selectedRepo ? selectedRepo.split('/')[1] : 'GitHub'}</span>
                </button>
                {files.length === 0 && (
                  <p className="text-center text-[10px] text-gray-500 mt-2">Tiada fail untuk di-push.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
