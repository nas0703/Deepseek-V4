import Editor from '@monaco-editor/react';
import { ProjectFile } from '../types/project';
import { Copy, Save, X } from 'lucide-react';
import { useState, useEffect } from 'react';

interface CodeEditorProps {
  file: ProjectFile | null;
  onUpdateFile: (content: string) => void;
  onCloseFile: () => void;
}

export function CodeEditor({ file, onUpdateFile, onCloseFile }: CodeEditorProps) {
  const [content, setContent] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(true);

  // Sync state when file changes
  useEffect(() => {
    if (file) {
      setContent(file.content);
      setIsSaved(true);
    }
  }, [file?.path]);

  const handleEditorChange = (value: string | undefined) => {
    const newVal = value || '';
    setContent(newVal);
    // Auto save logic or manual save logic. For now, mark as unsaved and auto-update on blur or debounce.
    setIsSaved(newVal === file?.content);
  };

  const handleSave = () => {
    if (file && content !== file.content) {
      onUpdateFile(content);
      setIsSaved(true);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        Tiada fail dipilih.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#121212]">
      {/* Editor Tabs / Toolbar */}
      <div className="h-9 border-b border-white/5 bg-[#0d0d0d] flex items-center justify-between px-2 shrink-0">
        <div className="h-full flex items-center bg-[#121212] px-4 border-r border-x border-white/5 text-xs text-blue-400 border-t-2 border-t-blue-500">
          <span className={!isSaved ? "italic" : ""}>{file.path}{!isSaved && '*'}</span>
          <button onClick={onCloseFile} className="ml-2 text-gray-600 hover:text-white p-0.5 rounded-sm hover:bg-white/10 transition-colors">
            <X className="w-3 h-3" />
          </button>
        </div>

        <div className="flex items-center space-x-2 mr-2">
          <button 
            onClick={handleCopy}
            className="flex items-center space-x-1 text-xs text-gray-400 hover:text-white transition-colors p-1"
          >
            <Copy className="w-3 h-3" />
            <span className="hidden sm:inline">{isCopied ? 'Tersalin!' : 'Copy'}</span>
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaved}
            className={`flex items-center space-x-1 text-xs p-1 px-2 rounded transition-colors ${
              isSaved 
                ? 'text-gray-600 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-500'
            }`}
          >
            <Save className="w-3 h-3" />
            <span className="hidden sm:inline">Save</span>
          </button>
        </div>
      </div>

      {/* Monaco Editor Container */}
      <div className="flex-1 overflow-hidden" onBlur={handleSave}>
        <Editor
          height="100%"
          language={file.language}
          theme="vs-dark"
          value={content}
          onChange={handleEditorChange}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: '"JetBrains Mono", monospace',
            lineHeight: 24,
            padding: { top: 16 },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            scrollbar: {
              vertical: 'hidden',
              horizontal: 'hidden'
            }
          }}
        />
      </div>
    </div>
  );
}
