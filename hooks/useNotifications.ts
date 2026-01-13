
import { useState, useEffect, useCallback, useRef } from 'react';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
    
    // Tenta inicializar o AudioContext silenciosamente
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
    };

    window.addEventListener('click', initAudio, { once: true });
    window.addEventListener('touchstart', initAudio, { once: true });
    
    return () => {
      window.removeEventListener('click', initAudio);
      window.removeEventListener('touchstart', initAudio);
    };
  }, []);

  const playChime = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); 
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5); 

      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.error("Erro AudioContext:", e);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'default';
    const status = await Notification.requestPermission();
    setPermission(status);
    playChime(); // Toca som ao conceder permissão para testar
    return status;
  }, [playChime]);

  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    playChime();

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
            body: options?.body,
            icon: 'https://img.icons8.com/plasticine/100/000000/tow-truck.png',
            badge: 'https://img.icons8.com/plasticine/100/000000/tow-truck.png',
            vibrate: [500, 110, 500, 110, 450, 110, 200, 110, 170, 40, 450, 110, 200, 110, 170, 40],
            requireInteraction: true,
            ...options,
        } as any);

        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch (e) {
        console.warn('Erro ao disparar notificação visual:', e);
      }
    }
  }, [playChime]);

  return { permission, requestPermission, sendNotification, playChime };
}
