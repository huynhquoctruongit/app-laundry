import React, { useRef, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';
import { captureRef } from 'react-native-view-shot';
import { Button } from '@/components/ui/Button';
import { extractError } from '@/api/client';
import { PrinterService } from '@/native/printer/PrinterService';
import { InvoicePrintView, PRINT_WIDTH_PX } from '@/native/printer/InvoicePrintView';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import type { Order, ShopSettings } from '@/types/api';

interface Props {
  visible: boolean;
  onClose: () => void;
  order: Order | null;
  settings: ShopSettings | null;
}

export function InvoicePreviewModal({ visible, onClose, order, settings }: Props) {
  const [printing, setPrinting] = useState(false);
  const [contentH, setContentH] = useState(0);
  const printRef = useRef<View>(null);
  const { width: winW } = useWindowDimensions();

  async function handlePrint() {
    if (!order || !settings) return;
    if (!PrinterService.isReady()) {
      Toast.show({
        type: 'error',
        text1: 'Chưa kết nối máy in',
        text2: PrinterService.getError() ?? 'Vào Cài đặt → Máy in để thiết lập',
      });
      return;
    }
    setPrinting(true);
    try {
      const fullB64 = await captureRef(printRef, {
        format: 'png',
        quality: 1,
        result: 'base64',
      });
      await PrinterService.printReceipt(fullB64);
      Toast.show({ type: 'success', text1: 'Đã gửi đến máy in' });
      onClose();
    } catch (err) {
      Toast.show({ type: 'error', text1: extractError(err).message });
    } finally {
      setPrinting(false);
    }
  }

  if (!order || !settings) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.modalTitle}>Đang tải dữ liệu hoá đơn…</Text>
            <Button variant="outline" onPress={onClose} fullWidth>Đóng</Button>
          </View>
        </View>
      </Modal>
    );
  }

  // Scale bản in (384px) vừa bề ngang modal — preview KHỚP 100% với bản in thật
  const scaledW = Math.min(PRINT_WIDTH_PX, winW - 72);
  const scale = scaledW / PRINT_WIDTH_PX;
  const scaledH = contentH * scale;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* View off-screen để capture bản in (giữ nguyên 384px cho đúng độ phân giải) */}
      <View style={{ position: 'absolute', left: -9999, top: 0 }} pointerEvents="none">
        <View ref={printRef} collapsable={false} style={{ backgroundColor: '#fff' }}>
          <InvoicePrintView order={order} settings={settings} />
        </View>
      </View>

      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Xem trước hoá đơn</Text>
            <Text style={styles.modalSubtitle}>{order.code}</Text>
          </View>

          <ScrollView
            style={styles.receiptWrap}
            contentContainerStyle={{ alignItems: 'center', paddingVertical: 8 }}
          >
            {/* Hiển thị CHÍNH bản in (scale vừa khung) → preview = print */}
            <View
              style={{
                width: scaledW,
                height: scaledH || undefined,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: '#fff',
              }}
            >
              <View
                onLayout={(e) => {
                  const h = e.nativeEvent.layout.height;
                  if (h && Math.abs(h - contentH) > 1) setContentH(h);
                }}
                style={{
                  width: PRINT_WIDTH_PX,
                  transform: [{ scale }],
                  marginLeft: -(PRINT_WIDTH_PX - scaledW) / 2,
                  marginTop: contentH ? -(contentH - scaledH) / 2 : 0,
                }}
              >
                <InvoicePrintView order={order} settings={settings} />
              </View>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <Button variant="outline" onPress={onClose} style={{ flex: 1 }} disabled={printing}>
              Đóng
            </Button>
            <Button
              onPress={handlePrint}
              loading={printing}
              style={{ flex: 2 }}
              leftIcon={<Icon name="printer" size={20} color="#fff" />}
            >
              In ngay
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    maxHeight: '95%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  modalSubtitle: { fontSize: 13, color: colors.textMuted, fontFamily: 'monospace' },
  receiptWrap: { flexGrow: 0, flexShrink: 1, maxHeight: 560 },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
});
