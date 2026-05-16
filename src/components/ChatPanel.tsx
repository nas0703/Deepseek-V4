import { Message, ModelOption, ChatMode } from '../types/chat';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { sendMessageToDeepSeek } from '../lib/deepseek';
import { Send, Trash2, Bot, User, Loader2, AlertCircle, FileCode, Settings2, X, Paperclip, FileText, Menu, Plus, MessageSquare, LayoutGrid, Folder, Code, Play, Pencil, Check } from 'lucide-react';
import { ProjectFile } from '../types/project';
import { parseAIResponse } from '../lib/parse-ai-response';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

export interface ChatPanelProps {
  onFilesGenerated?: (files: ProjectFile[]) => void;
  mobileTab?: string;
  setMobileTab?: (tab: 'projects' | 'files' | 'editor' | 'chat' | 'preview') => void;
}

const CompactSelect = ({ 
  value, 
  onChange,
  options,
  groups
}: { 
  value: string; 
  onChange: (val: string) => void;
  options?: { label: string; value: string }[];
  groups?: { label: string; options: { label: string; value: string }[] }[];
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format value label
  const displayLabel = useMemo(() => {
    if (groups) {
      for (const g of groups) {
        const found = g.options.find(o => o.value === value);
        if (found) return found.label;
      }
    }
    if (options) {
      const found = options.find(o => o.value === value);
      if (found) return found.label;
    }
    return value;
  }, [value, options, groups]);

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 bg-transparent text-[10px] sm:text-xs text-white hover:text-gray-300 outline-none cursor-pointer py-0.5"
      >
        <span className="truncate max-w-[120px]">{displayLabel}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6"/></svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-max min-w-[140px] max-h-[300px] overflow-y-auto bg-[#1a1a1a] border border-white/10 rounded-md shadow-2xl z-50 py-1 text-[10px] sm:text-[11px] custom-scrollbar">
          {groups ? (
            groups.map((g, i) => (
              <div key={i} className="mb-1 last:mb-0">
                <div className="px-3 py-1 text-gray-500 font-semibold text-[9px] uppercase tracking-wider bg-white/5">{g.label}</div>
                {g.options.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { onChange(opt.value); setOpen(false); }}
                    className={`block w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white transition-colors ${value === opt.value ? 'bg-blue-600/20 text-blue-400' : 'text-gray-200'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ))
          ) : (
            options?.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`block w-full text-left px-3 py-1.5 hover:bg-blue-600 hover:text-white transition-colors ${value === opt.value ? 'bg-blue-600/20 text-blue-400' : 'text-gray-200'}`}
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export function ChatPanel({ onFilesGenerated, mobileTab, setMobileTab }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string>(crypto.randomUUID());
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState('');
  const [model, setModel] = useState<ModelOption>('deepseek-v4-flash');
  const [mode, setMode] = useState<ChatMode>('General Chat');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [temperature, setTemperature] = useState<number>(0.7);
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  
  // Saved System Prompts
  const [savedPrompts, setSavedPrompts] = useState<{id: string, name: string, content: string}[]>([]);

  // Edit history name state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  useEffect(() => {
    try {
      const savedHist = localStorage.getItem('deepseek_chat_history');
      if (savedHist) {
        const parsed = JSON.parse(savedHist);
        setChatHistory(parsed);
        if (parsed.length > 0) {
          // Load latest session or start new
          // Actually, let's start a fresh chat on load for now, or load latest
          // Let's start a new empty chat on load to mirror typical AI chat behavior
          // We don't restore automatically unless user clicks
        }
      }
    } catch(e) {}
    
    try {
      const saved = localStorage.getItem('deepseek_system_prompts');
      if (saved) {
        setSavedPrompts(JSON.parse(saved));
      } else {
        const defaultPrompt = { 
          id: 'default', 
          name: 'Developer (BM)', 
          content: 'Anda ialah AI software engineer expert. Anda bantu user bina aplikasi full-stack menggunakan Next.js, TypeScript, Tailwind CSS, Supabase dan PostgreSQL. Bila user minta bina app, hasilkan struktur file lengkap dalam JSON yang boleh terus dimasukkan ke file editor. Utamakan code lengkap, selamat, production-ready dan mudah deploy. Jawab dalam Bahasa Melayu kecuali bahagian code.'
        };
        setSavedPrompts([defaultPrompt]);
        localStorage.setItem('deepseek_system_prompts', JSON.stringify([defaultPrompt]));
      }
    } catch(e) {}
  }, []);

  const handleSavePrompt = () => {
    const name = prompt('Sila masukkan nama untuk Arahan Sistem ini:');
    if (!name?.trim()) return;
    
    const newPrompt = { id: crypto.randomUUID(), name: name.trim(), content: systemPrompt };
    const newPrompts = [...savedPrompts, newPrompt];
    setSavedPrompts(newPrompts);
    localStorage.setItem('deepseek_system_prompts', JSON.stringify(newPrompts));
    alert('Arahan berjaya disimpan!');
  };

  const handleDeletePrompt = (id: string) => {
    if (!confirm('Anda pasti ingin membuang arahan ini?')) return;
    const newPrompts = savedPrompts.filter(p => p.id !== id);
    setSavedPrompts(newPrompts);
    localStorage.setItem('deepseek_system_prompts', JSON.stringify(newPrompts));
  };
  
  const [attachedFiles, setAttachedFiles] = useState<{name: string, content: string}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || isLoading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      attachments: attachedFiles.length > 0 ? [...attachedFiles] : undefined
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
    }
    setAttachedFiles([]);
    setIsLoading(true);
    setError(null);

    try {
      // Need to map frontend messages to API payload (omit id, omit parsedAction)
      const payloadMessages = [...messages, userMsg].map(m => {
         let content = m.content;
         if (m.role === 'user' && m.attachments) {
            const att = m.attachments.map(f => `[Fail dilampirkan: ${f.name}]\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n');
            content = `${content}\n\n${att}`;
         }
         return {
           role: m.role,
           content: content
         };
      });

      // Add a temporary assistant message to show streaming
      const assistantId = crypto.randomUUID();
      const streamMode = mode !== 'Build Full App' && mode !== 'Generate Code'; // Don't stream JSON code generation to keep it safe, but we can stream conversation

      if (streamMode) {
        setMessages(prev => [...prev, {
          id: assistantId,
          role: 'assistant',
          content: '...'
        }]);
      }

      abortControllerRef.current = new AbortController();

      const assistantMsgRaw = await sendMessageToDeepSeek(payloadMessages, model, mode, {
        temperature,
        systemPrompt: systemPrompt.trim() || undefined,
        stream: streamMode,
        signal: abortControllerRef.current.signal,
        onChunk: (text) => {
           if (streamMode) {
             setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: text + ' █' } : m));
           }
        }
      });
      
      let parsedAction = undefined;
      if (mode === 'Build Full App' || mode === 'Generate Code') {
        parsedAction = parseAIResponse(assistantMsgRaw.content);
        if (parsedAction.isJson && parsedAction.files && onFilesGenerated) {
          onFilesGenerated(parsedAction.files);
        }
      }

      const assistantMsg: Message = {
        ...assistantMsgRaw,
        id: streamMode ? assistantId : assistantMsgRaw.id,
        parsedAction
      };
      
      let newMessages: Message[];
      if (streamMode) {
         // Create the new messages array based on the current messages + userMsg + assistantMsg
         // During the stream we only added userMsg + streaming assistant message
         // To reconstruct the final array:
         newMessages = [...messages, userMsg, assistantMsg];
         setMessages(newMessages);
      } else {
         newMessages = [...messages, userMsg, assistantMsg];
         setMessages(newMessages);
      }
      
      // Save to history
      setChatHistory(prev => {
        const histItem = prev.find(h => h.id === sessionId);
        let updatedHist: ChatSession[];
        if (histItem) {
          updatedHist = prev.map(h => 
            h.id === sessionId 
              ? { ...h, messages: newMessages, updatedAt: Date.now() } 
              : h
          );
        } else {
          updatedHist = [
            {
              id: sessionId,
              title: userMsg.content.slice(0, 30) + '...',
              messages: newMessages,
              updatedAt: Date.now()
            },
            ...prev
          ];
        }
        localStorage.setItem('deepseek_chat_history', JSON.stringify(updatedHist));
        return updatedHist;
      });
      
    } catch (err: any) {
      if (err.name !== 'AbortError' && !err.message?.includes('The user aborted a request')) {
        setError(err.message || "Gagal menghantar mesej.");
      } else {
        // Remove the block cursor if streaming was aborted
        setMessages(prev => prev.map(m => m.role === 'assistant' && m.content.endsWith(' █') ? { ...m, content: m.content.replace(' █', '') } : m));
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setError(null);
    setAttachedFiles([]);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      const newFiles = await Promise.all(
        files.map(file => 
          new Promise<{name: string, content: string}>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve({ name: file.name, content: String(e.target?.result || '') });
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
          })
        )
      );
      setAttachedFiles(prev => [...prev, ...newFiles]);
    } catch (err) {
      setError("Gagal membaca fail yang dimuat naik.");
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] text-gray-300 font-sans overflow-hidden relative">
      {/* Header */}
      <header className="h-12 border-b border-white/5 flex items-center justify-between px-3 bg-[#0a0a0a] shrink-0">
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="p-1 rounded transition-colors text-gray-500 hover:bg-white/5 hover:text-white"
            title="Chat History"
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse hidden sm:block"></div>
          <span className="text-xs font-bold uppercase tracking-wider hidden lg:inline">Chat</span>
        </div>
        
        <div className="flex items-center gap-2 justify-end">
          <div className="flex items-center bg-white/5 rounded-md px-1.5 py-1 border border-white/10">
             <span className="hidden xl:inline text-[9px] uppercase tracking-wider text-gray-500 mr-1">Model</span>
             <CompactSelect 
               value={model} 
               onChange={(val) => setModel(val as ModelOption)}
               groups={[
                 {
                   label: "DeepSeek",
                   options: [
                     { label: "deepseek-v4-flash", value: "deepseek-v4-flash" },
                     { label: "deepseek-v4-pro", value: "deepseek-v4-pro" }
                   ]
                 },
                 {
                   label: "Gemini",
                   options: [
                     { label: "gemini-3.1-pro", value: "gemini-3.1-pro" },
                     { label: "gemini-2.5-pro", value: "gemini-2.5-pro" },
                     { label: "gemini-2.5-flash", value: "gemini-2.5-flash" },
                     { label: "gemini-1.5-pro", value: "gemini-1.5-pro" },
                     { label: "gemini-1.5-flash", value: "gemini-1.5-flash" }
                   ]
                 },
                 {
                   label: "ChatGPT",
                   options: [
                     { label: "chatgpt-5.5", value: "chatgpt-5.5" },
                     { label: "gpt-4o", value: "chatgpt-4o" },
                     { label: "gpt-4o-mini", value: "chatgpt-4o-mini" }
                   ]
                 }
               ]}
             />
          </div>
          
          <div className="flex items-center bg-white/5 rounded-md px-1.5 py-1 border border-white/10">
             <span className="hidden xl:inline text-[9px] uppercase tracking-wider text-gray-500 mr-1">Mode</span>
             <CompactSelect 
               value={mode} 
               onChange={(val) => setMode(val as ChatMode)}
               options={[
                 { label: "General Chat", value: "General Chat" },
                 { label: "Generate Code", value: "Generate Code" },
                 { label: "Fix Error", value: "Fix Error" },
                 { label: "Build Full App", value: "Build Full App" }
               ]}
             />
          </div>

          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1 rounded transition-colors ${showSettings ? 'bg-white/10 text-white' : 'text-gray-500 hover:bg-white/5 hover:text-white'}`}
            title="Model Settings"
          >
            <Settings2 className="w-4 h-4" />
          </button>
          <button 
            onClick={handleClear}
            className="p-1 hover:bg-white/5 rounded transition-colors text-gray-500 hover:text-white"
            title="Clear Chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-[#121212] border-b border-white/5 p-4 shrink-0 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Model Settings</h3>
            <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <label className="text-gray-400">Temperature: {temperature}</label>
            </div>
            <input 
              type="range" 
              min="0" 
              max="2" 
              step="0.1" 
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-blue-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
            />
            <p className="text-[10px] text-gray-500">Nilai rendah (0.2) untuk kod yang tepat, nilai tinggi (0.8+) untuk idea kreatif.</p>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center pb-2">
              <label className="text-xs text-gray-400">System Instructions</label>
              <div className="space-x-2 flex">
                <CompactSelect
                  value="-- Pilih Template --"
                  onChange={(val) => {
                    const found = savedPrompts.find(p => p.id === val);
                    if (found) setSystemPrompt(found.content);
                  }}
                  options={[
                    { label: "-- Pilih Template --", value: "-- Pilih Template --" },
                    ...savedPrompts.map(p => ({ label: p.name, value: p.id }))
                  ]}
                />
                <button 
                  onClick={handleSavePrompt}
                  disabled={!systemPrompt.trim()}
                  className="bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 px-2 py-1 flex items-center space-x-1 rounded text-[10px] disabled:opacity-50 transition-colors"
                >
                  <span className="font-semibold">+ Simpan</span>
                </button>
              </div>
            </div>
            <textarea 
              className="w-full bg-black/50 border border-white/10 rounded p-2 text-xs text-white outline-none focus:border-blue-500 resize-y min-h-[60px]"
              placeholder="Berikan arahan khusus kepada model (contoh: Gunakan bahasa rojak)..."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
            
            {savedPrompts.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-[10px] text-gray-500">Arahan Disimpan:</p>
                <div className="flex flex-wrap gap-2">
                  {savedPrompts.map(p => (
                     <div key={p.id} className="flex items-center space-x-1 bg-white/5 border border-white/10 px-2 py-1 rounded text-[10px]">
                        <span 
                           className="cursor-pointer text-gray-300 hover:text-white"
                           onClick={() => setSystemPrompt(p.content)}
                        >
                           {p.name}
                        </span>
                        {p.id !== 'default' && (
                           <button 
                             onClick={() => handleDeletePrompt(p.id)}
                             className="text-red-500/70 hover:text-red-500 ml-1 p-0.5"
                           >
                              <X className="w-2.5 h-2.5" />
                           </button>
                        )}
                     </div>
                  ))}
                </div>
              </div>
            )}
            
            <p className="text-[10px] text-gray-500 mt-2">Arahan ini akan ditambah kepada arahan utama pembantu kod.</p>
          </div>
        </div>
      )}

      {/* Main chat area container */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Chat History Drawer */}
        <div className={`absolute top-0 bottom-0 left-0 bg-[#0a0a0a] border-r border-white/10 z-20 w-[240px] flex flex-col transition-transform duration-300 ${showHistory ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-3 border-b border-white/5 flex flex-col">
             <button 
                onClick={() => {
                  setMessages([]);
                  setSessionId(crypto.randomUUID());
                  setShowHistory(false);
                }}
                className="flex items-center space-x-2 bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-lg w-full text-xs transition-colors mb-2"
             >
                <Plus className="w-4 h-4" />
                <span>New Chat</span>
             </button>

             {setMobileTab && (
               <div className="flex flex-col space-y-0.5 sm:hidden mt-2">
                 <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 px-2">Navigation</div>
                 <button className={`flex items-center space-x-2 px-2 py-1.5 text-xs rounded hover:bg-white/5 ${mobileTab === 'projects' ? 'bg-blue-500/10 text-blue-400' : 'text-gray-400'}`} onClick={() => { setMobileTab('projects'); setShowHistory(false); }}>
                   <LayoutGrid className="w-3.5 h-3.5 shrink-0" /><span>Projects</span>
                 </button>
                 <button className={`flex items-center space-x-2 px-2 py-1.5 text-xs rounded hover:bg-white/5 ${mobileTab === 'chat' ? 'bg-blue-500/10 text-blue-400' : 'text-gray-400'}`} onClick={() => { setMobileTab('chat'); setShowHistory(false); }}>
                   <MessageSquare className="w-3.5 h-3.5 shrink-0" /><span>Chat</span>
                 </button>
                 <button className={`flex items-center space-x-2 px-2 py-1.5 text-xs rounded hover:bg-white/5 ${mobileTab === 'files' ? 'bg-blue-500/10 text-blue-400' : 'text-gray-400'}`} onClick={() => { setMobileTab('files'); setShowHistory(false); }}>
                   <Folder className="w-3.5 h-3.5 shrink-0" /><span>Files</span>
                 </button>
                 <button className={`flex items-center space-x-2 px-2 py-1.5 text-xs rounded hover:bg-white/5 ${mobileTab === 'editor' ? 'bg-blue-500/10 text-blue-400' : 'text-gray-400'}`} onClick={() => { setMobileTab('editor'); setShowHistory(false); }}>
                   <Code className="w-3.5 h-3.5 shrink-0" /><span>Editor</span>
                 </button>
                 <button className={`flex items-center space-x-2 px-2 py-1.5 text-xs rounded hover:bg-white/5 ${mobileTab === 'preview' ? 'bg-blue-500/10 text-blue-400' : 'text-gray-400'}`} onClick={() => { setMobileTab('preview'); setShowHistory(false); }}>
                   <Play className="w-3.5 h-3.5 shrink-0" /><span>Preview</span>
                 </button>
               </div>
             )}
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col py-2">
             <div className="px-3 py-1 flex items-center justify-between">
               <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Chats</span>
               {chatHistory.length > 0 && (
                 <button 
                   onClick={(e) => {
                     e.stopPropagation();
                     if (confirm('Anda pasti ingin memadam semua sejarah perbualan? Tindakan ini tidak boleh dipadam balik.')) {
                       setChatHistory([]);
                       localStorage.setItem('deepseek_chat_history', JSON.stringify([]));
                       setMessages([]);
                       setSessionId(crypto.randomUUID());
                     }
                   }}
                   className="text-[10px] text-gray-500 hover:text-red-400 transition-colors uppercase tracking-wider"
                 >
                   Clear All
                 </button>
               )}
             </div>
             <div className="flex-1 space-y-1 mt-1">
               {chatHistory.length === 0 ? (
                 <div className="px-3 py-2 text-xs text-gray-600">No recent chats</div>
               ) : (
                 chatHistory.map(session => (
                   <div 
                     key={session.id} 
                     className="group relative px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer flex items-center"
                     onClick={() => {
                       if (editingSessionId === session.id) return;
                       setSessionId(session.id);
                       setMessages(session.messages || []);
                       setShowHistory(false);
                     }}
                   >
                     <MessageSquare className="w-4 h-4 mr-2 flex-shrink-0 opacity-50" />
                     {editingSessionId === session.id ? (
                       <div className="flex-1 flex items-center min-w-0 pr-1">
                         <input
                           autoFocus
                           className="flex-1 bg-white/10 text-white px-1.5 py-0.5 rounded text-xs outline-none focus:ring-1 focus:ring-blue-500 border border-transparent focus:border-transparent min-w-0"
                           value={editingTitle}
                           onChange={(e) => setEditingTitle(e.target.value)}
                           onKeyDown={(e) => {
                             if (e.key === 'Enter') {
                               e.stopPropagation();
                               e.preventDefault();
                               if (editingTitle.trim()) {
                                 setChatHistory(prev => {
                                   const n = prev.map(h => h.id === session.id ? { ...h, title: editingTitle.trim() } : h);
                                   localStorage.setItem('deepseek_chat_history', JSON.stringify(n));
                                   return n;
                                 });
                               }
                               setEditingSessionId(null);
                             } else if (e.key === 'Escape') {
                               e.stopPropagation();
                               setEditingSessionId(null);
                             }
                           }}
                           onClick={(e) => e.stopPropagation()}
                         />
                         <button 
                           onClick={(e) => {
                             e.stopPropagation();
                             if (editingTitle.trim()) {
                               setChatHistory(prev => {
                                 const n = prev.map(h => h.id === session.id ? { ...h, title: editingTitle.trim() } : h);
                                 localStorage.setItem('deepseek_chat_history', JSON.stringify(n));
                                 return n;
                               });
                             }
                             setEditingSessionId(null);
                           }}
                           className="ml-1 p-1 text-green-400 hover:bg-white/10 rounded"
                         >
                           <Check className="w-3 h-3" />
                         </button>
                       </div>
                     ) : (
                       <div className="truncate flex-1 min-w-0">{session.title}</div>
                     )}
                     
                     {editingSessionId !== session.id && (
                       <div className="opacity-0 group-hover:opacity-100 flex items-center ml-1 transition-opacity">
                         <button 
                           onClick={(e) => {
                             e.stopPropagation();
                             setEditingSessionId(session.id);
                             setEditingTitle(session.title);
                           }}
                           className="p-1 hover:text-blue-400 transition-colors"
                         >
                           <Pencil className="w-3 h-3" />
                         </button>
                         <button 
                           onClick={(e) => {
                             e.stopPropagation();
                             setChatHistory(prev => {
                               const n = prev.filter(h => h.id !== session.id);
                               localStorage.setItem('deepseek_chat_history', JSON.stringify(n));
                               return n;
                             });
                             if (sessionId === session.id) {
                               setMessages([]);
                               setSessionId(crypto.randomUUID());
                             }
                           }}
                           className="p-1 hover:text-red-400 transition-colors"
                         >
                           <Trash2 className="w-3 h-3" />
                         </button>
                       </div>
                     )}
                   </div>
                 ))
               )}
             </div>
          </div>
        </div>

        {/* Backdrop for mobile to click out */}
        {showHistory && (
           <div 
             className="absolute inset-0 bg-black/50 z-10"
             onClick={() => setShowHistory(false)}
           />
        )}

        {/* Existing Content */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
            <Bot className="w-12 h-12 opacity-30" />
            <p className="text-sm">Mula berbual dengan DeepSeek AI...</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div 
                className={`max-w-[90%] sm:max-w-[80%] ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white text-xs sm:text-sm p-3 rounded-2xl rounded-tr-none' 
                    : 'bg-white/5 border border-white/10 text-xs sm:text-sm p-3 rounded-2xl rounded-tl-none leading-relaxed text-gray-300'
                }`}
              >
                {msg.parsedAction && msg.parsedAction.isJson ? (
                  <div className="flex flex-col space-y-3">
                    {msg.parsedAction.explanation && (
                      <div className="whitespace-pre-wrap">{msg.parsedAction.explanation}</div>
                    )}
                    
                    {msg.parsedAction.files && msg.parsedAction.files.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Lengkap:</div>
                        <ul className="list-disc ml-4 text-blue-400 text-xs marker:text-blue-500/50">
                          {msg.parsedAction.files.map((file, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <FileCode className="w-3 h-3" />
                              <span>{file.path}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {msg.parsedAction.commands && msg.parsedAction.commands.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Commands (Run in terminal):</div>
                        <div className="bg-black/50 p-2 rounded border border-white/5 font-mono text-[10px] text-green-400 space-y-1">
                           {msg.parsedAction.commands.map((cmd, i) => (
                             <div key={i}>$ {cmd}</div>
                           ))}
                        </div>
                      </div>
                    )}

                    {msg.parsedAction.notes && msg.parsedAction.notes.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Nota Perhatian:</div>
                        <ul className="list-disc ml-4 text-yellow-400/80 text-xs">
                          {msg.parsedAction.notes.map((note, i) => (
                            <li key={i}>{note}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : msg.parsedAction && !msg.parsedAction.isJson ? (
                  <div className="flex flex-col space-y-2">
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {msg.attachments.map((f, i) => (
                          <div key={i} className="flex items-center space-x-1 bg-white/10 px-2 py-1 rounded text-[10px]">
                            <FileText className="w-3 h-3 text-blue-400" />
                            <span className="truncate max-w-[150px]">{f.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="text-red-400 font-medium text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      <span>{msg.parsedAction.error}</span>
                    </div>
                    <div className="markdown-body text-xs sm:text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col space-y-2">
                    {msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {msg.attachments.map((f, i) => (
                          <div key={i} className="flex items-center space-x-1 bg-white/10 border border-white/20 px-2 py-1 rounded text-[10px]">
                            <FileText className="w-3 h-3 text-blue-300" />
                            <span className="truncate max-w-[150px] font-mono">{f.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.content && (
                      <div className="markdown-body text-xs sm:text-sm">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {msg.usage && (
                <div className={`text-[10px] text-gray-500 font-mono mt-1 mb-2 ${msg.role === 'user' ? 'mr-1' : 'ml-1'}`}>
                  Tokens: <span className="text-gray-400">{msg.usage.prompt_tokens}</span> prompt + <span className="text-gray-400">{msg.usage.completion_tokens}</span> completion = <span className="text-gray-300 font-semibold">{msg.usage.total_tokens}</span> total
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex flex-col items-start">
            <div className="bg-white/5 border border-white/10 text-xs sm:text-sm p-3 rounded-2xl rounded-tl-none flex items-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span className="text-gray-400">Sedang memproses...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex gap-3 justify-center items-center p-3 bg-red-900/20 border border-red-500/30 rounded-xl text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p className="text-xs sm:text-sm">{error}</p>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/5">
        <div className="max-w-4xl mx-auto relative bg-white/5 rounded-xl border border-white/10 p-2 focus-within:border-blue-500 transition-colors">
          
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 p-2 bg-black/20 rounded-lg">
              {attachedFiles.map((file, i) => (
                <div key={i} className="flex items-center space-x-2 bg-white/10 hover:bg-white/15 px-2 py-1 rounded text-[10px] transition-colors">
                  <FileText className="w-3 h-3 text-blue-400" />
                  <span className="truncate max-w-[150px] font-mono">{file.name}</span>
                  <button 
                    onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))}
                    className="text-gray-400 hover:text-white rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder="Tanya DeepSeek atau minta bina sesuatu..."
            className="w-full bg-transparent outline-none resize-none text-sm placeholder-gray-600 px-2 pt-2 min-h-[38px] max-h-[40vh] overflow-y-auto"
            rows={1}
            disabled={isLoading}
          />
          <div className="flex justify-between items-center mt-2 px-2 pb-1">
             <div className="flex items-center space-x-2 text-[10px] text-gray-500 font-mono">
               <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  multiple
               />
               <button 
                 onClick={() => fileInputRef.current?.click()}
                 className="hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                 title="Atach file"
               >
                 <Paperclip className="w-4 h-4" />
               </button>
               <span className="ml-2">~{Math.ceil(input.length / 4)} tokens</span>
             </div>
             <div className="flex space-x-2">
               {isLoading && (
                 <button
                   onClick={handleStop}
                   className="bg-red-600/20 hover:bg-red-600/40 text-red-500 border border-red-500/20 p-1.5 rounded-lg active:bg-red-700/50 transition-colors flex items-center space-x-1"
                   title="Stop generating"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="w-4 h-4 text-red-500">
                     <rect x="6" y="6" width="12" height="12"></rect>
                   </svg>
                 </button>
               )}
               <button
                 onClick={handleSend}
                 disabled={(!input.trim() && attachedFiles.length === 0) || isLoading}
                 className="bg-blue-600 hover:bg-blue-500 text-white p-1.5 rounded-lg active:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 transition-colors flex items-center space-x-1"
               >
                 <Send className="w-4 h-4" />
               </button>
             </div>
          </div>
        </div>
        <div className="text-center mt-3">
          <p className="text-[10px] text-gray-500">
            DeepSeek mungkin menghasilkan maklumat tidak tepat. Sila semak semula kod. <br />
            Powered by <a href="https://platform.deepseek.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">DeepSeek API</a>.
          </p>
        </div>
      </div>
      </div>
      </div>
    </div>
  );
}
