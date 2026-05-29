import { useEffect } from 'react';
import messaging from '@react-native-firebase/messaging';
import Toast from 'react-native-toast-message';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/api/auth.api';

/**
 * Đăng ký FCM token với backend sau khi đăng nhập.
 * - App đang mở (foreground): hiện Toast
 * - App đóng / background: FCM tự show system notification
 */
export function useFCM() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function register() {
      try {
        const status = await messaging().requestPermission();
        const granted =
          status === messaging.AuthorizationStatus.AUTHORIZED ||
          status === messaging.AuthorizationStatus.PROVISIONAL;
        if (!granted) return;

        const token = await messaging().getToken();
        if (token && !cancelled) {
          await authApi.updateFcmToken(token);
        }
      } catch (err) {
        console.warn('[FCM] register error:', err);
      }
    }

    register();

    const unsubRefresh = messaging().onTokenRefresh((token) => {
      authApi.updateFcmToken(token).catch(() => {});
    });

    return () => {
      cancelled = true;
      unsubRefresh();
    };
  }, [user?.id]);

  // Foreground: hiện Toast
  useEffect(() => {
    const unsub = messaging().onMessage(async (msg) => {
      const title = msg.notification?.title ?? 'Thông báo';
      const body = msg.notification?.body ?? '';
      Toast.show({ type: 'info', text1: title, text2: body, visibilityTime: 4000 });
    });
    return unsub;
  }, []);
}
