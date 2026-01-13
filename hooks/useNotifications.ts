
import { useState, useEffect, useCallback, useRef } from 'react';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const playChime = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5); // A4

      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.error("Falha ao tocar som:", e);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'default';
    const status = await Notification.requestPermission();
    setPermission(status);
    return status;
  }, []);

  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    // Tenta tocar o som independente da permissão de notificação (precisa de interação prévia com a página)
    playChime();

    if (!('Notification' in window) || Notification.permission !== 'granted') {
      console.warn('Notificação visual bloqueada pelo sistema.');
      return;
    }
    
    const notification = new Notification(title, {
        body: options?.body,
        icon: 'https://img.icons8.com/plasticine/100/000000/tow-truck.png',
        vibrate: [500, 200, 500],
        requireInteraction: true,
        ...options,
    } as any);

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }, [playChime]);

  return { permission, requestPermission, sendNotification, playChime };
}
