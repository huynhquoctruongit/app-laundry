import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { orderApi } from '@/api/order.api';
import { customerApi } from '@/api/customer.api';
import { productApi } from '@/api/product.api';
import { useResponsive } from '@/hooks/useResponsive';
import { extractError } from '@/api/client';
import { usePermissions } from '@/hooks/usePermissions';
import { EmptyState } from '@/components/common/EmptyState';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { calcLineTotal, formatCurrency, formatDateTime, getEffectivePrice } from '@/lib/utils';
import type { Customer, Product } from '@/types/api';

interface DraftItem {
  productId?: string;
  name: string;
  quantity: string;
  weight: string;
  unitPrice: string;
}

const emptyItem: DraftItem = {
  productId: undefined,
  name: '',
  quantity: '1',
  weight: '',
  unitPrice: '0',
};

export function OrderCreateScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { canCreate } = usePermissions();
  const { isPhone } = useResponsive();

  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  // Quick add customer
  const [qaName, setQaName] = useState('');
  const [qaPhone, setQaPhone] = useState('');
  const [qaAddress, setQaAddress] = useState('');

  // Product picker per row index
  const [productPickerFor, setProductPickerFor] = useState<number | null>(null);

  const [items, setItems] = useState<DraftItem[]>([{ ...emptyItem }]);
  const [note, setNote] = useState('');
  const [pickupAt, setPickupAt] = useState<Date | null>(null);
  const [showPickupPicker, setShowPickupPicker] = useState(false);

  const customersQuery = useQuery({
    queryKey: ['customers', 'pick', { search: customerSearch }],
    queryFn: () =>
      customerApi.list({ search: customerSearch || undefined, pageSize: 100 }),
  });

  const productsQuery = useQuery({
    queryKey: ['products', 'active'],
    queryFn: () => productApi.list({ isActive: true, pageSize: 200 }),
  });

  const createCustomerMutation = useMutation({
    mutationFn: () =>
      customerApi.create({
        name: qaName,
        phone: qaPhone,
        address: qaAddress || undefined,
      }),
    onSuccess: (c) => {
      Toast.show({ type: 'success', text1: 'Đã thêm khách hàng' });
      setCustomerId(c.id);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      customersQuery.refetch();
      setQuickAddOpen(false);
      setQaName('');
      setQaPhone('');
      setQaAddress('');
    },
    onError: (err) =>
      Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  const createOrderMutation = useMutation({
    mutationFn: () =>
      orderApi.create({
        customerId,
        note: note || undefined,
        pickupAt: pickupAt ? pickupAt.toISOString() : undefined,
        items: items.map((i) => ({
          productId: i.productId || undefined,
          name: i.name,
          quantity: Number(i.quantity),
          weight: i.weight ? Number(i.weight) : undefined,
          unitPrice: Number(i.unitPrice),
        })),
      }),
    onSuccess: (order) => {
      // Invalidate để Dashboard / OrdersScreen / Audit refresh ngay
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['report'] });
      queryClient.invalidateQueries({ queryKey: ['customer', customerId, 'stats'] });
      Toast.show({ type: 'success', text1: `Tạo đơn ${order.code} thành công` });
      navigation.replace('OrderDetail', { id: order.id, autoPrint: true });
    },
    onError: (err) =>
      Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  const customer = useMemo<Customer | undefined>(
    () => customersQuery.data?.items.find((c) => c.id === customerId),
    [customersQuery.data, customerId],
  );

  const total = useMemo(
    () => items.reduce((sum, i) => sum + calcLineTotal(i), 0),
    [items],
  );

  function adjustQuantity(i: number, delta: number) {
    setItems((arr) =>
      arr.map((it, idx) => {
        if (idx !== i) return it;
        const next = Math.max(1, Number(it.quantity || 1) + delta);
        const product = productsQuery.data?.items.find((p) => p.id === it.productId);
        const newPrice = product?.wholesaleEnabled
          ? String(getEffectivePrice(product, next))
          : it.unitPrice;
        return { ...it, quantity: String(next), unitPrice: newPrice };
      }),
    );
  }

  function updateItem(i: number, patch: Partial<DraftItem>) {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  /** Cho phép xoá tự do khi đang nhập — KHÔNG force min=1 ở đây */
  function onQuantityInput(i: number, value: string) {
    // Chỉ giữ ký tự số nguyên dương
    const cleaned = value.replace(/[^0-9]/g, '');
    const it = items[i];
    // Tính giá theo qty hiện tại (nếu rỗng → dùng 1 để tính giá)
    const qty = Math.max(1, parseInt(cleaned, 10) || 1);
    const product = productsQuery.data?.items.find((p) => p.id === it?.productId);
    const newPrice = product?.wholesaleEnabled
      ? String(getEffectivePrice(product, qty))
      : it?.unitPrice;
    // Lưu cleaned (có thể là "") để input không bị snap back
    updateItem(i, { quantity: cleaned, unitPrice: newPrice });
  }

  /** Khi rời ô số lượng: nếu trống hoặc = 0 → reset về "1" */
  function onQuantityBlur(i: number) {
    const q = parseInt(items[i]?.quantity ?? '', 10);
    if (!q || q < 1) {
      updateItem(i, { quantity: '1' });
    }
  }

  function pickProduct(i: number, p: Product) {
    const qty = Number(items[i]?.quantity || 1);
    updateItem(i, {
      productId: p.id,
      name: p.name,
      unitPrice: String(getEffectivePrice(p, qty)),
    });
    setProductPickerFor(null);
  }

  function removeItem(i: number) {
    setItems((arr) => arr.filter((_, idx) => idx !== i));
  }

  function addItem() {
    setItems((arr) => {
      const next = [...arr, { ...emptyItem }];
      // Tự động mở picker cho dòng vừa thêm
      setProductPickerFor(next.length - 1);
      return next;
    });
  }

  function handleSubmit() {
    if (!customerId) {
      Toast.show({ type: 'error', text1: 'Vui lòng chọn khách hàng' });
      return;
    }
    if (items.length === 0) {
      Toast.show({ type: 'error', text1: 'Vui lòng thêm ít nhất 1 dịch vụ' });
      return;
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.name.trim()) {
        Toast.show({ type: 'error', text1: `Vui lòng chọn dịch vụ cho dòng ${i + 1}` });
        return;
      }
      if (Number(it.quantity) <= 0) {
        Toast.show({ type: 'error', text1: 'Số lượng phải > 0' });
        return;
      }
    }
    createOrderMutation.mutate();
  }

  if (!canCreate) {
    return (
      <View style={[styles.container, { padding: spacing.xl }]}>
        <EmptyState
          title="Không có quyền truy cập"
          description="Chỉ quản lý mới có quyền tạo đơn hàng. Vui lòng liên hệ quản lý."
          icon={<Icon name="lock-outline" size={48} color={colors.textMuted} />}
        />
        <Button variant="outline" onPress={() => navigation.goBack()}>
          Quay lại
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        padding: isPhone ? spacing.md : spacing.lg,
        gap: spacing.lg,
        paddingBottom: 140,
      }}
    >
      {/* Customer */}
      <Card>
        <CardHeader><CardTitle>Khách hàng</CardTitle></CardHeader>
        <CardContent style={{ gap: spacing.sm }}>
          {customer ? (
            <View style={styles.customerBox}>
              <View style={styles.customerAvatar}>
                <Icon name="account" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.customerName}>{customer.name}</Text>
                <Text style={styles.customerMeta}>{customer.phone}</Text>
                {customer.address && (
                  <Text style={styles.customerMeta}>{customer.address}</Text>
                )}
              </View>
              <Button variant="outline" size="sm" onPress={() => setCustomerPickerOpen(true)}>
                Đổi
              </Button>
            </View>
          ) : (
            <View style={{ flexDirection: isPhone ? 'column' : 'row', gap: spacing.md }}>
              <Button
                onPress={() => setCustomerPickerOpen(true)}
                leftIcon={<Icon name="account-search" size={20} color="#fff" />}
                style={{ flex: isPhone ? undefined : 1 }}
              >
                Chọn khách hàng
              </Button>
              <Button
                variant="outline"
                onPress={() => setQuickAddOpen(true)}
                leftIcon={<Icon name="account-plus" size={20} color={colors.text} />}
                style={{ flex: isPhone ? undefined : 1 }}
              >
                Thêm mới
              </Button>
            </View>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader
          style={{
            flexDirection: isPhone ? 'column' : 'row',
            alignItems: isPhone ? 'stretch' : 'center',
            justifyContent: 'space-between',
            gap: spacing.sm,
          }}
        >
          <CardTitle>Dịch vụ</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onPress={addItem}
            leftIcon={<Icon name="plus" size={18} color={colors.text} />}
          >
            Thêm dòng
          </Button>
        </CardHeader>
        <CardContent style={{ gap: spacing.sm }}>
          {items.map((it, i) => (
            <View key={i} style={styles.itemCard}>
              <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                <Text style={{ fontWeight: '700', color: colors.textMuted, width: 24 }}>
                  {i + 1}.
                </Text>
                <Pressable
                  onPress={() => setProductPickerFor(i)}
                  style={[styles.pickProductBig, !it.name && styles.pickProductEmpty]}
                >
                  <Icon
                    name={it.name ? 'tag' : 'tag-plus-outline'}
                    size={18}
                    color={it.name ? colors.primary : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.pickProductBigText,
                      !it.name && { color: colors.textMuted, fontWeight: '500' },
                    ]}
                    numberOfLines={1}
                  >
                    {it.name || 'Chọn dịch vụ'}
                  </Text>
                  <Icon name="chevron-right" size={18} color={colors.textMuted} />
                </Pressable>
                {items.length > 1 && (
                  <Pressable onPress={() => removeItem(i)} style={styles.removeBtn}>
                    <Icon name="close" size={18} color={colors.danger} />
                  </Pressable>
                )}
              </View>

              <View
                style={{
                  flexDirection: isPhone ? 'column' : 'row',
                  gap: spacing.md,
                  alignItems: isPhone ? 'stretch' : 'flex-start',
                }}
              >
                <View style={{ flex: isPhone ? undefined : 1.3 }}>
                  <Text style={styles.fieldLabel}>SL</Text>
                  <View style={styles.stepperRow}>
                    <Pressable
                      onPress={() => adjustQuantity(i, -1)}
                      style={styles.stepBtn}
                      hitSlop={6}
                    >
                      <Icon name="minus" size={20} color={colors.text} />
                    </Pressable>
                    <View style={styles.stepInputWrap}>
                      <Input
                        value={it.quantity}
                        onChangeText={(v) => onQuantityInput(i, v)}
                        onBlur={() => onQuantityBlur(i)}
                        keyboardType="number-pad"
                        style={styles.stepInputText}
                      />
                    </View>
                    <Pressable
                      onPress={() => adjustQuantity(i, 1)}
                      style={styles.stepBtn}
                      hitSlop={6}
                    >
                      <Icon name="plus" size={20} color={colors.text} />
                    </Pressable>
                  </View>
                </View>
                <View style={{ flex: isPhone ? undefined : 1 }}>
                  <Input
                    label="Cân (kg)"
                    value={it.weight}
                    onChangeText={(v) => updateItem(i, { weight: v.replace(',', '.') })}
                    keyboardType="decimal-pad"
                    placeholder="—"
                  />
                </View>
                <View style={{ flex: isPhone ? undefined : 1.6 }}>
                  <Input
                    label="Đơn giá"
                    value={it.unitPrice}
                    onChangeText={(v) => updateItem(i, { unitPrice: v })}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <View style={[styles.subtotalRow, isPhone && styles.subtotalRowPhone]}>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                  Thành tiền
                  {it.weight && Number(it.weight) > 0
                    ? `  (${it.weight}kg × ${formatCurrency(Number(it.unitPrice || 0))}${Number(it.quantity) > 1 ? ` × ${it.quantity}` : ''})`
                    : ''}
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.primary }}>
                  {formatCurrency(calcLineTotal(it))}
                </Text>
              </View>
            </View>
          ))}
        </CardContent>
      </Card>

      {/* Pickup & note */}
      <Card>
        <CardHeader><CardTitle>Thông tin thêm</CardTitle></CardHeader>
        <CardContent style={{ gap: spacing.md }}>
          <View>
            <Text style={styles.fieldLabel}>Hẹn lấy đồ</Text>
            <Pressable onPress={() => setShowPickupPicker(true)} style={styles.dateBtn}>
              <Icon name="calendar-clock" size={18} color={colors.textMuted} />
              <Text style={styles.dateBtnText}>
                {pickupAt ? formatDateTime(pickupAt) : 'Chọn ngày & giờ'}
              </Text>
              {pickupAt && (
                <Pressable onPress={() => setPickupAt(null)} hitSlop={8}>
                  <Icon name="close" size={18} color={colors.textMuted} />
                </Pressable>
              )}
            </Pressable>
            {showPickupPicker && (
              <DateTimePicker
                value={pickupAt ?? new Date()}
                mode="datetime"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, d) => {
                  setShowPickupPicker(Platform.OS === 'ios');
                  if (d) setPickupAt(d);
                }}
              />
            )}
          </View>

          <Input
            label="Ghi chú"
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />
        </CardContent>
      </Card>

      {/* Customer picker modal */}
      <Modal
        visible={customerPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomerPickerOpen(false)}
      >
        <View style={[styles.modalBackdrop, isPhone && styles.modalBackdropPhone]}>
          <View style={[styles.modalCard, isPhone && styles.modalCardPhone]}>
            <Text style={styles.modalTitle}>Chọn khách hàng</Text>
            <Input
              placeholder="Tìm tên, SĐT..."
              value={customerSearch}
              onChangeText={setCustomerSearch}
              leftIcon={<Icon name="magnify" size={20} color={colors.textMuted} />}
            />
            <ScrollView style={{ maxHeight: isPhone ? 300 : 360 }}>
              <View style={{ gap: 4 }}>
                {(customersQuery.data?.items ?? []).map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      setCustomerId(c.id);
                      setCustomerPickerOpen(false);
                    }}
                    style={styles.pickerItem}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerName}>{c.name}</Text>
                      <Text style={styles.pickerMeta}>{c.phone}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <View style={[styles.modalActions, isPhone && styles.modalActionsPhone]}>
              <Button
                variant="outline"
                onPress={() => {
                  setCustomerPickerOpen(false);
                  setQuickAddOpen(true);
                }}
                leftIcon={<Icon name="plus" size={18} color={colors.text} />}
                style={{ flex: 1 }}
              >
                Thêm mới
              </Button>
              <Button
                variant="ghost"
                onPress={() => setCustomerPickerOpen(false)}
                style={{ flex: 1 }}
              >
                Đóng
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Quick add customer */}
      <Modal
        visible={quickAddOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setQuickAddOpen(false)}
      >
        <View style={[styles.modalBackdrop, isPhone && styles.modalBackdropPhone]}>
          <View style={[styles.modalCard, isPhone && styles.modalCardPhone]}>
            <Text style={styles.modalTitle}>Thêm khách hàng nhanh</Text>
            <Input label="Tên" required value={qaName} onChangeText={setQaName} />
            <Input
              label="Số điện thoại"
              required
              value={qaPhone}
              onChangeText={setQaPhone}
              keyboardType="phone-pad"
            />
            <Input label="Địa chỉ" value={qaAddress} onChangeText={setQaAddress} />
            <View style={[styles.modalActions, isPhone && styles.modalActionsPhone]}>
              <Button variant="ghost" onPress={() => setQuickAddOpen(false)} style={{ flex: isPhone ? undefined : 1 }}>
                Huỷ
              </Button>
              <Button
                onPress={() => {
                  if (!qaName.trim() || !qaPhone.trim()) {
                    Toast.show({ type: 'error', text1: 'Vui lòng nhập tên và SĐT' });
                    return;
                  }
                  createCustomerMutation.mutate();
                }}
                loading={createCustomerMutation.isPending}
                style={{ flex: isPhone ? undefined : 1 }}
              >
                Lưu
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Product picker */}
      <Modal
        visible={productPickerFor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setProductPickerFor(null)}
      >
        <View style={[styles.modalBackdrop, isPhone && styles.modalBackdropPhone]}>
          <View style={[styles.modalCard, isPhone && styles.modalCardPhone]}>
            <Text style={styles.modalTitle}>Chọn dịch vụ</Text>
            {productsQuery.isLoading ? (
              <Text style={styles.emptyMsg}>Đang tải dịch vụ…</Text>
            ) : (productsQuery.data?.items ?? []).length === 0 ? (
              <View style={styles.emptyBox}>
                <Icon name="tag-off-outline" size={42} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>Chưa có dịch vụ nào</Text>
                <Text style={styles.emptyDesc}>
                  Bạn cần thêm dịch vụ (giặt sấy, giặt khô, ủi...) ở mục Dịch vụ trước khi tạo đơn.
                </Text>
                <Button
                  onPress={() => {
                    setProductPickerFor(null);
                    navigation.navigate('Main', { screen: 'Products' });
                  }}
                  leftIcon={<Icon name="plus" size={20} color="#fff" />}
                  style={{ marginTop: spacing.sm }}
                >
                  Đi đến quản lý dịch vụ
                </Button>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: isPhone ? 340 : 420 }}>
                <View style={{ gap: 4 }}>
                  {(productsQuery.data?.items ?? []).map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => productPickerFor !== null && pickProduct(productPickerFor, p)}
                      style={[styles.pickerItem, isPhone && styles.pickerItemPhone]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickerName}>{p.name}</Text>
                        <Text style={styles.pickerMeta}>
                          {p.unit}
                          {p.wholesaleEnabled ? '  · Bán sỉ' : ''}
                        </Text>
                        {p.wholesaleEnabled && p.wholesaleTiers && p.wholesaleTiers.length > 0 && (
                          <Text style={styles.pickerTiers}>
                            {p.wholesaleTiers
                              .sort((a, b) => a.minQty - b.minQty)
                              .map((t) => `≥${t.minQty}: ${formatCurrency(t.price)}`)
                              .join('  ·  ')}
                          </Text>
                        )}
                      </View>
                      <Text style={{ fontWeight: '700', color: colors.primary, flexShrink: 0 }}>
                        {formatCurrency(p.price)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            )}
            <View style={[styles.modalActions, isPhone && styles.modalActionsPhone]}>
              <Button variant="ghost" onPress={() => setProductPickerFor(null)} style={{ flex: isPhone ? undefined : 1 }}>
                Đóng
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>

    {/* Footer cố định — tổng tiền + nút tạo đơn */}
    <View style={styles.footer}>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Tổng cộng</Text>
        <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
      </View>
      <View style={{ flexDirection: isPhone ? 'column' : 'row', gap: spacing.md }}>
        <Button
          variant="outline"
          onPress={() => navigation.goBack()}
          style={{ flex: isPhone ? undefined : 1 }}
        >
          Huỷ
        </Button>
        <Button
          size="lg"
          onPress={handleSubmit}
          loading={createOrderMutation.isPending}
          style={{ flex: isPhone ? undefined : 2 }}
          leftIcon={<Icon name="check" size={22} color="#fff" />}
        >
          Tạo đơn
        </Button>
      </View>
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  customerBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, backgroundColor: colors.background,
    borderRadius: radius.md,
  },
  customerAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  customerName: { fontSize: 16, fontWeight: '700', color: colors.text },
  customerMeta: { fontSize: 13, color: colors.textMuted },
  itemCard: {
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  pickProductBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    backgroundColor: colors.card, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border, alignSelf: 'flex-start',
  },
  pickProductBig: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 48,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickProductEmpty: {
    borderStyle: 'dashed',
  },
  pickProductBigText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  removeBtn: {
    width: 32, height: 32, borderRadius: radius.sm,
    backgroundColor: colors.dangerLight,
    alignItems: 'center', justifyContent: 'center',
  },
  subtotalRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border,
  },
  subtotalRowPhone: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: spacing.xs,
  },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stepBtn: {
    width: 40, height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepInputWrap: {
    flex: 1,
  },
  stepInputText: {
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 16,
  },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, height: 52,
    backgroundColor: colors.inputBg,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
  },
  dateBtnText: { fontSize: 15, color: colors.text, flex: 1 },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
  totalValue: { fontSize: 22, fontWeight: '700', color: colors.primary },
  modalBackdrop: {
    flex: 1, backgroundColor: colors.overlay,
    alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
  },
  modalBackdropPhone: {
    padding: spacing.md,
  },
  modalCard: {
    width: '100%', maxWidth: 600,
    backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.xl, gap: spacing.lg,
    maxHeight: '92%',
  },
  modalCardPhone: {
    padding: spacing.lg,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  modalActionsPhone: { flexDirection: 'column' },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderRadius: radius.md, backgroundColor: colors.background,
  },
  pickerItemPhone: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  pickerName: { fontSize: 15, fontWeight: '600', color: colors.text },
  pickerMeta: { fontSize: 12, color: colors.textMuted },
  pickerTiers: { fontSize: 11, color: '#3b82f6', marginTop: 2 },
  emptyMsg: { textAlign: 'center', color: colors.textMuted, paddingVertical: spacing.xl },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptyDesc: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    lineHeight: 18,
  },
});
