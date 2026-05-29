import { useEffect } from 'react';
import messaging from '@react-native-firebase/messaging';
import Toast from 'react-native-toast-message';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/api/auth.api';

/**
 * Đăng ký FCM token với backend sau khi đăng nhập.
 * Hiển thị Toast khi app đang mở và nhận notification.
 */
export function useFCM() {
  const { user } = useAuth();

  // Đăng ký / refresh token khi user đăng nhập
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function register() {
      try {
        // Xin quyền (Android 13+ và iOS đều cần)
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
        // Không throw — FCM không ảnh hưởng tới app flow
        console.warn('[FCM] register error:', err);
      }
    }

    register();

    // Token refresh (ví dụ: reset app / xoá data)
    const unsubRefresh = messaging().onTokenRefresh((token) => {
      authApi.updateFcmToken(token).catch(() => {});
    });

    return () => {
      cancelled = true;
      unsubRefresh();
    };
  }, [user?.id]);

  // Notification khi app đang mở (foreground)
  useEffect(() => {
    const unsubForeground = messaging().onMessage(async (msg) => {
      const title = msg.notification?.title ?? 'Thông báo';
      const body = msg.notification?.body ?? '';
      Toast.show({ type: 'info', text1: title, text2: body, visibilityTime: 4000 });
    });

    return unsubForeground;
  }, []);
}
