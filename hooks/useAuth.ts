
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Profile } from '../types';

export function useAuth() {
  const [session, setSession] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfileWithRetry = useCallback(async (user: any, retries = 5): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116' && retries > 0) {
          console.warn(`Aguardando perfil ser criado... (${retries} tentativas restantes)`);
          await new Promise(res => setTimeout(res, 1000));
          return fetchProfileWithRetry(user, retries - 1);
        } else {
          throw error;
        }
      }
      
      const profileData = data as Profile;
      return {
        ...profileData,
        permissions: profileData.permissions || []
      };

    } catch (error: any) {
      console.error('Erro fatal ao buscar perfil:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    
    // Inicia carregando
    setLoading(true);
    
    // Recuperar sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      if (session?.user) {
        fetchProfileWithRetry(session.user).then(p => {
          if (!mounted) return;
          setProfile(p);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange(
      async (event: string, session: any) => {
        if (!mounted) return;
        
        // CRITICAL: Set loading to true immediately when auth state changes 
        // to prevent flickering the "Profile not found" screen.
        setLoading(true);
        
        setSession(session);
        if (session?.user) {
          const userProfile = await fetchProfileWithRetry(session.user);
          if (mounted) {
            setProfile(userProfile);
            setLoading(false);
          }
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfileWithRetry]);

  const signOut = async () => {
    try {
      await (supabase.auth as any).signOut();
      setSession(null);
      setProfile(null);
      window.localStorage.removeItem('patiolog-session-v1');
    } catch (error) {
      console.error("Erro ao realizar logout:", error);
      setSession(null);
      setProfile(null);
    }
  };

  return { session, user: session?.user ?? null, profile, loading, signOut };
}
