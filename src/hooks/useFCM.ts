import { useEffect } from 'react';
import messaging from '@react-native-firebase/messaging';
import DeviceInfo from 'react-native-device-info';
import Toast from 'react-native-toast-message';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/api/auth.api';
import { bankApi } from '@/api/bank.api';
import { speakReceived } from '@/lib/speech';

/** Máy POS quầy = máy Sunmi → nhận báo "đã nhận chuyển khoản" theo đơn (thay loa). */
async function registerIfPos(token: string) {
  try {
    const manufacturer = (await DeviceInfo.getManufacturer()).toLowerCase();
    if (manufacturer.includes('sunmi')) {
      await bankApi.setPosDevice(token, true);
    }
  } catch (err) {
    console.warn('[FCM] register POS error:', err);
  }
}

/**
 * Đăng ký FCM token với backend sau khi đăng nhập.
 * - App đang mở (foreground): hiện Toast
 * - App đóng / background: FCM tự show system notification
 */
export function useFCM() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
          await registerIfPos(token);
        }
      } catch (err) {
        console.warn('[FCM] register error:', err);
      }
    }

    register();

    const unsubRefresh = messaging().onTokenRefresh((token) => {
      authApi.updateFcmToken(token).catch(() => {});
      registerIfPos(token);
    });

    return () => {
      cancelled = true;
      unsubRefresh();
    };
  }, [user?.id]);

  // Foreground: hiện Toast. Báo tiền CK theo đơn (chỉ máy POS nhận) → đọc to
  // "Đã nhận … đồng" như loa + làm mới đơn/chuyển khoản đang hiển thị.
  useEffect(() => {
    const unsub = messaging().onMessage(async (msg) => {
      const title = msg.notification?.title ?? 'Thông báo';
      const body = msg.notification?.body ?? '';
      if (msg.data?.type === 'BANK_PAYMENT') {
        speakReceived(Number(msg.data.amount ?? 0));
        Toast.show({ type: 'success', text1: title, text2: body, visibilityTime: 8000 });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['bank'] });
        if (typeof msg.data.orderId === 'string') {
          queryClient.invalidateQueries({ queryKey: ['order', msg.data.orderId] });
        }
        return;
      }
      Toast.show({ type: 'info', text1: title, text2: body, visibilityTime: 4000 });
    });
    return unsub;
  }, [queryClient]);
}
