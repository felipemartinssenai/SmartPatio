
// FIX: Corrected the import statement to properly include `useCallback`.
import { useState, useEffect, useCallback } from 'react';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    // Check permission status on component mount
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      alert('Este navegador não suporta notificações de desktop.');
      return;
    }
    // The promise-based API is more modern
    const status = await Notification.requestPermission();
    setPermission(status);
  }, []);

  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!('Notification' in window) || permission !== 'granted') {
      return;
    }
    
    const notification = new Notification(title, {
        body: options?.body,
        icon: 'https://img.icons8.com/plasticine/100/000000/tow-truck.png', // App icon
        ...options,
    });

    // Optional: close notification after some time
    setTimeout(() => notification.close(), 5000);

  }, [permission]);

  return { permission, requestPermission, sendNotification };
}
