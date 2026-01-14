
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Profile } from '../types';

export function useAuth() {
  const [session, setSession] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      setProfile(data as Profile);
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    window.localStorage.removeItem('patiolog-auth-token-v2');
    setSession(null);
    setProfile(null);
    setLoading(false);
    window.location.href = '/'; 
  }, []);

  useEffect(() => {
    // 1. Verificar sessão existente imediatamente (Persistência)
    const checkSession = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession) {
        setSession(currentSession);
        await fetchProfile(currentSession.user.id);
      }
      setLoading(false);
    };

    checkSession();

    // 2. Ouvir mudanças (Login/Logout/Refresh de Token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setSession(currentSession);
          if (currentSession?.user && !profile) {
            await fetchProfile(currentSession.user.id);
          }
          setLoading(false);
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile, profile]);

  return { 
    session, 
    user: session?.user ?? null, 
    profile, 
    loading, 
    signOut: handleLogout 
  };
}
