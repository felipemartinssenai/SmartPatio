
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
      // Não resetamos o loading para true se já tivermos um perfil, 
      // para evitar que a tela de loading apareça em atualizações de fundo
      if (!profile) setLoading(true);
      
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profileError) {
        console.warn('Falha temporária ao sincronizar perfil:', profileError.message);
        // Se já temos um perfil no estado, não o removemos por erro de conexão
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
    setLoading(true);
    try {
      await supabase.auth.signOut();
      window.localStorage.removeItem('patiolog-auth-v2-stable');
      setSession(null);
      setProfile(null);
      window.location.href = '/'; 
    } catch (e) {
      window.localStorage.clear();
      window.location.reload();
    } finally {
      setLoading(false);
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
