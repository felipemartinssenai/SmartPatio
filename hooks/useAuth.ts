
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Profile } from '../types';

export function useAuth() {
  const [session, setSession] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      setError(null);
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profileError) {
        // Se o perfil não existe, pode ser delay da trigger
        console.warn('Perfil não encontrado, tentando novamente em 2s...');
        throw new Error(profileError.message || 'Perfil não localizado na base de dados.');
      }
      
      setProfile(data as Profile);
    } catch (err: any) {
      const msg = err.message || 'Erro desconhecido ao carregar permissões.';
      console.error('Erro ao carregar perfil:', msg);
      setError(msg);
      // Se falhar drasticamente, limpa para não travar o app
      setProfile(null);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    window.localStorage.removeItem('patiolog-auth-v2-stable');
    setSession(null);
    setProfile(null);
    setError(null);
    setLoading(false);
    window.location.href = '/'; 
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession) {
        setSession(currentSession);
        await fetchProfile(currentSession.user.id);
      }
      setLoading(false);
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setSession(currentSession);
          if (currentSession?.user) {
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
