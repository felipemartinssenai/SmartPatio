
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
      setLoading(true);
      setError(null);
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profileError) {
        // Se o erro for "não encontrado", pode ser que a trigger ainda não criou o perfil
        console.error('Erro ao buscar perfil:', profileError.message);
        setError(profileError.message);
        setProfile(null);
      } else if (data) {
        setProfile(data as Profile);
      }
    } catch (err: any) {
      console.error('Erro crítico no fetchProfile:', err.message);
      setError(err.message);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

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
      setLoading(true);
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
        if (event === 'SIGNED_IN') {
          setSession(currentSession);
          if (currentSession?.user) {
            await fetchProfile(currentSession.user.id);
          }
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setProfile(null);
          setLoading(false);
        } else if (event === 'TOKEN_REFRESHED') {
          setSession(currentSession);
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
