
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Session, User } from '@supabase/supabase-js';
import { Profile } from '../types';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfileWithRetry = useCallback(async (user: User, retries = 3): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) {
        // Se o erro é PGRST116, é o erro específico de "nenhuma linha encontrada".
        // Isso é esperado durante a race condition do cadastro.
        if (error.code === 'PGRST116' && retries > 0) {
          console.warn(`Perfil ainda não disponível, tentando novamente... (${retries} tentativas restantes)`);
          // Espera um curto período antes de tentar novamente.
          await new Promise(res => setTimeout(res, 500));
          return fetchProfileWithRetry(user, retries - 1);
        } else {
          // Para outros erros ou se as tentativas acabarem, lança o erro para ser capturado abaixo.
          throw error;
        }
      }
      return data as Profile;

    } catch (error: any) {
      console.error('Erro ao buscar perfil:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    // onAuthStateChange é chamado uma vez no carregamento inicial e depois para qualquer mudança no estado de autenticação.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user) {
          // Se o usuário está logado, busca seu perfil.
          const userProfile = await fetchProfileWithRetry(session.user);
          setProfile(userProfile);
        } else {
          // Se não há usuário, não há perfil.
          setProfile(null);
        }
        // Terminamos de carregar depois que a sessão é verificada e o perfil é buscado.
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfileWithRetry]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { session, user: session?.user ?? null, profile, loading, signOut };
}
