import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase-client';
import { User } from '@supabase/supabase-js';
import { LogIn, LogOut, Github } from 'lucide-react';

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.origin,
      }
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (user) {
    return (
      <button 
        onClick={handleLogout}
        className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-md text-xs transition-colors border border-white/10"
      >
        <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-4 h-4 rounded-full" />
        <span>Logout</span>
      </button>
    );
  }

  return (
    <button 
      onClick={handleLogin}
      className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md text-xs transition-colors"
    >
      <Github className="w-3.5 h-3.5" />
      <span>Login</span>
    </button>
  );
}
