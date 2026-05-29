import React from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';
import { Button } from '@/components/ui/Button';
import { OrderStatusBadge } from '@/components/common/OrderStatusBadge';
import { orderApi } from '@/api/order.api';
import { extractError } from '@/api/client';
import { NEXT_STATUS_TRANSITIONS, ORDER_STATUS_LABEL, STATUS_ACTION_LABEL, type OrderStatus } from '@/helpers/enums/order-status';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { formatCurrency } from '@/lib/utils';
import type { Order } from '@/types/api';

interface Props {
  visible: boolean;
  order: Order | null;
  loading: boolean;
  onClose: () => void;
  onOpenDetail: () => void;
}

export function BarcodeOrderModal({ visible, order, loading, onClose, onOpenDetail }: Props) {
  const queryClient = useQueryClient();

  const statusMutation = useMutation({
    mutationFn: (status: OrderStatus) => orderApi.updateStatus(order!.id, status),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', order!.id] });
      queryClient.invalidateQueries({ queryKey: ['report'] });
      Toast.show({
        type: 'success',
        text1: `✓ ${ORDER_STATUS_LABEL[updated.status as OrderStatus]}`,
        text2: updated.code,
      });
      onClose();
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  const nextStatuses = order
    ? (NEXT_STATUS_TRANSITIONS[order.status as OrderStatus] ?? [])
    : [];
  const discount = Number(order?.discountAmount ?? 0);
  const remaining = Number(order?.totalAmount ?? 0) - discount;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {loading || !order ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Đang tìm đơn…</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ gap: spacing.md }} showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View style={styles.headerRow}>
                <View style={styles.scanIcon}>
                  <Icon name="barcode-scan" size={28} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.code}>{order.code}</Text>
                  <OrderStatusBadge status={order.status} />
                </View>
              </View>

              {/* Customer */}
              <View style={styles.customerBox}>
                <Icon name="account" size={18} color={colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.customerName}>{order.customer?.name ?? '—'}</Text>
                  {order.customer?.phone ? (
                    <Text style={styles.customerPhone}>{order.customer.phone}</Text>
                  ) : null}
                </View>
              </View>

              {/* Items summary */}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Số mặt hàng</Text>
                <Text style={styles.infoValue}>{order.items.length} món</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tổng tiền</Text>
                <Text style={styles.infoValue}>{formatCurrency(order.totalAmount)}</Text>
              </View>
              {discount > 0 && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Giảm giá</Text>
                  <Text style={styles.infoValue}>{formatCurrency(discount)}</Text>
                </View>
              )}
              <View style={[styles.infoRow, styles.remainingRow]}>
                <Text style={styles.remainingLabel}>Còn phải thu</Text>
                <Text style={styles.remainingValue}>{formatCurrency(remaining)}</Text>
              </View>

              {/* Action buttons */}
              <View style={styles.actions}>
                {nextStatuses
                  .filter((s) => s !== 'CANCELLED')
                  .map((s) => (
                    <Button
                      key={s}
                      size="lg"
                      fullWidth
                      onPress={() => statusMutation.mutate(s)}
                      loading={statusMutation.isPending}
                      leftIcon={
                        s === 'DELIVERED'
                          ? <Icon name="check-circle" size={20} color="#fff" />
                          : <Icon name="arrow-right-circle" size={20} color="#fff" />
                      }
                    >
                      {STATUS_ACTION_LABEL[s] ?? ORDER_STATUS_LABEL[s]}
                    </Button>
                  ))}

                <Button
                  variant="outline"
                  fullWidth
                  onPress={onOpenDetail}
                  leftIcon={<Icon name="open-in-new" size={18} color={colors.text} />}
                >
                  Mở chi tiết đơn
                </Button>

                {nextStatuses.includes('CANCELLED') && (
                  <Button
                    variant="destructive"
                    fullWidth
                    onPress={() => statusMutation.mutate('CANCELLED')}
                    loading={statusMutation.isPending}
                  >
                    Huỷ đơn
                  </Button>
                )}

                <Button variant="ghost" fullWidth onPress={onClose}>
                  Đóng
                </Button>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
  },
  handle: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  loadingBox: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  loadingText: { fontSize: 15, color: colors.textMuted },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  scanIcon: {
    width: 52, height: 52, borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  code: {
    fontSize: 20, fontWeight: '700', color: colors.text,
    fontFamily: 'monospace', marginBottom: 4,
  },

  customerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  customerName: { fontSize: 18, fontWeight: '700', color: colors.text },
  customerPhone: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  infoLabel: { fontSize: 14, color: colors.textMuted },
  infoValue: { fontSize: 14, fontWeight: '600', color: colors.text },

  remainingRow: {
    backgroundColor: colors.primaryLight,
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  remainingLabel: { fontSize: 15, fontWeight: '700', color: colors.primary },
  remainingValue: { fontSize: 18, fontWeight: '800', color: colors.primary },

  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
