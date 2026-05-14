import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase-client';
import { ProjectFile } from '../types/project';
import { Folder, Plus, Save, RefreshCw } from 'lucide-react';
import { User } from '@supabase/supabase-js';

export interface Project {
  id: string;
  name: string;
  description: string | null;
}

interface ProjectSidebarProps {
  onLoadProject: (projectId: string) => void;
  activeProjectId: string | null;
  onNewProject: () => void;
}

export function ProjectSidebar({ onLoadProject, activeProjectId, onNewProject }: ProjectSidebarProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProjects();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProjects();
      } else {
        setProjects([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, description')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setProjects(data);
    }
    setLoading(false);
  };

  const handleCreateProject = async () => {
    if (!user) return alert('Sila login dahulu.');
    const name = prompt('Nama Projek Baru:');
    if (!name) return;

    const { data, error } = await supabase
      .from('projects')
      .insert({ name, user_id: user.id })
      .select()
      .single();

    if (error) {
      console.error(error);
      alert('Gagal mencipta projek.');
    } else if (data) {
      setProjects([data, ...projects]);
      onLoadProject(data.id);
    }
  };

  if (!user) {
    return (
      <div className="p-4 text-center text-xs text-gray-500">
        Login untuk urus projek.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] border-r border-white/10 shrink-0 select-none">
      <div className="flex items-center justify-between p-3 text-[10px] uppercase tracking-widest text-gray-500 font-bold border-b border-white/5">
        <span>Projects</span>
        <div className="flex space-x-1">
          <button onClick={fetchProjects} className="hover:text-white transition-colors" title="Refresh">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={handleCreateProject} className="hover:text-white transition-colors" title="New Project">
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {projects.map(proj => (
          <div 
            key={proj.id}
            onClick={() => onLoadProject(proj.id)}
            className={`group flex items-center px-4 py-2 cursor-pointer text-xs transition-colors ${
              activeProjectId === proj.id 
                ? 'bg-blue-500/10 text-blue-400 border-r-2 border-blue-500' 
                : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
            }`}
          >
            <Folder className="w-4 h-4 mr-2 opacity-70" />
            <div className="truncate flex-1">{proj.name}</div>
          </div>
        ))}
        {projects.length === 0 && !loading && (
          <div className="px-4 py-8 text-center text-xs text-gray-600">
            Tiada projek.
          </div>
        )}
      </div>
    </div>
  );
}
