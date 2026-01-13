
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Profile } from '../types';

export function useAuth() {
  // Use any for session to bypass problematic type exports in this environment
  const [session, setSession] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Use any for user parameter to avoid missing type export issues
  const fetchProfileWithRetry = useCallback(async (user: any, retries = 5): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) {
        // Erro PGRST116: Nenhuma linha encontrada.
        // Tentamos novamente para dar tempo ao Trigger do Postgres.
        if (error.code === 'PGRST116' && retries > 0) {
          console.warn(`Aguardando perfil ser criado... (${retries} tentativas restantes)`);
          await new Promise(res => setTimeout(res, 1000)); // Espera 1 segundo
          return fetchProfileWithRetry(user, retries - 1);
        } else {
          throw error;
        }
      }
      
      // Sanitização defensiva: Garante que permissions seja um array
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
    setLoading(true);
    // Cast to any to bypass the error where onAuthStateChange is reported as missing on SupabaseAuthClient
    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange(
      async (event: string, session: any) => {
        setSession(session);
        if (session?.user) {
          const userProfile = await fetchProfileWithRetry(session.user);
          setProfile(userProfile);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfileWithRetry]);

  const signOut = async () => {
    // Cast to any to bypass the error where signOut is reported as missing on SupabaseAuthClient
    await (supabase.auth as any).signOut();
    window.location.reload(); // Limpa estados residuais
  };

  return { session, user: session?.user ?? null, profile, loading, signOut };
}
