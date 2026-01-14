
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import { Profile } from '../types';

export function useLocationTracking(profile: Profile | null) {
  const watchId = useRef<number | null>(null);
  const lastUpdate = useRef<number>(0);
  const [gpsStatus, setGpsStatus] = useState<'searching' | 'active' | 'denied' | 'error'>('searching');

  useEffect(() => {
    if (!profile || profile.cargo !== 'motorista' || !('geolocation' in navigator)) {
      return;
    }

    const sendPositionToSupabase = async (latitude: number, longitude: number) => {
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
          lastUpdate.current = Date.now();
          setGpsStatus('active');
        }
      } catch (err) {
        console.error('[GPS] Erro crítico:', err);
        setGpsStatus('error');
      }
    };

    const updateLocation = (position: GeolocationPosition) => {
      const now = Date.now();
      // Envia atualizações a cada 10 segundos para economizar bateria e banda
      if (now - lastUpdate.current < 10000) return;
      sendPositionToSupabase(position.coords.latitude, position.coords.longitude);
    };

    const handleError = (error: GeolocationPositionError) => {
      if (error.code === 1) setGpsStatus('denied');
      else setGpsStatus('error');
    };

    // 1. Forçar uma captura imediata ao entrar (Wake up)
    navigator.geolocation.getCurrentPosition(
      (pos) => sendPositionToSupabase(pos.coords.latitude, pos.coords.longitude),
      handleError,
      { enableHighAccuracy: true }
    );

    // 2. Iniciar monitoramento contínuo
    watchId.current = navigator.geolocation.watchPosition(
      updateLocation,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [profile]);

  return { gpsStatus };
}
