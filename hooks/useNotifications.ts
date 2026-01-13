
import { useState, useEffect, useCallback, useRef } from 'react';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
    
    // Tenta inicializar o AudioContext silenciosamente no primeiro toque
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

      // Som estilo Alerta (Bip duplo)
      const playBip = (startTime: number, freq: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square'; // Som mais 'cortante' para notificações
          osc.frequency.setValueAtTime(freq, startTime);
          gain.gain.setValueAtTime(0.3, startTime);
          gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(startTime);
          osc.stop(startTime + 0.2);
      };

      playBip(ctx.currentTime, 880);
      playBip(ctx.currentTime + 0.3, 1100);

    } catch (e) {
      console.error("Erro AudioContext:", e);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'default';
    const status = await Notification.requestPermission();
    setPermission(status);
    if (status === 'granted') playChime();
    return status;
  }, [playChime]);

  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    // Toca o som localmente
    playChime();

    // Dispara a notificação de sistema se houver permissão
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
            body: options?.body,
            icon: 'https://img.icons8.com/plasticine/100/000000/tow-truck.png',
            badge: 'https://img.icons8.com/plasticine/100/000000/tow-truck.png',
            // Vibração padrão: [espera, vibra, espera, vibra...]
            vibrate: [200, 100, 200, 100, 200, 100, 400],
            requireInteraction: true,
            tag: options?.tag || 'patiolog-alert',
            renotify: true,
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
