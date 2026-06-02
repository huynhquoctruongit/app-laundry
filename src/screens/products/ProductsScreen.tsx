import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/common/EmptyState';
import { ReadOnlyBanner } from '@/components/common/ReadOnlyBanner';
import { productApi } from '@/api/product.api';
import { extractError } from '@/api/client';
import { usePermissions } from '@/hooks/usePermissions';
import { useResponsive } from '@/hooks/useResponsive';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { formatCurrency } from '@/lib/utils';
import type { Paginated, Product, WholesaleTier } from '@/types/api';

// Form state for a wholesale tier row (strings for controlled inputs)
interface TierRow { minQty: string; price: string }

const DEFAULT_TIERS: TierRow[] = [
  { minQty: '1', price: '' },
  { minQty: '5', price: '' },
  { minQty: '10', price: '' },
];

export function ProductsScreen() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { isPhone } = useResponsive();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  // Basic fields
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState('');
  const [importPrice, setImportPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [note, setNote] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [hiddenFromBooking, setHiddenFromBooking] = useState(false);

  // Wholesale
  const [wholesaleEnabled, setWholesaleEnabled] = useState(false);
  const [tiers, setTiers] = useState<TierRow[]>(DEFAULT_TIERS);

  const listQuery = useQuery({
    queryKey: ['products', { search }],
    queryFn: () => productApi.list({ search: search || undefined, pageSize: 100 }),
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => productApi.reorder(ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
    onError: (err) => {
      Toast.show({ type: 'error', text1: extractError(err).message });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  // Kéo-thả sắp xếp ưu tiên: chỉ bật khi có quyền sửa & KHÔNG đang tìm kiếm
  const dragEnabled = canEdit && !search.trim();
  const handleDragEnd = ({ data }: { data: Product[] }) => {
    // Cập nhật cache ngay để giữ thứ tự mới, rồi lưu xuống server
    queryClient.setQueryData<Paginated<Product>>(['products', { search }], (old) =>
      old ? { ...old, items: data } : old,
    );
    reorderMutation.mutate(data.map((p) => p.id));
  };

  function buildTiersPayload(): WholesaleTier[] | null {
    if (!wholesaleEnabled) return null;
    const result: WholesaleTier[] = [];
    for (const t of tiers) {
      const qty = parseInt(t.minQty, 10);
      const p = parseFloat(t.price);
      if (qty > 0 && !isNaN(p) && p >= 0) result.push({ minQty: qty, price: p });
    }
    return result.length > 0 ? result : null;
  }

  const createMutation = useMutation({
    mutationFn: () =>
      productApi.create({
        name,
        unit: unit || undefined,
        price: Number(price),
        importPrice: importPrice ? Number(importPrice) : undefined,
        costPrice: costPrice ? Number(costPrice) : undefined,
        wholesaleEnabled,
        wholesaleTiers: buildTiersPayload(),
        note: note || undefined,
        isActive,
        hiddenFromBooking,
      }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã thêm dịch vụ' });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      closeForm();
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      productApi.update(editing!.id, {
        name,
        unit: unit || undefined,
        price: Number(price),
        importPrice: importPrice ? Number(importPrice) : undefined,
        costPrice: costPrice ? Number(costPrice) : undefined,
        wholesaleEnabled,
        wholesaleTiers: buildTiersPayload(),
        note: note || undefined,
        isActive,
        hiddenFromBooking,
      }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã cập nhật dịch vụ' });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      closeForm();
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productApi.remove(id),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã xoá dịch vụ' });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  function openCreate() {
    setEditing(null);
    setName('');
    setUnit('');
    setPrice('');
    setImportPrice('');
    setCostPrice('');
    setNote('');
    setIsActive(true);
    setHiddenFromBooking(false);
    setWholesaleEnabled(false);
    setTiers(DEFAULT_TIERS);
    setFormOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setName(p.name);
    setUnit(p.unit);
    setPrice(String(p.price ?? ''));
    setImportPrice(p.importPrice != null ? String(p.importPrice) : '');
    setCostPrice(p.costPrice != null ? String(p.costPrice) : '');
    setNote(p.note ?? '');
    setIsActive(p.isActive);
    setHiddenFromBooking(p.hiddenFromBooking ?? false);
    setWholesaleEnabled(p.wholesaleEnabled ?? false);
    setTiers(
      p.wholesaleTiers && p.wholesaleTiers.length > 0
        ? p.wholesaleTiers.map((t) => ({ minQty: String(t.minQty), price: String(t.price) }))
        : DEFAULT_TIERS,
    );
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  function confirmDelete(p: Product) {
    Alert.alert('Xoá dịch vụ', `Bạn có chắc muốn xoá ${p.name}?`, [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Xoá', style: 'destructive', onPress: () => deleteMutation.mutate(p.id) },
    ]);
  }

  function handleSubmit() {
    if (!name.trim() || !price.trim()) {
      Toast.show({ type: 'error', text1: 'Vui lòng nhập tên và giá' });
      return;
    }
    if (editing) updateMutation.mutate();
    else createMutation.mutate();
  }

  function updateTier(index: number, field: keyof TierRow, value: string) {
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  }

  function addTier() {
    setTiers((prev) => [...prev, { minQty: '', price: '' }]);
  }

  function removeTier(index: number) {
    setTiers((prev) => prev.filter((_, i) => i !== index));
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <View style={styles.container}>
      <View style={[styles.header, isPhone && styles.headerPhone]}>
        <View
          style={{
            flex: isPhone ? undefined : 1,
            maxWidth: isPhone ? undefined : 360,
            alignSelf: 'stretch',
          }}
        >
          <Input
            placeholder="Tìm dịch vụ..."
            value={search}
            onChangeText={setSearch}
            leftIcon={<Icon name="magnify" size={20} color={colors.textMuted} />}
          />
        </View>
        {canCreate && (
          <Button
            onPress={openCreate}
            leftIcon={<Icon name="plus" size={20} color="#fff" />}
            style={isPhone ? { alignSelf: 'stretch' } : undefined}
          >
            Thêm dịch vụ
          </Button>
        )}
      </View>

      {!canEdit && <ReadOnlyBanner />}
      {dragEnabled && (
        <Text style={styles.dragHint}>
          Giữ và kéo biểu tượng ≡ để sắp xếp thứ tự ưu tiên (áp dụng khi tạo đơn)
        </Text>
      )}

      <DraggableFlatList
        data={listQuery.data?.items ?? []}
        keyExtractor={(item) => item.id}
        onDragEnd={handleDragEnd}
        activationDistance={12}
        contentContainerStyle={{ padding: isPhone ? spacing.md : spacing.lg, gap: spacing.sm }}
        refreshing={listQuery.isFetching}
        onRefresh={() => listQuery.refetch()}
        renderItem={({ item, drag, isActive }: RenderItemParams<Product>) => (
          <ScaleDecorator>
            <Pressable
              onPress={canEdit ? () => openEdit(item) : undefined}
              disabled={isActive}
            >
              <Card>
                <CardContent style={isPhone ? StyleSheet.flatten([styles.row, styles.rowPhone]) : styles.row}>
                  <View style={{ flex: isPhone ? undefined : 1, gap: 4 }}>
                    <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Text style={styles.name}>{item.name}</Text>
                      {!item.isActive && <Badge bg={colors.dangerLight} fg={colors.danger}>Tạm ngưng</Badge>}
                      {item.wholesaleEnabled && <Badge bg="#eff6ff" fg="#3b82f6">Bán sỉ</Badge>}
                    </View>
                    <Text style={styles.meta}>
                      Đơn vị: {item.unit || '—'}
                      {item.importPrice != null ? `  ·  Nhập: ${formatCurrency(item.importPrice)}` : ''}
                      {item.costPrice != null ? `  ·  Vốn: ${formatCurrency(item.costPrice)}` : ''}
                    </Text>
                    {item.wholesaleEnabled && item.wholesaleTiers && item.wholesaleTiers.length > 0 && (
                      <Text style={styles.tiersMeta}>
                        Sỉ: {item.wholesaleTiers
                          .sort((a, b) => a.minQty - b.minQty)
                          .map((t) => `≥${t.minQty}: ${formatCurrency(t.price)}`)
                          .join('  ·  ')}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: isPhone ? 'stretch' : 'flex-end', gap: 4 }}>
                    <Text style={styles.price}>{formatCurrency(item.price)}</Text>
                    {(dragEnabled || canEdit || canDelete) && (
                      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                        {dragEnabled && (
                          <Pressable
                            onLongPress={drag}
                            delayLongPress={120}
                            hitSlop={8}
                            style={styles.iconBtn}
                          >
                            <Icon name="drag-horizontal-variant" size={20} color={colors.textMuted} />
                          </Pressable>
                        )}
                        {canEdit && (
                          <Pressable onPress={() => openEdit(item)} style={styles.iconBtn}>
                            <Icon name="pencil" size={18} color={colors.textMuted} />
                          </Pressable>
                        )}
                        {canDelete && (
                          <Pressable onPress={() => confirmDelete(item)} style={styles.iconBtn}>
                            <Icon name="trash-can-outline" size={18} color={colors.danger} />
                          </Pressable>
                        )}
                      </View>
                    )}
                  </View>
                </CardContent>
              </Card>
            </Pressable>
          </ScaleDecorator>
        )}
        ListEmptyComponent={!listQuery.isLoading ? <EmptyState title="Chưa có dịch vụ" /> : null}
      />

      <Modal visible={formOpen} transparent animationType="fade" onRequestClose={closeForm}>
        <View style={[styles.modalBackdrop, isPhone && styles.modalBackdropPhone]}>
          <View style={[styles.modalCard, isPhone && styles.modalCardPhone]}>
            <Text style={styles.modalTitle}>
              {editing ? 'Sửa dịch vụ' : 'Thêm dịch vụ'}
            </Text>
            <ScrollView
              style={isPhone ? { maxHeight: 480 } : undefined}
              contentContainerStyle={{ gap: spacing.md }}
              keyboardShouldPersistTaps="handled"
            >
              <Input label="Tên dịch vụ" required value={name} onChangeText={setName} placeholder="VD: Giặt sấy" />

              <View style={{ flexDirection: isPhone ? 'column' : 'row', gap: spacing.md }}>
                <View style={{ flex: isPhone ? undefined : 1 }}>
                  <Input label="Đơn vị" value={unit} onChangeText={setUnit} placeholder="cái, kg..." />
                </View>
                <View style={{ flex: isPhone ? undefined : 1 }}>
                  <Input
                    label="Giá lẻ"
                    required
                    value={price}
                    onChangeText={setPrice}
                    placeholder="50000"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={{ flexDirection: isPhone ? 'column' : 'row', gap: spacing.md }}>
                <View style={{ flex: isPhone ? undefined : 1 }}>
                  <Input
                    label="Giá nhập"
                    value={importPrice}
                    onChangeText={setImportPrice}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: isPhone ? undefined : 1 }}>
                  <Input
                    label="Giá vốn"
                    value={costPrice}
                    onChangeText={setCostPrice}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* ── Bán sỉ toggle ── */}
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Bán sỉ (giảm giá theo số lượng)</Text>
                  <Text style={styles.switchSub}>Tự động áp giá khi số lượng đủ mức</Text>
                </View>
                <Switch value={wholesaleEnabled} onValueChange={setWholesaleEnabled} />
              </View>

              {/* ── Tier rows ── */}
              {wholesaleEnabled && (
                <View style={styles.tiersBox}>
                  <View style={styles.tiersHeader}>
                    <Text style={[styles.tierCol, { flex: 1 }]}>SL tối thiểu</Text>
                    <Text style={[styles.tierCol, { flex: 1 }]}>Giá / đơn vị</Text>
                    <View style={{ width: 32 }} />
                  </View>
                  {tiers.map((tier, index) => (
                    <View key={index} style={styles.tierRow}>
                      <Input
                        style={{ flex: 1 }}
                        placeholder="VD: 5"
                        value={tier.minQty}
                        onChangeText={(v) => updateTier(index, 'minQty', v)}
                        keyboardType="numeric"
                      />
                      <Input
                        style={{ flex: 1 }}
                        placeholder="VD: 15000"
                        value={tier.price}
                        onChangeText={(v) => updateTier(index, 'price', v)}
                        keyboardType="numeric"
                      />
                      <TouchableOpacity
                        onPress={() => tiers.length > 1 && removeTier(index)}
                        style={[styles.tierRemove, tiers.length <= 1 && { opacity: 0.3 }]}
                        disabled={tiers.length <= 1}
                      >
                        <Icon name="close" size={16} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {tiers.length < 6 && (
                    <TouchableOpacity onPress={addTier} style={styles.tierAddBtn}>
                      <Icon name="plus" size={16} color={colors.primary} />
                      <Text style={styles.tierAddText}>Thêm mức giá</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={styles.tiersHint}>
                    Nếu SL không khớp mức nào → áp giá lẻ
                  </Text>
                </View>
              )}

              <Input
                label="Ghi chú"
                value={note}
                onChangeText={setNote}
                placeholder="Ghi chú thêm"
                multiline
                numberOfLines={3}
                style={{ minHeight: 72, textAlignVertical: 'top' }}
              />
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Đang bán</Text>
                <Switch value={isActive} onValueChange={setIsActive} />
              </View>
              <View style={styles.switchRow}>
                <View style={{ flex: 1, paddingRight: spacing.md }}>
                  <Text style={styles.switchLabel}>Ẩn khỏi web đặt lịch</Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted }}>
                    Dịch vụ nội bộ (Phụ thu…) sẽ không hiện cho khách khi đặt qua QR
                  </Text>
                </View>
                <Switch value={hiddenFromBooking} onValueChange={setHiddenFromBooking} />
              </View>
            </ScrollView>
            <View style={[styles.modalActions, isPhone && styles.modalActionsPhone]}>
              <Button variant="ghost" onPress={closeForm} style={{ flex: isPhone ? undefined : 1 }}>Huỷ</Button>
              <Button onPress={handleSubmit} loading={isPending} style={{ flex: isPhone ? undefined : 1 }}>Lưu</Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerPhone: {
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  rowPhone: {
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: spacing.md,
  },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
  tiersMeta: { fontSize: 12, color: '#3b82f6', marginTop: 2 },
  price: { fontSize: 16, fontWeight: '700', color: colors.primary },
  dragHint: {
    fontSize: 12,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalBackdropPhone: { padding: spacing.md },
  modalCard: {
    width: '100%',
    maxWidth: 640,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.lg,
    maxHeight: '92%',
  },
  modalCardPhone: { padding: spacing.lg },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  modalActionsPhone: { flexDirection: 'column' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  switchLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  switchSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  // Tiers
  tiersBox: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  tiersHeader: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  tierCol: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  tierRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  tierRemove: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  tierAddText: { fontSize: 14, color: colors.primary, fontWeight: '500' },
  tiersHint: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
