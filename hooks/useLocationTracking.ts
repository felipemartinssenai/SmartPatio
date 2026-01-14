
import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Profile } from '../types';

export function useLocationTracking(profile: Profile | null) {
  const watchId = useRef<number | null>(null);
  const lastUpdate = useRef<number>(0);

  useEffect(() => {
    // Apenas motoristas logados rastreiam
    if (!profile || profile.cargo !== 'motorista' || !('geolocation' in navigator)) {
      if (profile?.cargo === 'motorista') {
          console.warn('[GPS] Geolocalização não suportada ou perfil inválido.');
      }
      return;
    }

    const updateLocation = async (position: GeolocationPosition) => {
      const now = Date.now();
      // Evita updates excessivos (mínimo 10 segundos entre cada um para maior precisão inicial)
      if (now - lastUpdate.current < 10000) return;

      const { latitude, longitude, accuracy } = position.coords;
      
      console.log(`[GPS] Enviando posição: ${latitude}, ${longitude} (Precisão: ${accuracy}m)`);
      
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            lat: latitude,
            lng: longitude,
            last_seen: new Date().toISOString()
          })
          .eq('id', profile.id);

        if (error) {
            console.error('[GPS] Erro ao atualizar no banco:', error.message);
        } else {
            lastUpdate.current = now;
            console.log('[GPS] Sincronizado com sucesso.');
        }
      } catch (err) {
        console.error('[GPS] Erro crítico:', err);
      }
    };

    const handleError = (error: GeolocationPositionError) => {
      const msgs = {
          1: "Permissão negada pelo usuário.",
          2: "Posição indisponível (GPS desligado?).",
          3: "Tempo de busca esgotado."
      };
      console.warn('[GPS] Erro:', msgs[error.code as keyof typeof msgs] || error.message);
    };

    // Inicia monitoramento
    console.log('[GPS] Iniciando rastreamento em tempo real...');
    watchId.current = navigator.geolocation.watchPosition(
      updateLocation,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0, // Forçar pegar a posição mais atual
      }
    );

    return () => {
      if (watchId.current !== null) {
        console.log('[GPS] Parando rastreamento.');
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [profile]);
}
