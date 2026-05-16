import { ProjectFile } from '../types/project';
import { FileCode, FileJson, FileType2, File, Plus, Trash2, Edit2 } from 'lucide-react';
import React, { useState } from 'react';

interface FileExplorerProps {
  files: ProjectFile[];
  activeFilePath: string | null;
  unsavedFiles?: Set<string>;
  onSelectFile: (path: string) => void;
  onCreateFile: (path: string) => void;
  onDeleteFile: (path: string) => void;
  onRenameFile: (oldPath: string, newPath: string) => void;
}

export function FileExplorer({ files, activeFilePath, unsavedFiles = new Set(), onSelectFile, onCreateFile, onDeleteFile, onRenameFile }: FileExplorerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editFileName, setEditFileName] = useState('');

  const getFileIcon = (path: string) => {
    if (path.endsWith('.tsx') || path.endsWith('.ts')) return <FileType2 className="w-4 h-4 text-blue-400" />;
    if (path.endsWith('.json')) return <FileJson className="w-4 h-4 text-yellow-400" />;
    if (path.endsWith('.js') || path.endsWith('.jsx')) return <FileCode className="w-4 h-4 text-yellow-300" />;
    return <File className="w-4 h-4 text-gray-400" />;
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFileName.trim()) {
      onCreateFile(newFileName.trim());
      setNewFileName('');
      setIsCreating(false);
    }
  };

  const handleRenameSubmit = (e: React.FormEvent, oldPath: string) => {
    e.preventDefault();
    if (editFileName.trim() && editFileName !== oldPath) {
      onRenameFile(oldPath, editFileName.trim());
    }
    setEditingPath(null);
  };

  // Basic sorting: folders first (if we had them), then alphabetical. For now just alphabetical.
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      <div className="flex items-center justify-between p-3 text-[10px] uppercase tracking-widest text-gray-500 font-bold border-b border-white/5">
        <span>File Explorer</span>
        <button 
          onClick={() => setIsCreating(true)}
          className="hover:text-white transition-colors"
          title="New File"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto py-2">
        {isCreating && (
          <form onSubmit={handleCreateSubmit} className="px-4 py-1">
            <input
              autoFocus
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onBlur={() => setIsCreating(false)}
              className="w-full bg-[#121212] border border-blue-500 text-xs text-white px-2 py-1 rounded outline-none"
              placeholder="filename.ext"
            />
          </form>
        )}

        {sortedFiles.map(file => (
          <div key={file.path}>
            {editingPath === file.path ? (
              <form onSubmit={(e) => handleRenameSubmit(e, file.path)} className="px-4 py-1 bg-white/5">
                <input
                  autoFocus
                  type="text"
                  value={editFileName}
                  onChange={(e) => setEditFileName(e.target.value)}
                  onBlur={(e) => handleRenameSubmit(e as any, file.path)}
                  className="w-full bg-[#121212] border border-blue-500 text-xs text-white px-2 py-1 rounded outline-none"
                />
              </form>
            ) : (
              <div 
                className={`group flex items-center justify-between px-4 py-1.5 cursor-pointer text-xs transition-colors ${
                  activeFilePath === file.path 
                    ? 'bg-blue-500/10 text-blue-400 border-r-2 border-blue-500' 
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
                onClick={() => onSelectFile(file.path)}
              >
                <div className="flex items-center space-x-2 truncate">
                  {getFileIcon(file.path)}
                  <span className={`truncate ${unsavedFiles.has(file.path) ? 'italic text-white' : ''}`}>{file.path}</span>
                  {unsavedFiles.has(file.path) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                  )}
                </div>
                <div className="hidden group-hover:flex items-center space-x-1">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setEditFileName(file.path); setEditingPath(file.path); }}
                    className="p-1 hover:text-white transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDeleteFile(file.path); }}
                    className="p-1 hover:text-red-400 transition-colors text-red-500/50"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {files.length === 0 && !isCreating && (
          <div className="px-4 py-8 text-center text-xs text-gray-600">
            Tiada fail.<br />Minta AI jana fail atau klik + di atas.
          </div>
        )}
      </div>
    </div>
  );
}
