import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
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
import { NEXT_STATUS_TRANSITIONS, ORDER_STATUS_LABEL, type OrderStatus } from '@/helpers/enums/order-status';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { calcLineTotal, formatCurrency, formatDateTime } from '@/lib/utils';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type R = RouteProp<RootStackParamList, 'OrderDetail'>;

export function OrderDetailScreen() {
  const route = useRoute<R>();
  const navigation = useNavigation<any>();
  const { id, autoPrint } = route.params;
  const queryClient = useQueryClient();
  const { canChangeStatus, canCompleteOrder, canDelete, canEdit, isAdmin } = usePermissions();
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

  const deleteMutation = useMutation({
    mutationFn: () => orderApi.remove(id),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã xoá đơn' });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['report'] });
      navigation.goBack();
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  function confirmDelete() {
    Alert.alert(
      'Xoá đơn hàng',
      `Bạn có chắc muốn xoá đơn ${orderQuery.data?.code ?? ''}?\nHành động này không thể hoàn tác.`,
      [
        { text: 'Huỷ', style: 'cancel' },
        { text: 'Xoá', style: 'destructive', onPress: () => deleteMutation.mutate() },
      ],
    );
  }

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
  // Admin: đổi sang BẤT KỲ trạng thái nào (trừ trạng thái hiện tại).
  // Nhân viên: theo luồng cho phép.
  const allStatuses = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];
  const statusOptions: OrderStatus[] = canChangeStatus
    ? allStatuses.filter((s) => s !== order.status)
    : NEXT_STATUS_TRANSITIONS[order.status as OrderStatus] ?? [];
  const discount = Number(order.discountAmount ?? 0);
  const remaining = Number(order.totalAmount) - discount;

  const hasFooter =
    (!canChangeStatus && canCompleteOrder && order.status === 'READY') ||
    (canChangeStatus && statusOptions.length > 0);

  return (
    <View style={styles.container}>
    {/* Dấu "giao tận nhà" cho đơn đặt lịch — mép trái, giữa (kiểu giáp lai) */}
    {order.fromBooking && (
      <View pointerEvents="none" style={styles.shipStamp}>
        <Icon name="truck-fast" size={16} color="#0284c7" />
        <Text style={styles.shipStampText}>GIAO TẬN NHÀ</Text>
      </View>
    )}
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: hasFooter ? 140 : spacing.lg }}>
      {/* Header info */}
      <Card>
        <CardHeader style={styles.cardHeader}>
          <CardTitle>{order.code}</CardTitle>
          <OrderStatusBadge status={order.status} />
          {order.fromBooking && (
            <View style={styles.bookingChip}>
              <Icon name="truck-fast" size={13} color="#0369a1" />
              <Text style={styles.bookingChipText}>Đặt lịch</Text>
            </View>
          )}
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

      {/* Admin: sửa + xoá bất kỳ đơn nào */}
      {isAdmin && (
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button
            variant="outline"
            size="lg"
            style={{ flex: 1 }}
            leftIcon={<Icon name="pencil-outline" size={20} color={colors.primary} />}
            onPress={() => navigation.navigate('OrderCreate', { editId: id })}
          >
            Sửa đơn
          </Button>
          <Button
            variant="outline"
            size="lg"
            style={{ flex: 1, borderColor: colors.danger }}
            leftIcon={<Icon name="trash-can-outline" size={20} color={colors.danger} />}
            loading={deleteMutation.isPending}
            onPress={confirmDelete}
          >
            <Text style={{ color: colors.danger }}>Xoá đơn</Text>
          </Button>
        </View>
      )}

      <InvoicePreviewModal
        visible={previewOpen}
        onClose={() => setPreviewOpen(false)}
        order={orderQuery.data ?? null}
        settings={settingsQuery.data ?? null}
      />

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

    {/* Footer cố định — nút hoàn thành / đổi trạng thái */}
    {hasFooter && (
      <View style={styles.footer}>
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
        {canChangeStatus && statusOptions.length > 0 && (
          <View style={{ gap: spacing.xs }}>
            <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '600' }}>
              Đổi trạng thái sang:
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {statusOptions.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={s === 'CANCELLED' ? 'outline' : 'default'}
                  onPress={() => statusMutation.mutate(s)}
                  loading={statusMutation.isPending}
                >
                  {ORDER_STATUS_LABEL[s]}
                </Button>
              ))}
            </View>
          </View>
        )}
      </View>
    )}
    </View>
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
  shipStamp: {
    position: 'absolute',
    left: -34,
    top: '46%',
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    transform: [{ rotate: '-90deg' }],
    borderWidth: 2,
    borderColor: '#0284c7',
    backgroundColor: '#e0f2fe',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  shipStampText: { fontSize: 12, fontWeight: '800', color: '#0284c7', letterSpacing: 0.5 },
  bookingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#e0f2fe',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bookingChipText: { fontSize: 12, fontWeight: '700', color: '#0369a1' },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
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
