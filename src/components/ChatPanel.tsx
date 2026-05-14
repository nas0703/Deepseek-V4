import { Message, ModelOption, ChatMode } from '../types/chat';
import React, { useState, useRef, useEffect } from 'react';
import { sendMessageToDeepSeek } from '../lib/deepseek';
import { Send, Trash2, Bot, User, Loader2, AlertCircle, FileCode, Settings2, X, Paperclip, FileText } from 'lucide-react';
import { ProjectFile } from '../types/project';
import { parseAIResponse } from '../lib/parse-ai-response';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface ChatPanelProps {
  onFilesGenerated?: (files: ProjectFile[]) => void;
}

export function ChatPanel({ onFilesGenerated }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState<ModelOption>('deepseek-v4-flash');
  const [mode, setMode] = useState<ChatMode>('Generate Code');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [temperature, setTemperature] = useState<number>(0.7);
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  
  // Saved System Prompts
  const [savedPrompts, setSavedPrompts] = useState<{id: string, name: string, content: string}[]>([]);

  useEffect(() => {
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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

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

      const assistantMsgRaw = await sendMessageToDeepSeek(payloadMessages, model, mode, {
        temperature,
        systemPrompt: systemPrompt.trim() || undefined
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
        parsedAction
      };
      
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setError(err.message || "Gagal menghantar mesej.");
    } finally {
      setIsLoading(false);
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
    <div className="flex flex-col h-full bg-[#0d0d0d] text-gray-300 font-sans overflow-hidden">
      {/* Header */}
      <header className="h-12 border-b border-white/5 flex items-center justify-between px-3 bg-[#0a0a0a] shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-xs font-bold uppercase tracking-wider hidden lg:inline">Chat</span>
        </div>
        
        <div className="flex items-center gap-2 justify-end">
          <div className="flex items-center bg-white/5 rounded-md px-1.5 py-1 border border-white/10">
             <span className="hidden xl:inline text-[9px] uppercase tracking-wider text-gray-500 mr-1">Model</span>
             <select 
               value={model} 
               onChange={(e) => setModel(e.target.value as ModelOption)}
               className="bg-transparent text-[10px] sm:text-xs text-white outline-none cursor-pointer"
             >
               <option value="deepseek-v4-flash">deepseek-v4-flash</option>
               <option value="deepseek-v4-pro">deepseek-v4-pro</option>
             </select>
          </div>
          
          <div className="flex items-center bg-white/5 rounded-md px-1.5 py-1 border border-white/10">
             <span className="hidden xl:inline text-[9px] uppercase tracking-wider text-gray-500 mr-1">Mode</span>
             <select 
               value={mode} 
               onChange={(e) => setMode(e.target.value as ChatMode)}
               className="bg-transparent text-[10px] sm:text-xs text-white outline-none cursor-pointer"
             >
               <option value="General Chat">General Chat</option>
               <option value="Generate Code">Generate Code</option>
               <option value="Fix Error">Fix Error</option>
               <option value="Build Full App">Build Full App</option>
             </select>
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
              <div className="space-x-2">
                <select 
                  onChange={(e) => {
                    const found = savedPrompts.find(p => p.id === e.target.value);
                    if (found) setSystemPrompt(found.content);
                  }}
                  className="bg-white/5 border border-white/10 rounded px-2 py-1 text-[10px] text-white outline-none"
                >
                  <option value="">-- Template Disimpan --</option>
                  {savedPrompts.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button 
                  onClick={handleSavePrompt}
                  disabled={!systemPrompt.trim()}
                  className="bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 px-2 py-1 space-x-1 rounded text-[10px] disabled:opacity-50 transition-colors"
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
                    {msg.usage && (
                      <div className="text-[10px] text-gray-500 font-mono mt-2 flex justify-end">
                        <span className="bg-black/20 px-2 py-0.5 rounded">Tokens: Input {msg.usage.prompt_tokens} + Output {msg.usage.completion_tokens} = Total {msg.usage.total_tokens}</span>
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
                    {msg.usage && (
                      <div className="text-[10px] text-gray-500 font-mono mt-2 flex justify-end">
                        <span className="bg-black/20 px-2 py-0.5 rounded">Tokens: Input {msg.usage.prompt_tokens} + Output {msg.usage.completion_tokens} = Total {msg.usage.total_tokens}</span>
                      </div>
                    )}
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
                    {msg.usage && (
                      <div className="text-[10px] text-gray-500 font-mono mt-2 flex justify-end">
                        <span className="bg-black/20 px-2 py-0.5 rounded">Tokens: Input {msg.usage.prompt_tokens} + Output {msg.usage.completion_tokens} = Total {msg.usage.total_tokens}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
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
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tanya DeepSeek atau minta bina sesuatu..."
            className="w-full bg-transparent outline-none resize-none text-sm placeholder-gray-600 px-2 pt-1 h-16"
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
             <button
               onClick={handleSend}
               disabled={(!input.trim() && attachedFiles.length === 0) || isLoading}
               className="bg-blue-600 hover:bg-blue-500 text-white p-1.5 rounded-lg active:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 transition-colors flex items-center space-x-1"
             >
               <Send className="w-4 h-4" />
             </button>
          </div>
        </div>
        <div className="text-center mt-3">
          <p className="text-[10px] text-gray-500">
            DeepSeek mungkin menghasilkan maklumat tidak tepat. Sila semak semula kod.
          </p>
        </div>
      </div>
    </div>
  );
}
