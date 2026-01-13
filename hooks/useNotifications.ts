
import { useState, useEffect, useCallback, useRef } from 'react';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
    
    // Tenta inicializar o AudioContext silenciosamente no primeiro toque do usuário
    const initAudio = () => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
        }
        console.log("AudioContext desbloqueado com sucesso.");
      } catch (e) {
        console.error("Falha ao iniciar AudioContext:", e);
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
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
      }
      const ctx = audioContextRef.current;
      
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Som estilo Sirene/Alerta (Mais audível no celular)
      const playTone = (startTime: number, freq: number, duration: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle'; 
          osc.frequency.setValueAtTime(freq, startTime);
          osc.frequency.exponentialRampToValueAtTime(freq * 1.5, startTime + duration);
          
          gain.gain.setValueAtTime(0, startTime);
          gain.gain.linearRampToValueAtTime(0.5, startTime + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(startTime);
          osc.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      playTone(now, 880, 0.4);
      playTone(now + 0.5, 880, 0.4);

    } catch (e) {
      console.error("Erro ao reproduzir som:", e);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
        console.warn("Este navegador não suporta notificações.");
        return 'denied';
    }
    const status = await Notification.requestPermission();
    setPermission(status);
    if (status === 'granted') {
        playChime();
        // Dispara uma notificação de teste para confirmar
        new Notification("PátioLog Ativo", { body: "Você receberá alertas de novas coletas aqui.", icon: 'https://img.icons8.com/plasticine/100/000000/tow-truck.png' });
    }
    return status;
  }, [playChime]);

  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    // Toca o som localmente sempre
    playChime();

    // Dispara a notificação de sistema se houver permissão
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const n = new Notification(title, {
            body: options?.body,
            icon: 'https://img.icons8.com/plasticine/100/000000/tow-truck.png',
            badge: 'https://img.icons8.com/plasticine/100/000000/tow-truck.png',
            vibrate: [500, 110, 500, 110, 450, 110, 200, 110, 170, 40, 450, 110, 200, 110, 170, 40, 500],
            requireInteraction: true,
            tag: options?.tag || 'patiolog-new-collection',
            renotify: true,
            ...options,
        } as any);

        n.onclick = () => {
          window.focus();
          n.close();
        };
      } catch (e) {
        console.warn('Erro ao disparar notificação visual:', e);
      }
    }
  }, [playChime]);

  return { permission, requestPermission, sendNotification, playChime };
}
