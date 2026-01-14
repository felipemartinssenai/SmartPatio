
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

        if (error) {
            console.error('[GPS] Erro no Supabase:', error.message);
            setGpsStatus('error');
        } else {
          lastUpdate.current = Date.now();
          setGpsStatus('active');
        }
      } catch (err) {
        setGpsStatus('error');
      }
    };

    const updateLocation = (position: GeolocationPosition) => {
      const now = Date.now();
      // Envia atualizações a cada 10 segundos para economizar bateria
      // Exceto na primeira vez (lastUpdate será 0)
      if (lastUpdate.current !== 0 && now - lastUpdate.current < 10000) return;
      sendPositionToSupabase(position.coords.latitude, position.coords.longitude);
    };

    const handleError = (error: GeolocationPositionError) => {
      if (error.code === 1) setGpsStatus('denied');
      else setGpsStatus('error');
    };

    // Força captura imediata ao iniciar
    navigator.geolocation.getCurrentPosition(
      (pos) => sendPositionToSupabase(pos.coords.latitude, pos.coords.longitude),
      handleError,
      { enableHighAccuracy: true, timeout: 5000 }
    );

    // Monitoramento contínuo
    watchId.current = navigator.geolocation.watchPosition(
      updateLocation,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
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
