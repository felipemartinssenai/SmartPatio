
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Profile } from '../types';

export function useAuth() {
  const [session, setSession] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isInitialMount = useRef(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      if (!profile) setLoading(true);
      
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profileError) {
        console.warn('Falha temporária ao sincronizar perfil:', profileError.message);
        if (!profile) setError(profileError.message);
      } else if (data) {
        setProfile(data as Profile);
        setError(null);
      }
    } catch (err: any) {
      console.error('Erro crítico no fetchProfile:', err.message);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  const handleLogout = useCallback(async () => {
    // 1. Limpa o estado local IMEDIATAMENTE para a UI reagir
    setSession(null);
    setProfile(null);
    setLoading(false);
    
    try {
      // 2. Tenta deslogar no servidor em segundo plano
      await supabase.auth.signOut();
      // 3. Limpa caches físicos
      window.localStorage.removeItem('patiolog-auth-v2-stable');
      window.localStorage.removeItem('last_page');
    } catch (e) {
      console.warn('Erro ao limpar sessão no servidor, limpando localmente apenas.');
      window.localStorage.clear();
    }
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (currentSession) {
          setSession(currentSession);
          await fetchProfile(currentSession.user.id);
        } else {
          setLoading(false);
        }
      } catch (e) {
        console.error('Erro na inicialização da sessão:', e);
        setLoading(false);
      }
    };

    if (isInitialMount.current) {
      initializeAuth();
      isInitialMount.current = false;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setSession(currentSession);
          if (currentSession?.user) {
            await fetchProfile(currentSession.user.id);
          }
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  return { 
    session, 
    user: session?.user ?? null, 
    profile, 
    loading, 
    error,
    retry: () => session?.user && fetchProfile(session.user.id),
    signOut: handleLogout 
  };
}
