
import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Profile } from '../types';

export function useLocationTracking(profile: Profile | null) {
  const watchId = useRef<number | null>(null);
  const lastUpdate = useRef<number>(0);

  useEffect(() => {
    // Apenas motoristas logados rastreiam
    if (!profile || profile.cargo !== 'motorista' || !('geolocation' in navigator)) {
      return;
    }

    const updateLocation = async (position: GeolocationPosition) => {
      const now = Date.now();
      // Evita updates excessivos (mínimo 15 segundos entre cada um)
      if (now - lastUpdate.current < 15000) return;

      const { latitude, longitude } = position.coords;
      
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            lat: latitude,
            lng: longitude,
            last_seen: new Date().toISOString()
          })
          .eq('id', profile.id);

        if (!error) {
          lastUpdate.current = now;
        }
      } catch (err) {
        console.error('Erro ao atualizar GPS:', err);
      }
    };

    const handleError = (error: GeolocationPositionError) => {
      console.warn('Erro na geolocalização:', error.message);
    };

    // Solicita permissão e inicia monitoramento
    watchId.current = navigator.geolocation.watchPosition(
      updateLocation,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 10000,
      }
    );

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [profile]);
}
