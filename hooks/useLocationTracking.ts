
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';
import { Profile } from '../types';

export function useLocationTracking(profile: Profile | null) {
  const watchId = useRef<number | null>(null);
  const lastUpdate = useRef<number>(0);
  const [gpsStatus, setGpsStatus] = useState<'searching' | 'active' | 'denied' | 'error'>('searching');

  useEffect(() => {
    if (!profile || profile.cargo !== 'motorista' || !('geolocation' in navigator)) {
      setGpsStatus('denied');
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
        setGpsStatus('error');
      }
    };

    const updateLocation = (position: GeolocationPosition) => {
      const now = Date.now();
      // Envia atualizações com throttle de 10 segundos (comportamento original)
      if (lastUpdate.current !== 0 && now - lastUpdate.current < 10000) return;
      
      sendPositionToSupabase(position.coords.latitude, position.coords.longitude);
    };

    const handleError = (error: GeolocationPositionError) => {
      if (error.code === 1) setGpsStatus('denied');
      else setGpsStatus('error');
    };

    watchId.current = navigator.geolocation.watchPosition(
      updateLocation,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [profile?.id]);

  return { gpsStatus };
}
