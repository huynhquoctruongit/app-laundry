import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { BookingStatusBadge } from '@/components/common/BookingStatusBadge';
import { bookingApi, type BookingItemPayload, type UpdateBookingPayload } from '@/api/booking.api';
import { extractError } from '@/api/client';
import { usePermissions } from '@/hooks/usePermissions';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { calcLineTotal, formatCurrency, formatDateTime } from '@/lib/utils';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type R = RouteProp<RootStackParamList, 'BookingDetail'>;

interface ConvertItem {
  productId?: string | null;
  name: string;
  quantity: string;
  weight: string;
  unitPrice: string;
}

export function BookingDetailScreen() {
  const route = useRoute<R>();
  const navigation = useNavigation<any>();
  const { id } = route.params;
  const queryClient = useQueryClient();
  const { canEdit, isAdmin, canCreateOrder } = usePermissions();

  const bookingQuery = useQuery({
    queryKey: ['booking', id],
    queryFn: () => bookingApi.detail(id),
  });

  const [convertOpen, setConvertOpen] = useState(false);
  const [convertItems, setConvertItems] = useState<ConvertItem[]>([]);
  const [discount, setDiscount] = useState('0');
  const [convertNote, setConvertNote] = useState('');

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNote, setEditNote] = useState('');

  const statusMutation = useMutation({
    mutationFn: (status: 'CONFIRMED' | 'CANCELLED') =>
      bookingApi.updateStatus(id, status),
    onSuccess: (data) => {
      Toast.show({
        type: 'success',
        text1: data.status === 'CONFIRMED' ? 'Đã duyệt yêu cầu' : 'Đã từ chối yêu cầu',
      });
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => bookingApi.remove(id),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã xoá đặt lịch' });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      navigation.goBack();
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateBookingPayload) => bookingApi.update(id, payload),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã cập nhật đặt lịch' });
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setEditOpen(false);
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  function openEdit() {
    const b = bookingQuery.data;
    if (!b) return;
    setEditPhone(b.phone ?? '');
    setEditAddress(b.address ?? '');
    setEditNote(b.note ?? '');
    setEditOpen(true);
  }

  function confirmDelete() {
    const b = bookingQuery.data;
    Alert.alert(
      'Xoá đặt lịch',
      `Xoá đặt lịch ${b?.code ?? ''}?\nHành động này không thể hoàn tác.`,
      [
        { text: 'Huỷ', style: 'cancel' },
        { text: 'Xoá', style: 'destructive', onPress: () => deleteMutation.mutate() },
      ],
    );
  }

  const convertMutation = useMutation({
    mutationFn: () => {
      const items: BookingItemPayload[] = convertItems.map((i) => ({
        productId: i.productId || undefined,
        name: i.name,
        quantity: Number(i.quantity),
        weight: i.weight ? Number(i.weight) : undefined,
        unitPrice: Number(i.unitPrice),
      }));
      return bookingApi.convert(id, {
        items,
        note: convertNote || undefined,
        discountAmount: Number(discount) || 0,
      });
    },
    onSuccess: (data) => {
      Toast.show({ type: 'success', text1: `Đã tạo đơn từ ${data.code}` });
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setConvertOpen(false);
      if (data.convertedOrder) {
        navigation.replace('OrderDetail', {
          id: data.convertedOrderId!,
          autoPrint: true,
        });
      }
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  function openConvert() {
    if (!bookingQuery.data) return;
    setConvertItems(
      bookingQuery.data.items.map((it) => ({
        productId: it.productId ?? undefined,
        name: it.name,
        quantity: String(it.quantity),
        weight: it.weight != null ? String(it.weight) : '',
        unitPrice: String(it.unitPrice),
      })),
    );
    setDiscount('0');
    setConvertNote(bookingQuery.data.note ?? '');
    setConvertOpen(true);
  }

  function updateConvertItem(i: number, patch: Partial<ConvertItem>) {
    setConvertItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  const convertTotal = useMemo(
    () => convertItems.reduce((sum, i) => sum + calcLineTotal(i), 0),
    [convertItems],
  );
  const convertRemaining = convertTotal - (Number(discount) || 0);

  if (bookingQuery.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!bookingQuery.data) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Không tìm thấy đặt lịch</Text>
      </View>
    );
  }

  const b = bookingQuery.data;
  const itemsTotal = b.items.reduce((sum, i) => sum + calcLineTotal(i), 0);
  const canModerate = canEdit && (b.status === 'PENDING' || b.status === 'CONFIRMED');
  // Nhân viên có quyền "Tạo đơn" được phép chuyển đặt lịch thành đơn (backend authStaff)
  const canConvert = canCreateOrder && (b.status === 'PENDING' || b.status === 'CONFIRMED');

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      {/* Header card */}
      <Card>
        <CardHeader style={styles.cardHeader}>
          <CardTitle>{b.code}</CardTitle>
          <BookingStatusBadge status={b.status} />
        </CardHeader>
        <CardContent style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
          <InfoCol label="Khách hàng" value={b.customer?.name ?? '—'} sub={b.phone} />
          <InfoCol label="Địa chỉ" value={b.address || '—'} />
          <InfoCol label="Hẹn lấy" value={formatDateTime(b.pickupAt)} />
          <InfoCol label="Hẹn giao" value={formatDateTime(b.deliveryAt)} />
          <InfoCol label="Gửi lúc" value={formatDateTime(b.createdAt)} />
          {b.sourceOrder && (
            <InfoCol label="Đặt từ đơn" value={b.sourceOrder.code} />
          )}
          {b.convertedOrder && (
            <InfoCol label="Đã tạo đơn" value={b.convertedOrder.code} />
          )}
          {b.note ? <InfoCol label="Ghi chú" value={b.note} /> : null}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader><CardTitle>Dịch vụ</CardTitle></CardHeader>
        <CardContent style={{ gap: spacing.sm }}>
          {b.items.map((it, i) => (
            <View key={i} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{it.name}</Text>
                <Text style={styles.itemMeta}>
                  {it.quantity} × {formatCurrency(it.unitPrice)}
                  {it.weight ? ` · ${it.weight}kg` : ''}
                </Text>
              </View>
              <Text style={styles.itemTotal}>
                {formatCurrency(calcLineTotal(it))}
              </Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tổng dự kiến</Text>
            <Text style={styles.totalValue}>{formatCurrency(itemsTotal)}</Text>
          </View>
        </CardContent>
      </Card>

      {/* Actions */}
      {(canModerate || canConvert) && (
        <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
          {canModerate && b.status === 'PENDING' && (
            <Button
              onPress={() => statusMutation.mutate('CONFIRMED')}
              loading={statusMutation.isPending}
              leftIcon={<Icon name="check" size={20} color="#fff" />}
              style={{ flex: 1, minWidth: 160 }}
            >
              Duyệt
            </Button>
          )}
          {canConvert && (
            <Button
              variant="success"
              onPress={openConvert}
              leftIcon={<Icon name="package-variant-closed" size={20} color="#fff" />}
              style={{ flex: 1, minWidth: 200 }}
            >
              Chuyển thành đơn
            </Button>
          )}
          {canModerate && (
            <Button
              variant="destructive"
              onPress={() => statusMutation.mutate('CANCELLED')}
              loading={statusMutation.isPending}
              leftIcon={<Icon name="close" size={20} color="#fff" />}
              style={{ flex: 1, minWidth: 160 }}
            >
              Từ chối
            </Button>
          )}
        </View>
      )}

      {/* Admin: sửa + xoá */}
      {isAdmin && (
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button
            variant="outline"
            style={{ flex: 1 }}
            leftIcon={<Icon name="pencil-outline" size={20} color={colors.primary} />}
            onPress={openEdit}
          >
            Sửa
          </Button>
          <Button
            variant="outline"
            style={{ flex: 1, borderColor: colors.danger }}
            leftIcon={<Icon name="trash-can-outline" size={20} color={colors.danger} />}
            loading={deleteMutation.isPending}
            onPress={confirmDelete}
          >
            <Text style={{ color: colors.danger }}>Xoá</Text>
          </Button>
        </View>
      )}

      {/* Edit modal */}
      <Modal visible={editOpen} transparent animationType="fade" onRequestClose={() => setEditOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sửa đặt lịch</Text>
            <Input label="Số điện thoại" value={editPhone} onChangeText={setEditPhone} keyboardType="phone-pad" />
            <Input label="Địa chỉ" value={editAddress} onChangeText={setEditAddress} />
            <Input label="Ghi chú" value={editNote} onChangeText={setEditNote} multiline numberOfLines={3} style={{ minHeight: 72, textAlignVertical: 'top' }} />
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
              <Button variant="outline" style={{ flex: 1 }} onPress={() => setEditOpen(false)}>Huỷ</Button>
              <Button
                style={{ flex: 1 }}
                loading={updateMutation.isPending}
                onPress={() => updateMutation.mutate({ phone: editPhone, address: editAddress, note: editNote || null })}
              >
                Lưu
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Convert modal */}
      <Modal
        visible={convertOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setConvertOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Chuyển booking thành đơn</Text>
            <Text style={styles.modalSub}>
              Kiểm tra lại dịch vụ & giá. Khi tạo đơn, booking sẽ chuyển trạng thái Đã tạo đơn.
            </Text>
            <ScrollView style={{ maxHeight: 440 }}>
              <View style={{ gap: spacing.sm }}>
                {convertItems.map((it, i) => (
                  <View key={i} style={styles.itemCard}>
                    <Input
                      label="Tên dịch vụ"
                      value={it.name}
                      onChangeText={(v) => updateConvertItem(i, { name: v })}
                    />
                    <View style={{ flexDirection: 'row', gap: spacing.md }}>
                      <View style={{ flex: 1 }}>
                        <Input
                          label="SL"
                          value={it.quantity}
                          onChangeText={(v) => updateConvertItem(i, { quantity: v.replace(/[^0-9]/g, '') })}
                          onBlur={() => {
                            const q = parseInt(it.quantity, 10);
                            if (!q || q < 1) updateConvertItem(i, { quantity: '1' });
                          }}
                          keyboardType="number-pad"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Input
                          label="Cân (kg)"
                          value={it.weight}
                          onChangeText={(v) => updateConvertItem(i, { weight: v.replace(',', '.') })}
                          keyboardType="decimal-pad"
                          placeholder="—"
                        />
                      </View>
                      <View style={{ flex: 2 }}>
                        <Input
                          label="Đơn giá"
                          value={it.unitPrice}
                          onChangeText={(v) => updateConvertItem(i, { unitPrice: v })}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                    <View style={styles.subtotalRow}>
                      <Text style={{ color: colors.textMuted, fontSize: 13 }}>Thành tiền</Text>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                        {formatCurrency(calcLineTotal(it))}
                      </Text>
                    </View>
                  </View>
                ))}
                <Input
                  label="Giảm giá"
                  value={discount}
                  onChangeText={setDiscount}
                  keyboardType="numeric"
                />
                <Input
                  label="Ghi chú"
                  value={convertNote}
                  onChangeText={setConvertNote}
                  multiline
                  numberOfLines={2}
                />
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Tổng</Text>
                  <Text style={styles.totalValue}>{formatCurrency(convertTotal)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: colors.primary }]}>Còn phải thu</Text>
                  <Text style={[styles.totalValue, { color: colors.primary }]}>
                    {formatCurrency(convertRemaining)}
                  </Text>
                </View>
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <Button variant="ghost" onPress={() => setConvertOpen(false)} style={{ flex: 1 }}>
                Huỷ
              </Button>
              <Button
                onPress={() => convertMutation.mutate()}
                loading={convertMutation.isPending}
                style={{ flex: 2 }}
                leftIcon={<Icon name="check" size={20} color="#fff" />}
              >
                Tạo đơn ngay
              </Button>
            </View>
          </View>
        </View>
      </Modal>
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
  modalBackdrop: {
    flex: 1, backgroundColor: colors.overlay,
    alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
  },
  modalCard: {
    width: '100%', maxWidth: 640,
    backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.xl, gap: spacing.md,
    maxHeight: '92%',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  modalSub: { fontSize: 13, color: colors.textMuted },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  itemCard: {
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  subtotalRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border,
  },
});
