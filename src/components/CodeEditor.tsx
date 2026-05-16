import { DiffEditor } from '@monaco-editor/react';
import { ProjectFile } from '../types/project';
import { Copy, Save, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface CodeEditorProps {
  file: ProjectFile | null;
  onUpdateFile: (content: string) => void;
  onCloseFile: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export function CodeEditor({ file, onUpdateFile, onCloseFile, onDirtyChange }: CodeEditorProps) {
  const [content, setContent] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(true);

  const contentRef = useRef(content);
  const fileRef = useRef(file);
  const onUpdateFileRef = useRef(onUpdateFile);
  const editorRef = useRef<any>(null);

  // Sync refs for unmount save
  useEffect(() => {
    contentRef.current = content;
    fileRef.current = file;
    onUpdateFileRef.current = onUpdateFile;
  }, [content, file, onUpdateFile]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (fileRef.current && contentRef.current !== fileRef.current.content) {
        onUpdateFileRef.current(contentRef.current);
      }
    };
  }, []);

  // Auto-save debounce (5 seconds)
  useEffect(() => {
    if (!file || content === file.content) return;

    const timer = setTimeout(() => {
      onUpdateFile(content);
      setIsSaved(true);
      onDirtyChange?.(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, [content, file, onUpdateFile, onDirtyChange]);

  // Sync state when file changes
  useEffect(() => {
    if (file) {
      if (file.path !== fileRef.current?.path && fileRef.current && contentRef.current !== fileRef.current.content) {
         // Save previous file if it was changed before switching to new file
         onUpdateFileRef.current(contentRef.current);
      }
      setContent(file.content);
      setIsSaved(true);
      onDirtyChange?.(false);
    }
  }, [file?.path]);

  const handleEditorChange = (value: string) => {
    setContent(value);
    const saved = value === file?.content;
    setIsSaved(saved);
    onDirtyChange?.(!saved);
  };

  const handleEditorMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    const modifiedEditor = editor.getModifiedEditor();
    modifiedEditor.onDidChangeModelContent(() => {
      handleEditorChange(modifiedEditor.getValue());
    });
  };

  const handleSave = () => {
    if (file && content !== file.content) {
      onUpdateFile(content);
      setIsSaved(true);
      onDirtyChange?.(false);
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
        <DiffEditor
          height="100%"
          language={file.language}
          theme="vs-dark"
          original={file.content}
          modified={content}
          onMount={handleEditorMount}
          options={{
            renderSideBySide: false,
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
