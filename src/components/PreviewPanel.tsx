import { useState, useEffect, useRef, useMemo } from 'react';
import { ProjectFile } from '../types/project';
import { buildPreviewHtml } from '../lib/build-preview-html';
import { RefreshCw, Play, AlertCircle } from 'lucide-react';
import { SandpackProvider, SandpackLayout, SandpackPreview } from '@codesandbox/sandpack-react';

interface PreviewPanelProps {
  files: ProjectFile[];
}

export function PreviewPanel({ files }: PreviewPanelProps) {
  const [htmlPreview, setHtmlPreview] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isPreviewTypeReact, setIsPreviewTypeReact] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [key, setKey] = useState(0);

  const updatePreview = () => {
    try {
      const htmlContent = buildPreviewHtml(files);
      if (htmlContent === null) {
        setIsPreviewTypeReact(true);
        setHtmlPreview('');
      } else {
        setIsPreviewTypeReact(false);
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        setHtmlPreview(url);
        setError(null);
      }
    } catch (err: any) {
      setError(err.message || 'Error generating preview');
    }
  };

  useEffect(() => {
    // Debounce preview updates
    const timeout = setTimeout(() => {
      updatePreview();
    }, 1000);
    return () => clearTimeout(timeout);
  }, [files]);

  const handleRefresh = () => {
    if (isPreviewTypeReact) {
       setKey(k => k + 1);
    } else {
       updatePreview();
    }
  };

  const sandpackFiles = useMemo(() => {
    const fileMap: Record<string, string> = {};
    files.forEach(f => {
      let path = f.path;
      if (!path.startsWith('/')) path = '/' + path;
      fileMap[path] = f.content;
    });

    // We can inject tailwind if we notice it's needed but missing from sandpack config. 
    // Usually we use vite template which supports standard tools.
    // If we have package.json dependencies, Sandpack reads them if we provide it!
    return fileMap;
  }, [files]);

  return (
    <div className="flex flex-col h-full bg-[#121212] overflow-hidden shrink-0">
      <div className="h-9 border-b border-white/5 bg-[#0d0d0d] flex items-center justify-between px-3 text-[10px] uppercase tracking-widest text-gray-500 font-bold shrink-0">
        <span>Preview</span>
        <button onClick={handleRefresh} className="hover:text-white transition-colors" title="Refresh">
            <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      <div className="flex-1 relative bg-white overflow-hidden">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-4 bg-[#0a0a0a] text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 mr-2" />
            {error}
          </div>
        ) : isPreviewTypeReact ? (
          <div className="absolute inset-0 bg-white" key={key}>
             {Object.keys(sandpackFiles).length > 0 ? (
                <SandpackProvider 
                  template="vite-react-ts" 
                  theme="dark"
                  files={sandpackFiles}
                  customSetup={{
                     dependencies: {
                        "lucide-react": "^0.300.0",
                        "clsx": "^2.1.0",
                        "tailwind-merge": "^2.2.0",
                        "tailwindcss": "^3.4.0",
                        "postcss": "^8.4.0",
                        "autoprefixer": "^10.4.0"
                     }
                  }}
                >
                  <SandpackLayout style={{ height: '100%', border: 'none', borderRadius: 0 }}>
                    <SandpackPreview showRefreshButton={false} showOpenInCodeSandbox={false} style={{ height: '100%' }} />
                  </SandpackLayout>
                </SandpackProvider>
             ) : (
                <div className="flex items-center justify-center h-full bg-[#0a0a0a] text-xs text-gray-600">
                  Loading Sandpack...
                </div>
             )}
          </div>
        ) : htmlPreview ? (
          <iframe
            ref={iframeRef}
            src={htmlPreview}
            className="w-full h-full border-none bg-white"
            title="Preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a] text-xs text-gray-600 px-4 text-center">
            {files.length === 0 ? 'Minta AI mula menulis kod untuk melihat preview.' : 'Menjana preview...'}
          </div>
        )}
      </div>
    </div>
  );
}
