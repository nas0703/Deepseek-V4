import React, { useState, useEffect } from 'react';
import { ProjectFile } from '../types/project';
import { FileExplorer } from './FileExplorer';
import { CodeEditor } from './CodeEditor';
import { ChatPanel } from './ChatPanel';
import { PreviewPanel } from './PreviewPanel';
import { ProjectSidebar } from './ProjectSidebar';
import { AuthButton } from './AuthButton';
import { GitHubPanel } from './GitHubPanel';
import { supabase } from '../lib/supabase-client';
import { Save, Loader2, Menu, ChevronLeft, Play, X, PanelBottom } from 'lucide-react';

export function AppBuilderLayout() {
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'projects' | 'files' | 'editor' | 'chat' | 'preview'>('chat');
  const [rightTab, setRightTab] = useState<'chat' | 'preview'>('chat');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProjectName, setActiveProjectName] = useState<string>('Untitled');
  const [isSaving, setIsSaving] = useState(false);
  const [showGithubPanel, setShowGithubPanel] = useState(false);
  const [unsavedFiles, setUnsavedFiles] = useState<Set<string>>(new Set());
  const [showBottomPreview, setShowBottomPreview] = useState(false);

  // Derive active file
  const activeFile = projectFiles.find(f => f.path === activeFilePath) || null;

  const handleFilesGenerated = (newFiles: ProjectFile[]) => {
    setProjectFiles(prev => {
      const merged = [...prev];
      for (const file of newFiles) {
        const existingIndex = merged.findIndex(f => f.path === file.path);
        if (existingIndex >= 0) {
          merged[existingIndex] = file;
        } else {
          merged.push(file);
        }
      }
      return merged;
    });
    
    if (!activeFilePath && newFiles.length > 0) {
      setActiveFilePath(newFiles[0].path);
    }
  };

  const handleUpdateFile = (path: string, content: string) => {
    setProjectFiles(prev => prev.map(f => f.path === path ? { ...f, content } : f));
  };

  const handleCreateFile = (path: string) => {
    const ext = path.split('.').pop() || '';
    let language = 'plaintext';
    if (ext === 'ts' || ext === 'tsx') language = 'typescript';
    else if (ext === 'js' || ext === 'jsx') language = 'javascript';
    else if (ext === 'json') language = 'json';
    else if (ext === 'css') language = 'css';
    else if (ext === 'html') language = 'html';
    else if (ext === 'md') language = 'markdown';
    else if (ext === 'sql') language = 'sql';

    const newFile = { path, language, content: '' };
    setProjectFiles(prev => {
      if (prev.some(f => f.path === path)) return prev;
      return [...prev, newFile];
    });
    setActiveFilePath(path);
  };

  const handleDeleteFile = (path: string) => {
    setProjectFiles(prev => prev.filter(f => f.path !== path));
    if (activeFilePath === path) {
      setActiveFilePath(null);
    }
  };

  const handleRenameFile = (oldPath: string, newPath: string) => {
    setProjectFiles(prev => {
      if (prev.some(f => f.path === newPath)) return prev;
      return prev.map(f => f.path === oldPath ? { ...f, path: newPath } : f);
    });
    if (activeFilePath === oldPath) {
      setActiveFilePath(newPath);
    }
  };

  const handleLoadProject = async (projectId: string) => {
    setActiveProjectId(projectId);
    setMobileTab('files');
    const { data: projectData } = await supabase.from('projects').select('*').eq('id', projectId).single();
    if (projectData) setActiveProjectName(projectData.name);

    const { data: filesData, error } = await supabase.from('project_files').select('*').eq('project_id', projectId);
    
    if (!error && filesData) {
      setProjectFiles(filesData.map(f => ({
        path: f.path,
        content: f.content,
        language: f.language || 'plaintext'
      })));
      setActiveFilePath(null);
    }
  };

  const handleNewProject = () => {
    setActiveProjectId(null);
    setProjectFiles([]);
    setActiveFilePath(null);
    setActiveProjectName('Untitled');
  };

  const handleSaveProject = async () => {
    if (!activeProjectId) {
      alert('Sila pilih atau buat projek dari sidebar kiri terlebih dahulu.');
      setMobileTab('projects');
      return;
    }
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return alert('Sila login.');

    setIsSaving(true);
    try {
      // Create/Update files. In a real app we might diff or delete missing ones. For MVP just upsert.
      for (const file of projectFiles) {
        const { error } = await supabase.from('project_files').upsert({
          project_id: activeProjectId,
          user_id: session.user.id,
          path: file.path,
          content: file.content,
          language: file.language,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'project_id,path'
        });

        if (error) {
          console.error("Failed to save file", file.path, error);
        }
      }
      
      // Update project updated_at
      await supabase.from('projects').update({ updated_at: new Date().toISOString() }).eq('id', activeProjectId);
      
    } catch (e) {
      console.error(e);
      alert('Gagal menyimpan projek.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#0d0d0d] text-gray-300 font-sans overflow-hidden">
      {/* Top Bar */}
      <header className="h-12 border-b border-white/10 flex items-center justify-between px-4 bg-[#0a0a0a] shrink-0">
        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="flex items-center space-x-2">
            {mobileTab !== 'chat' && (
              <button 
                onClick={() => setMobileTab('chat')}
                className="sm:hidden p-1 -ml-2 mr-1 text-gray-400 hover:text-white transition-colors"
                title="Back to Menu"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs italic">D</span>
            </div>
            <h1 className="font-semibold text-white tracking-tight text-sm sm:text-base">DeepSeek AI <span className="text-gray-500 font-normal hidden sm:inline">App Builder</span></h1>
          </div>
          <div className="h-4 w-px bg-white/10 hidden sm:block"></div>
          <div className="hidden sm:flex items-center text-xs space-x-2 bg-white/5 px-2 py-1 rounded border border-white/5">
            <span className="text-blue-400">●</span>
            <span className="font-medium">{activeProjectName}</span>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setShowGithubPanel(true)}
            className="flex items-center space-x-1 border border-white/20 px-3 py-1.5 rounded text-xs hover:bg-white/5 transition-colors hidden sm:flex"
          >
            <span>GitHub</span>
          </button>
          <button 
            onClick={handleSaveProject}
            disabled={isSaving}
            className="flex items-center space-x-1 bg-white text-black px-3 py-1.5 rounded text-xs font-semibold hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Simpan</span>
          </button>
          
          <AuthButton />
        </div>
      </header>

      {showGithubPanel && (
        <GitHubPanel 
          files={projectFiles} 
          activeProjectName={activeProjectName} 
          onClose={() => setShowGithubPanel(false)} 
        />
      )}
      
      {/* Main Content Area */}
      <main className="flex flex-1 overflow-hidden flex-col sm:flex-row">
        {/* Left Sidebar: Projects */}
        <aside className={`w-full sm:w-48 border-r border-white/10 bg-[#0a0a0a] flex-col shrink-0 h-full sm:h-auto ${mobileTab === 'projects' ? 'flex' : 'hidden md:flex'}`}>
          <ProjectSidebar 
            activeProjectId={activeProjectId} 
            onLoadProject={handleLoadProject} 
            onNewProject={handleNewProject}
          />
        </aside>

        {/* Left Sidebar: Explorer */}
        <aside className={`w-full sm:w-56 border-r border-white/10 bg-[#0a0a0a] flex-col shrink-0 h-full sm:h-auto ${mobileTab === 'files' ? 'flex' : 'hidden sm:flex'}`}>
          <FileExplorer 
            files={projectFiles} 
            activeFilePath={activeFilePath}
            unsavedFiles={unsavedFiles}
            onSelectFile={(path) => {
              setActiveFilePath(path);
              setMobileTab('editor'); // auto switch to editor on mobile
            }}
            onCreateFile={handleCreateFile}
            onDeleteFile={handleDeleteFile}
            onRenameFile={handleRenameFile}
          />
        </aside>

        {/* Editor Center Area */}
        <section className={`flex-1 flex-col bg-[#121212] overflow-hidden ${mobileTab === 'editor' ? 'flex' : 'hidden sm:flex'}`}>
          <div className="flex-1 overflow-hidden relative border-b border-white/5">
            <CodeEditor 
              file={activeFile} 
              onUpdateFile={(content) => {
                if (activeFilePath) {
                   handleUpdateFile(activeFilePath, content);
                   setUnsavedFiles(prev => {
                      const next = new Set(prev);
                      next.delete(activeFilePath);
                      return next;
                   });
                }
              }}
              onDirtyChange={(isDirty) => {
                if (activeFilePath) {
                   setUnsavedFiles(prev => {
                      const next = new Set(prev);
                      if (isDirty) next.add(activeFilePath);
                      else next.delete(activeFilePath);
                      return next;
                   });
                }
              }}
              onCloseFile={() => {
                setActiveFilePath(null);
                setMobileTab('files');
              }}
            />
          </div>

          {showBottomPreview && (
            <div className="h-1/2 md:h-[40%] xl:h-1/2 flex flex-col shrink-0 border-t border-white/10 relative">
              <div className="absolute right-4 top-2 z-10">
                <button 
                  onClick={() => setShowBottomPreview(false)} 
                  className="bg-[#0a0a0a]/80 p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                  title="Close Bottom Preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <PreviewPanel files={projectFiles} />
            </div>
          )}
        </section>

        {/* Right Sidebar: AI Chat & Preview Panel */}
        <aside className={`w-full sm:w-80 lg:w-[450px] border-l border-white/10 bg-[#0a0a0a] flex-col shrink-0 h-full sm:h-auto ${mobileTab === 'chat' || mobileTab === 'preview' ? 'flex' : 'hidden sm:flex'}`}>
          <div className="flex bg-[#0a0a0a] border-b border-white/5 shrink-0 text-xs text-gray-400 p-1 px-4 gap-4 hidden sm:flex">
             <button 
               className={`py-2 transition-colors border-b-2 font-bold tracking-widest uppercase text-[10px] ${rightTab === 'chat' ? 'text-blue-400 border-blue-500' : 'border-transparent hover:text-white'}`}
               onClick={() => setRightTab('chat')}
             >Chat</button>
             <button 
               className={`py-2 transition-colors border-b-2 font-bold tracking-widest uppercase text-[10px] ${rightTab === 'preview' ? 'text-blue-400 border-blue-500' : 'border-transparent hover:text-white'}`}
               onClick={() => setRightTab('preview')}
             >Live Preview</button>
          </div>
          
          <div className={`flex-1 overflow-hidden sm:${rightTab === 'chat' ? 'block' : 'hidden md:hidden lg:hidden'} ${mobileTab === 'chat' ? 'block' : 'hidden sm:hidden'}`}>
             <ChatPanel onFilesGenerated={handleFilesGenerated} mobileTab={mobileTab} setMobileTab={setMobileTab} />
          </div>
          <div className={`flex-1 overflow-hidden sm:${rightTab === 'preview' ? 'block' : 'hidden md:hidden lg:hidden'} ${mobileTab === 'preview' ? 'block' : 'hidden sm:hidden'}`}>
             <PreviewPanel files={projectFiles} />
          </div>
        </aside>
      </main>

      {/* Bottom Status Bar */}
      <footer className="h-6 border-t border-white/10 bg-[#0a0a0a] flex items-center justify-between px-3 text-[10px] text-gray-500 shrink-0 select-none">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setShowBottomPreview(prev => !prev)}
            className={`flex items-center space-x-1 ${showBottomPreview ? 'text-blue-400' : 'hover:text-white'} transition-colors cursor-pointer outline-none`}
            title="Toggle Bottom Preview"
          >
            <PanelBottom className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{showBottomPreview ? 'Hide Preview' : 'Show Bottom Preview'}</span>
          </button>
          <div className="flex items-center space-x-1 hover:text-white cursor-pointer group" title="0 Errors">
            <X className="w-3 h-3 text-red-500 opacity-50 group-hover:opacity-100" />
            <span>0</span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <span>main*</span>
          <span>UTF-8</span>
          <span>{activeFile?.language || 'Unknown'}</span>
          <div className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span>Connected</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
