import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { productApi } from '@/api/product.api';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { extractError } from '@/api/client';
import { usePermissions } from '@/hooks/usePermissions';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { calcLineTotal, formatCurrency, formatDateTime } from '@/lib/utils';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type R = RouteProp<RootStackParamList, 'BookingDetail'>;

type EditItem = BookingItemPayload & { key: string };
let itemKey = 0;
const nextKey = () => `i${++itemKey}`;

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

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editPickupAt, setEditPickupAt] = useState<Date | null>(null);
  const [editDeliveryAt, setEditDeliveryAt] = useState<Date | null>(null);
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [pickingProduct, setPickingProduct] = useState(false);

  const productsQuery = useQuery({
    queryKey: ['products', 'active-all'],
    queryFn: () => productApi.list({ isActive: true, pageSize: 100 }),
    enabled: editOpen,
  });

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
    setEditPickupAt(b.pickupAt ? new Date(b.pickupAt) : null);
    setEditDeliveryAt(b.deliveryAt ? new Date(b.deliveryAt) : null);
    setEditItems(
      b.items.map((i) => ({
        key: nextKey(),
        productId: i.productId ?? undefined,
        name: i.name,
        quantity: i.quantity,
        weight: i.weight ? Number(i.weight) : undefined,
        unitPrice: Number(i.unitPrice),
      })),
    );
    setPickingProduct(false);
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
  const isConverted = b.status === 'CONVERTED';

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
              onPress={() => navigation.navigate('OrderCreate', { convertBookingId: id })}
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

      {/* Edit modal (ADMIN) */}
      <Modal visible={editOpen} transparent animationType="fade" onRequestClose={() => setEditOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sửa đặt lịch</Text>
            <ScrollView contentContainerStyle={{ gap: spacing.md }} keyboardShouldPersistTaps="handled">
              <Input label="Số điện thoại" value={editPhone} onChangeText={setEditPhone} keyboardType="phone-pad" />
              <Input label="Địa chỉ" value={editAddress} onChangeText={setEditAddress} />
              <DateTimeField label="Thời gian lấy đồ" value={editPickupAt} onChange={setEditPickupAt} clearable />
              <DateTimeField label="Thời gian giao trả" value={editDeliveryAt} onChange={setEditDeliveryAt} clearable />

              {isConverted ? (
                <Text style={styles.modalSub}>
                  Đặt lịch đã chuyển thành đơn — sửa dịch vụ ở đơn {b.convertedOrder?.code}.
                </Text>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  <Text style={styles.editLabel}>Dịch vụ</Text>
                  {editItems.map((it) => {
                    const set = (patch: Partial<EditItem>) =>
                      setEditItems((list) => list.map((x) => (x.key === it.key ? { ...x, ...patch } : x)));
                    return (
                      <View key={it.key} style={styles.editItem}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                          <TextInput
                            style={[styles.editInput, { flex: 1 }]}
                            value={it.name}
                            onChangeText={(v) => set({ name: v })}
                          />
                          <Pressable
                            hitSlop={8}
                            onPress={() => setEditItems((list) => list.filter((x) => x.key !== it.key))}
                          >
                            <Icon name="close-circle" size={24} color={colors.danger} />
                          </Pressable>
                        </View>
                        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                          <NumField label="SL" value={it.quantity} onChange={(v) => set({ quantity: Math.max(1, Math.round(v ?? 1)) })} />
                          <NumField label="Kg" value={it.weight} decimal onChange={(v) => set({ weight: v || undefined })} />
                          <NumField label="Đơn giá" value={it.unitPrice} onChange={(v) => set({ unitPrice: Math.max(0, v ?? 0) })} flex={1.6} />
                        </View>
                      </View>
                    );
                  })}

                  {pickingProduct ? (
                    <View style={styles.productPicker}>
                      {(productsQuery.data?.items ?? []).map((p) => (
                        <Pressable
                          key={p.id}
                          style={styles.productRow}
                          onPress={() => {
                            setEditItems((list) => [
                              ...list,
                              { key: nextKey(), productId: p.id, name: p.name, quantity: 1, unitPrice: Number(p.price) },
                            ]);
                            setPickingProduct(false);
                          }}
                        >
                          <Text style={{ flex: 1, color: colors.text }}>{p.name}</Text>
                          <Text style={{ color: colors.textMuted }}>{formatCurrency(p.price)}/{p.unit}</Text>
                        </Pressable>
                      ))}
                      {productsQuery.isLoading && <ActivityIndicator color={colors.primary} />}
                    </View>
                  ) : (
                    <Button
                      variant="outline"
                      leftIcon={<Icon name="plus" size={20} color={colors.primary} />}
                      onPress={() => setPickingProduct(true)}
                    >
                      Thêm dịch vụ
                    </Button>
                  )}
                  <Text style={{ textAlign: 'right', color: colors.text }}>
                    Tạm tính <Text style={{ fontWeight: '800' }}>{formatCurrency(editItems.reduce((s, i) => s + calcLineTotal(i), 0))}</Text>
                  </Text>
                </View>
              )}

              <Input label="Ghi chú" value={editNote} onChangeText={setEditNote} multiline numberOfLines={3} style={{ minHeight: 72, textAlignVertical: 'top' }} />
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
              <Button variant="outline" style={{ flex: 1 }} onPress={() => setEditOpen(false)}>Huỷ</Button>
              <Button
                style={{ flex: 1 }}
                loading={updateMutation.isPending}
                disabled={!isConverted && (editItems.length === 0 || editItems.some((i) => !i.name.trim()))}
                onPress={() =>
                  updateMutation.mutate({
                    phone: editPhone,
                    address: editAddress,
                    note: editNote || null,
                    pickupAt: editPickupAt ? editPickupAt.toISOString() : null,
                    deliveryAt: editDeliveryAt ? editDeliveryAt.toISOString() : null,
                    ...(isConverted
                      ? {}
                      : { items: editItems.map(({ key: _key, ...i }) => ({ ...i, weight: i.weight || undefined })) }),
                  })
                }
              >
                Lưu
              </Button>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

/** Ô nhập số nhỏ có nhãn (SL / Kg / Đơn giá) */
function NumField({ label, value, onChange, decimal, flex = 1 }: {
  label: string; value: number | undefined; onChange: (v: number | undefined) => void; decimal?: boolean; flex?: number;
}) {
  const [text, setText] = useState(value !== undefined ? String(value) : '');
  return (
    <View style={{ flex, gap: 2 }}>
      <Text style={{ fontSize: 11, color: colors.textMuted }}>{label}</Text>
      <TextInput
        style={styles.editInput}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        value={text}
        placeholder="—"
        onChangeText={(t) => {
          const clean = t.replace(',', '.');
          setText(clean);
          const n = Number(clean);
          onChange(clean === '' || isNaN(n) ? undefined : n);
        }}
      />
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
  editLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  editItem: { gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  editInput: {
    height: 42, paddingHorizontal: spacing.sm, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text, fontSize: 15,
  },
  productPicker: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, maxHeight: 240, overflow: 'hidden' },
  productRow: {
    flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
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
