import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRoute, type RouteProp } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { OrderStatusBadge } from '@/components/common/OrderStatusBadge';
import { InvoicePreviewModal } from '@/components/common/InvoicePreviewModal';
import { orderApi } from '@/api/order.api';
import { settingsApi } from '@/api/settings.api';
import { extractError } from '@/api/client';
import { usePermissions } from '@/hooks/usePermissions';
import { NEXT_STATUS_TRANSITIONS, ORDER_STATUS_LABEL, STATUS_ACTION_LABEL, type OrderStatus } from '@/helpers/enums/order-status';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { calcLineTotal, formatCurrency, formatDateTime } from '@/lib/utils';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type R = RouteProp<RootStackParamList, 'OrderDetail'>;

export function OrderDetailScreen() {
  const route = useRoute<R>();
  const { id, autoPrint } = route.params;
  const queryClient = useQueryClient();
  const { canChangeStatus, canCompleteOrder } = usePermissions();
  const [previewOpen, setPreviewOpen] = useState(false);
  const autoPrintTriggered = useRef(false);

  const orderQuery = useQuery({ queryKey: ['order', id], queryFn: () => orderApi.detail(id) });
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: () => settingsApi.get() });
  const historyQuery = useQuery({
    queryKey: ['order', id, 'history'],
    queryFn: () => orderApi.scanHistory(id),
    enabled: !!orderQuery.data,
  });

  useEffect(() => {
    if (
      autoPrint &&
      !autoPrintTriggered.current &&
      orderQuery.data &&
      settingsQuery.data
    ) {
      autoPrintTriggered.current = true;
      setPreviewOpen(true);
    }
  }, [autoPrint, orderQuery.data, settingsQuery.data]);

  const statusMutation = useMutation({
    mutationFn: (status: OrderStatus) => orderApi.updateStatus(id, status),
    onSuccess: (data) => {
      Toast.show({ type: 'success', text1: `Đã chuyển sang: ${ORDER_STATUS_LABEL[data.status as OrderStatus]}` });
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['report'] });
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  if (orderQuery.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!orderQuery.data) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Không tìm thấy đơn</Text>
      </View>
    );
  }

  const order = orderQuery.data;
  const nextStatuses = NEXT_STATUS_TRANSITIONS[order.status as OrderStatus] ?? [];
  const discount = Number(order.discountAmount ?? 0);
  const remaining = Number(order.totalAmount) - discount;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      {/* Header info */}
      <Card>
        <CardHeader style={styles.cardHeader}>
          <CardTitle>{order.code}</CardTitle>
          <OrderStatusBadge status={order.status} />
        </CardHeader>
        <CardContent style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
          <InfoCol label="Khách hàng" value={order.customer?.name ?? '—'} sub={order.customer?.phone} />
          <InfoCol label="Hẹn lấy đồ" value={formatDateTime(order.pickupAt)} />
          <InfoCol label="Đã giao lúc" value={formatDateTime(order.deliveredAt)} />
          <InfoCol label="Tạo lúc" value={formatDateTime(order.createdAt)} />
          {order.note && <InfoCol label="Ghi chú" value={order.note} />}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader><CardTitle>Dịch vụ</CardTitle></CardHeader>
        <CardContent style={{ gap: spacing.sm }}>
          {order.items.map((it, i) => (
            <View key={i} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{it.name}</Text>
                <Text style={styles.itemMeta}>
                  {it.quantity} × {formatCurrency(it.unitPrice)}
                  {it.weight ? ` · ${it.weight}kg` : ''}
                </Text>
              </View>
              <Text style={styles.itemTotal}>{formatCurrency(calcLineTotal(it))}</Text>
            </View>
          ))}

          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tổng cộng</Text>
            <Text style={styles.totalValue}>{formatCurrency(order.totalAmount)}</Text>
          </View>
          {discount > 0 && (
            <>
              <View style={styles.totalRow}>
                <Text style={{ color: colors.textMuted }}>Giảm giá</Text>
                <Text style={{ color: colors.textMuted }}>{formatCurrency(discount)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.primary }]}>Còn phải thu</Text>
                <Text style={[styles.totalValue, { color: colors.primary }]}>{formatCurrency(remaining)}</Text>
              </View>
            </>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Button
          fullWidth
          size="lg"
          onPress={() => setPreviewOpen(true)}
          leftIcon={<Icon name="printer" size={22} color="#fff" />}
          style={{ flex: 1 }}
        >
          Xem & in hoá đơn
        </Button>
      </View>

      <InvoicePreviewModal
        visible={previewOpen}
        onClose={() => setPreviewOpen(false)}
        order={orderQuery.data ?? null}
        settings={settingsQuery.data ?? null}
      />

      {/* Nút hoàn thành cho nhân viên (READY → DELIVERED) */}
      {!canChangeStatus && canCompleteOrder && order.status === 'READY' && (
        <Button
          size="lg"
          fullWidth
          onPress={() => statusMutation.mutate('DELIVERED')}
          loading={statusMutation.isPending}
          leftIcon={<Icon name="check-circle-outline" size={22} color="#fff" />}
        >
          Hoàn thành — Đã giao cho khách
        </Button>
      )}

      {/* Status update (Admin) */}
      {canChangeStatus && nextStatuses.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Cập nhật trạng thái</CardTitle></CardHeader>
          <CardContent style={{ gap: spacing.sm }}>
            {nextStatuses.map((s) => (
              <Button
                key={s}
                variant={s === 'CANCELLED' ? 'outline' : 'default'}
                onPress={() => statusMutation.mutate(s)}
                loading={statusMutation.isPending}
                fullWidth
              >
                {STATUS_ACTION_LABEL[s] ?? `Chuyển sang: ${ORDER_STATUS_LABEL[s]}`}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Scan history */}
      <Card>
        <CardHeader><CardTitle>Lịch sử scan</CardTitle></CardHeader>
        <CardContent style={{ gap: spacing.sm }}>
          {(historyQuery.data ?? []).length === 0 ? (
            <Text style={{ color: colors.textMuted }}>Chưa có lượt scan nào.</Text>
          ) : (
            (historyQuery.data ?? []).map((h) => (
              <View key={h.id} style={styles.historyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600' }}>
                    {h.action === 'UPDATE_STATUS' ? 'Cập nhật trạng thái' : 'Xem QR'}
                    {h.user ? ` · ${h.user.name}` : ' · Khách'}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>{h.ip ?? '-'}</Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>{formatDateTime(h.scannedAt)}</Text>
              </View>
            ))
          )}
        </CardContent>
      </Card>
    </ScrollView>
  );
}

function InfoCol({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={{ minWidth: 180 }}>
      <Text style={{ fontSize: 12, color: colors.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{value}</Text>
      {sub && <Text style={{ fontSize: 13, color: colors.textMuted }}>{sub}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  itemRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  itemName: { fontSize: 15, fontWeight: '600', color: colors.text },
  itemMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  itemTotal: { fontSize: 15, fontWeight: '700', color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  totalValue: { fontSize: 18, fontWeight: '700', color: colors.text },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
});
