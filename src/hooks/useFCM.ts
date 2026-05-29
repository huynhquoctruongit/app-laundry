import { useEffect } from 'react';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/api/auth.api';

const CHANNEL_ID = 'orders';

/** Tạo notification channel một lần (Android 8+) */
async function ensureChannel() {
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Đơn hàng',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });
}

/** Hiện system notification thật (dùng cho cả foreground) */
export async function displayNotification(title: string, body: string) {
  await ensureChannel();
  await notifee.displayNotification({
    title,
    body,
    android: {
      channelId: CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      pressAction: { id: 'default' },
    },
  });
}

/**
 * Đăng ký FCM token với backend sau khi đăng nhập.
 * Dùng notifee để hiện notification thật kể cả khi app đang mở.
 */
export function useFCM() {
  const { user } = useAuth();

  // Tạo channel ngay khi hook mount
  useEffect(() => {
    ensureChannel().catch(() => {});
  }, []);

  // Đăng ký / refresh token khi user đăng nhập
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

  // Foreground: dùng notifee hiện notification thật
  useEffect(() => {
    const unsubForeground = messaging().onMessage(async (msg) => {
      const title = msg.notification?.title ?? 'Thông báo';
      const body = msg.notification?.body ?? '';
      await displayNotification(title, body);
    });

    return unsubForeground;
  }, []);
}
