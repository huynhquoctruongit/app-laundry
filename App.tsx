import React, { useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Keyboard,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AuthProvider } from '@/hooks/useAuth';
import { RootNavigator } from '@/navigation/RootNavigator';
import { useFCM } from '@/hooks/useFCM';
import { navigationRef } from '@/navigation/navigationRef';
import { PrinterService } from '@/native/printer/PrinterService';
import {
  getScannerOverride,
  registerScannerToggle,
} from '@/native/scanner-bridge';
import { BarcodeOrderModal } from '@/components/common/BarcodeOrderModal';
import { BarcodeSuccessModal } from '@/components/common/BarcodeSuccessModal';
import { orderApi } from '@/api/order.api';
import { extractError } from '@/api/client';
import { colors } from '@/theme/colors';
import type { Order } from '@/types/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

const SCANNER_PREF_KEY = 'scanner_active_v1';

/** Gọi useFCM bên trong AuthProvider để có access vào user context */
function FCMRegistrar() {
  useFCM();
  return null;
}

export default function App() {
  const scanRef = useRef<TextInput>(null);
  const [scanBuffer, setScanBuffer] = useState('');
  const scanTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const refocusTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Scanner toggle — OFF mặc định để tránh focus battle (double-tap).
  // User bật bằng FAB ở góc dưới phải khi muốn quét.
  const [scannerActive, setScannerActive] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [scannedOrder, setScannedOrder] = useState<Order | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  // Modal hiển thị khi auto-hoàn thành đơn thành công — tự tắt sau 3s
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);

  // Auto-detect máy in (Sunmi built-in hoặc BT đã lưu)
  useEffect(() => {
    PrinterService.autoDetect().catch(() => {});
  }, []);

  // Load trạng thái scanner đã lưu
  useEffect(() => {
    AsyncStorage.getItem(SCANNER_PREF_KEY)
      .then((v) => {
        if (v === '1') setScannerActive(true);
      })
      .catch(() => {});
  }, []);

  // Đăng ký toggle/getter để các screen khác (vd audit) có thể bật/tắt scanner
  useEffect(() => {
    registerScannerToggle(setScannerActive, () => scannerActive);
  }, [scannerActive]);

  // Khi toggle scanner — focus hoặc blur hidden input
  useEffect(() => {
    AsyncStorage.setItem(SCANNER_PREF_KEY, scannerActive ? '1' : '0').catch(() => {});
    if (scannerActive) {
      // Delay để khỏi đè lên user tap khi mới toggle
      setTimeout(() => scanRef.current?.focus(), 100);
    } else {
      scanRef.current?.blur();
    }
  }, [scannerActive]);

  async function processBarcode(code: string) {
    const trimmed = code.trim();
    if (!trimmed || trimmed.length < 2) return;

    // 0. Nếu có screen override (vd OrderAuditScreen) → delegate cho nó
    const override = getScannerOverride();
    if (override) {
      override(trimmed);
      return;
    }

    // 1. Tìm đơn
    let order: Order | null = null;
    try {
      const result = await orderApi.list({ search: trimmed, pageSize: 10 });
      order = result.items.find((o) => o.code === trimmed) ?? null;
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Không kết nối được server',
        text2: extractError(err).message,
      });
      return;
    }

    if (!order) {
      Toast.show({
        type: 'error',
        text1: 'Không tìm thấy đơn',
        text2: trimmed,
      });
      return;
    }

    // 2. Đơn đã giao rồi → cảnh báo (tránh nhân viên scan trùng)
    if (order.status === 'DELIVERED') {
      Toast.show({
        type: 'info',
        text1: `⚠️ Đơn này đã giao rồi`,
        text2: `${order.customer?.name ?? '—'} · ${order.code}`,
        visibilityTime: 5000,
      });
      return;
    }

    // 3. Đơn đã huỷ
    if (order.status === 'CANCELLED') {
      Toast.show({
        type: 'error',
        text1: 'Đơn đã huỷ',
        text2: `${order.customer?.name ?? '—'} · ${order.code}`,
        visibilityTime: 5000,
      });
      return;
    }

    // 4. Đơn READY (đã giặt xong) → AUTO-HOÀN THÀNH
    if (order.status === 'READY') {
      try {
        const updated = await orderApi.updateStatus(order.id, 'DELIVERED');
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['order', order.id] });
        queryClient.invalidateQueries({ queryKey: ['report'] });

        // Show modal đẹp tự tắt sau 3s
        setSuccessOrder(updated);
      } catch (err) {
        Toast.show({
          type: 'error',
          text1: 'Không cập nhật được đơn',
          text2: extractError(err).message,
        });
      }
      return;
    }

    // 5. Trạng thái khác (CREATED/RECEIVED/WASHING — dữ liệu cũ trước khi
    // đổi flow). Show popup để nhân viên quyết định thủ công.
    setScannedOrder(order);
    setModalVisible(true);
  }

  function handleScanSubmit() {
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    const code = scanBuffer.trim();
    setScanBuffer('');
    if (code) processBarcode(code);
  }

  function handleScanChange(text: string) {
    setScanBuffer(text);
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    scanTimerRef.current = setTimeout(() => {
      const code = text.trim();
      setScanBuffer('');
      if (code) processBarcode(code);
    }, 120);
  }

  // Khi scanner đang ON và bị blur (ví dụ user tap vào form input khác),
  // chờ keyboard ẩn rồi mới refocus — không refocus aggressive.
  function handleScanBlur() {
    if (!scannerActive) return;
    if (refocusTimerRef.current) clearTimeout(refocusTimerRef.current);
    refocusTimerRef.current = setTimeout(() => {
      if (scannerActive && !Keyboard.isVisible()) {
        scanRef.current?.focus();
      }
    }, 500);
  }

  useEffect(() => {
    if (!scannerActive) return;
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      if (scannerActive) {
        setTimeout(() => scanRef.current?.focus(), 200);
      }
    });
    return () => sub.remove();
  }, [scannerActive]);

  // Polling refocus — đảm bảo hidden input luôn focused khi user navigate
  // qua nhiều màn hình. onBlur không phải lúc nào cũng fire reliably trên RN.
  useEffect(() => {
    if (!scannerActive) return;
    const interval = setInterval(() => {
      const ref = scanRef.current;
      if (!ref) return;
      // Chỉ refocus nếu keyboard không hiển thị (user không đang gõ ở ô khác)
      if (Keyboard.isVisible()) return;
      // isFocused() có sẵn trên TextInput ref
      if (typeof ref.isFocused === 'function' && !ref.isFocused()) {
        ref.focus();
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [scannerActive]);

  // Refocus khi user chuyển màn hình (navigation state change)
  useEffect(() => {
    if (!scannerActive) return;
    if (!navigationRef.isReady()) return;
    const unsubscribe = navigationRef.addListener('state', () => {
      // Delay đủ để screen mới mount xong
      setTimeout(() => {
        if (!Keyboard.isVisible()) {
          scanRef.current?.focus();
        }
      }, 350);
    });
    return unsubscribe;
  }, [scannerActive]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <FCMRegistrar />
            <StatusBar barStyle="dark-content" backgroundColor={colors.card} />
            <RootNavigator navigationRef={navigationRef} />

            {/* Hidden TextInput — chỉ mount khi scanner active.
                Khi không active, KHÔNG render TextInput → không có focus battle,
                user tap UI không bị double-tap. */}
            {scannerActive && (
              <TextInput
                ref={scanRef}
                value={scanBuffer}
                onChangeText={handleScanChange}
                onSubmitEditing={handleScanSubmit}
                onBlur={handleScanBlur}
                blurOnSubmit={false}
                caretHidden
                showSoftInputOnFocus={false}
                style={styles.hiddenInput}
                autoCorrect={false}
                autoCapitalize="none"
                importantForAutofill="no"
              />
            )}

            {/* Floating button — toggle scanner */}
            <Pressable
              onPress={() => setScannerActive((v) => !v)}
              style={({ pressed }) => [
                styles.scannerFab,
                scannerActive && styles.scannerFabActive,
                pressed && { opacity: 0.7 },
              ]}
              hitSlop={8}
            >
              <Icon
                name={scannerActive ? 'barcode-scan' : 'barcode-off'}
                size={20}
                color={scannerActive ? '#fff' : colors.textMuted}
              />
              {scannerActive && (
                <View style={styles.scannerDot} />
              )}
              <Text
                style={[
                  styles.scannerFabText,
                  scannerActive && styles.scannerFabTextActive,
                ]}
                numberOfLines={1}
              >
                {scannerActive ? 'Quét: BẬT' : 'Quét: TẮT'}
              </Text>
            </Pressable>

            <BarcodeOrderModal
              visible={modalVisible}
              order={scannedOrder}
              loading={scanLoading}
              onClose={() => setModalVisible(false)}
              onOpenDetail={() => {
                setModalVisible(false);
                if (scannedOrder && navigationRef.isReady()) {
                  navigationRef.navigate('OrderDetail', { id: scannedOrder.id });
                }
              }}
            />

            <BarcodeSuccessModal
              visible={!!successOrder}
              order={successOrder}
              onClose={() => setSuccessOrder(null)}
              autoCloseMs={3000}
            />

            <Toast />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hiddenInput: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    width: 1,
    height: 1,
    opacity: 0,
  },
  scannerFab: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  scannerFabActive: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  scannerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  scannerFabText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  scannerFabTextActive: {
    color: '#fff',
  },
});
