
import { useState, useEffect, useCallback } from 'react';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.warn('Este navegador não suporta notificações de desktop.');
      return;
    }
    const status = await Notification.requestPermission();
    setPermission(status);
    return status;
  }, []);

  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      console.warn('Notificações não permitidas ou não suportadas.');
      return;
    }
    
    // Fix: Using 'as any' for the options object because properties like 'vibrate' and 'badge' 
    // are not officially part of the standard W3C NotificationOptions type in many TS configurations,
    // despite being supported by various modern browsers (especially on mobile/PWA).
    const notification = new Notification(title, {
        body: options?.body,
        icon: 'https://img.icons8.com/plasticine/100/000000/tow-truck.png',
        badge: 'https://img.icons8.com/plasticine/100/000000/tow-truck.png',
        vibrate: [200, 100, 200, 100, 200], // Padrão de vibração para alertar o motorista
        requireInteraction: true, // Mantém a notificação até o usuário clicar
        ...options,
    } as any);

    notification.onclick = function(event) {
      event.preventDefault();
      window.focus();
      notification.close();
    };

  }, []);

  return { permission, requestPermission, sendNotification };
}
