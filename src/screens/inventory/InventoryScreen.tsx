import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/common/EmptyState';
import { ReadOnlyBanner } from '@/components/common/ReadOnlyBanner';
import { inventoryApi, type InventoryLogType } from '@/api/inventory.api';
import { extractError } from '@/api/client';
import { usePermissions } from '@/hooks/usePermissions';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { InventoryItem } from '@/types/api';

const LOG_TYPE_LABEL: Record<InventoryLogType, string> = {
  IMPORT: 'Nhập',
  EXPORT: 'Xuất',
  ADJUST: 'Điều chỉnh',
};

const LOG_TYPE_COLOR: Record<InventoryLogType, { bg: string; fg: string }> = {
  IMPORT: { bg: colors.successLight, fg: colors.success },
  EXPORT: { bg: colors.warningLight, fg: colors.warning },
  ADJUST: { bg: colors.infoLight, fg: colors.info },
};

export function InventoryScreen() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [tab, setTab] = useState<'items' | 'logs'>('items');
  const [search, setSearch] = useState('');

  const [itemOpen, setItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [logTarget, setLogTarget] = useState<InventoryItem | null>(null);

  // Item form
  const [iName, setIName] = useState('');
  const [iUnit, setIUnit] = useState('');
  const [iQuantity, setIQuantity] = useState('');
  const [iMinQuantity, setIMinQuantity] = useState('');
  const [iImportPrice, setIImportPrice] = useState('');
  const [iNote, setINote] = useState('');
  const [iIsActive, setIIsActive] = useState(true);

  // Log form
  const [logType, setLogType] = useState<InventoryLogType>('IMPORT');
  const [logQuantity, setLogQuantity] = useState('');
  const [logUnitPrice, setLogUnitPrice] = useState('');
  const [logNote, setLogNote] = useState('');

  const itemsQuery = useQuery({
    queryKey: ['inventory', 'items', { search }],
    queryFn: () => inventoryApi.items.list({ search: search || undefined, pageSize: 100 }),
  });

  const logsQuery = useQuery({
    queryKey: ['inventory', 'logs'],
    queryFn: () => inventoryApi.logs.list({ pageSize: 50 }),
    enabled: tab === 'logs',
  });

  const lowStockQuery = useQuery({
    queryKey: ['inventory', 'low-stock'],
    queryFn: () => inventoryApi.lowStock(),
  });

  const lowStock = lowStockQuery.data ?? [];

  const createItemMutation = useMutation({
    mutationFn: () =>
      inventoryApi.items.create({
        name: iName,
        unit: iUnit,
        quantity: iQuantity ? Number(iQuantity) : undefined,
        minQuantity: iMinQuantity ? Number(iMinQuantity) : undefined,
        importPrice: iImportPrice ? Number(iImportPrice) : undefined,
        note: iNote || undefined,
        isActive: iIsActive,
      }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã thêm mặt hàng' });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      closeItemForm();
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  const updateItemMutation = useMutation({
    mutationFn: () =>
      inventoryApi.items.update(editingItem!.id, {
        name: iName,
        unit: iUnit,
        minQuantity: iMinQuantity ? Number(iMinQuantity) : undefined,
        importPrice: iImportPrice ? Number(iImportPrice) : undefined,
        note: iNote || undefined,
        isActive: iIsActive,
      }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã cập nhật mặt hàng' });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      closeItemForm();
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.items.remove(id),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã xoá mặt hàng' });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  const createLogMutation = useMutation({
    mutationFn: () =>
      inventoryApi.logs.create({
        itemId: logTarget!.id,
        type: logType,
        quantity: Number(logQuantity),
        unitPrice: logUnitPrice ? Number(logUnitPrice) : undefined,
        note: logNote || undefined,
      }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã lưu phiếu' });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      closeLogForm();
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  function openCreateItem() {
    setEditingItem(null);
    setIName('');
    setIUnit('');
    setIQuantity('');
    setIMinQuantity('');
    setIImportPrice('');
    setINote('');
    setIIsActive(true);
    setItemOpen(true);
  }

  function openEditItem(it: InventoryItem) {
    setEditingItem(it);
    setIName(it.name);
    setIUnit(it.unit);
    setIQuantity(String(it.quantity));
    setIMinQuantity(it.minQuantity != null ? String(it.minQuantity) : '');
    setIImportPrice(it.importPrice != null ? String(it.importPrice) : '');
    setINote(it.note ?? '');
    setIIsActive(it.isActive);
    setItemOpen(true);
  }

  function closeItemForm() {
    setItemOpen(false);
    setEditingItem(null);
  }

  function openLogFor(it: InventoryItem) {
    setLogTarget(it);
    setLogType('IMPORT');
    setLogQuantity('');
    setLogUnitPrice(it.importPrice != null ? String(it.importPrice) : '');
    setLogNote('');
    setLogOpen(true);
  }

  function closeLogForm() {
    setLogOpen(false);
    setLogTarget(null);
  }

  function confirmDeleteItem(it: InventoryItem) {
    Alert.alert('Xoá mặt hàng', `Bạn có chắc muốn xoá ${it.name}?`, [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Xoá', style: 'destructive', onPress: () => deleteItemMutation.mutate(it.id) },
    ]);
  }

  function handleSubmitItem() {
    if (!iName.trim() || !iUnit.trim()) {
      Toast.show({ type: 'error', text1: 'Vui lòng nhập tên và đơn vị' });
      return;
    }
    if (editingItem) updateItemMutation.mutate();
    else createItemMutation.mutate();
  }

  function handleSubmitLog() {
    if (!logQuantity || Number(logQuantity) <= 0) {
      Toast.show({ type: 'error', text1: 'Số lượng phải > 0' });
      return;
    }
    createLogMutation.mutate();
  }

  const isItemPending = createItemMutation.isPending || updateItemMutation.isPending;

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, tab === 'items' && styles.tabActive]}
          onPress={() => setTab('items')}
        >
          <Icon name="package-variant" size={18} color={tab === 'items' ? colors.primary : colors.textMuted} />
          <Text style={[styles.tabText, tab === 'items' && styles.tabTextActive]}>Hàng hóa</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'logs' && styles.tabActive]}
          onPress={() => setTab('logs')}
        >
          <Icon name="history" size={18} color={tab === 'logs' ? colors.primary : colors.textMuted} />
          <Text style={[styles.tabText, tab === 'logs' && styles.tabTextActive]}>Lịch sử nhập xuất</Text>
        </Pressable>
      </View>

      {/* Low stock banner */}
      {lowStock.length > 0 && (
        <View style={styles.alertBanner}>
          <Icon name="alert" size={20} color={colors.warning} />
          <Text style={styles.alertText}>
            {lowStock.length} mặt hàng sắp hết. Vui lòng nhập thêm.
          </Text>
        </View>
      )}

      {!canEdit && <ReadOnlyBanner />}

      {tab === 'items' ? (
        <>
          <View style={styles.header}>
            <View style={{ flex: 1, maxWidth: 360 }}>
              <Input
                placeholder="Tìm mặt hàng..."
                value={search}
                onChangeText={setSearch}
                leftIcon={<Icon name="magnify" size={20} color={colors.textMuted} />}
              />
            </View>
            {canCreate && (
              <Button onPress={openCreateItem} leftIcon={<Icon name="plus" size={20} color="#fff" />}>
                Thêm mặt hàng
              </Button>
            )}
          </View>

          <FlatList
            data={itemsQuery.data?.items ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
            renderItem={({ item }) => {
              const low = item.minQuantity != null && item.quantity <= item.minQuantity;
              return (
                <Card>
                  <CardContent style={styles.row}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                        <Text style={styles.name}>{item.name}</Text>
                        {!item.isActive && <Badge bg={colors.dangerLight} fg={colors.danger}>Tạm ngưng</Badge>}
                        {low && <Badge bg={colors.dangerLight} fg={colors.danger}>Sắp hết</Badge>}
                      </View>
                      <Text style={styles.meta}>
                        Đơn vị: {item.unit}
                        {item.importPrice != null ? `  ·  Giá nhập: ${formatCurrency(item.importPrice)}` : ''}
                        {item.minQuantity != null ? `  ·  Min: ${item.minQuantity}` : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Text style={[styles.qty, low && { color: colors.danger }]}>
                        {item.quantity} {item.unit}
                      </Text>
                      {(canEdit || canDelete) && (
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {canEdit && (
                            <Button size="sm" variant="outline" onPress={() => openLogFor(item)}>
                              Nhập/Xuất
                            </Button>
                          )}
                          {canEdit && (
                            <Pressable onPress={() => openEditItem(item)} style={styles.iconBtn}>
                              <Icon name="pencil" size={18} color={colors.textMuted} />
                            </Pressable>
                          )}
                          {canDelete && (
                            <Pressable onPress={() => confirmDeleteItem(item)} style={styles.iconBtn}>
                              <Icon name="trash-can-outline" size={18} color={colors.danger} />
                            </Pressable>
                          )}
                        </View>
                      )}
                    </View>
                  </CardContent>
                </Card>
              );
            }}
            ListEmptyComponent={!itemsQuery.isLoading ? <EmptyState title="Chưa có mặt hàng" /> : null}
          />
        </>
      ) : (
        <FlatList
          data={logsQuery.data?.items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => {
            const color = LOG_TYPE_COLOR[item.type];
            return (
              <Card>
                <CardContent style={styles.logRow}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                      <Badge bg={color.bg} fg={color.fg}>{LOG_TYPE_LABEL[item.type]}</Badge>
                      <Text style={styles.name}>{item.item?.name ?? '—'}</Text>
                    </View>
                    <Text style={styles.meta}>
                      SL: {item.quantity} {item.item?.unit ?? ''}
                      {item.unitPrice != null ? `  ·  Đơn giá: ${formatCurrency(item.unitPrice)}` : ''}
                    </Text>
                    {item.note && <Text style={styles.meta} numberOfLines={1}>{item.note}</Text>}
                  </View>
                  <Text style={styles.dateText}>{formatDateTime(item.createdAt)}</Text>
                </CardContent>
              </Card>
            );
          }}
          ListEmptyComponent={!logsQuery.isLoading ? <EmptyState title="Chưa có phiếu nào" /> : null}
        />
      )}

      {/* Item form modal */}
      <Modal visible={itemOpen} transparent animationType="fade" onRequestClose={closeItemForm}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingItem ? 'Sửa mặt hàng' : 'Thêm mặt hàng'}
            </Text>
            <View style={{ gap: spacing.md }}>
              <Input label="Tên" required value={iName} onChangeText={setIName} placeholder="Tên mặt hàng" />
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Input label="Đơn vị" required value={iUnit} onChangeText={setIUnit} placeholder="cái, kg..." />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label={editingItem ? 'Số lượng (chỉ qua phiếu)' : 'Số lượng đầu kỳ'}
                    value={iQuantity}
                    onChangeText={setIQuantity}
                    placeholder="0"
                    keyboardType="numeric"
                    editable={!editingItem}
                  />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Tồn tối thiểu"
                    value={iMinQuantity}
                    onChangeText={setIMinQuantity}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Giá nhập"
                    value={iImportPrice}
                    onChangeText={setIImportPrice}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <Input
                label="Ghi chú"
                value={iNote}
                onChangeText={setINote}
                multiline
                numberOfLines={3}
                style={{ minHeight: 72, textAlignVertical: 'top' }}
              />
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Đang sử dụng</Text>
                <Switch value={iIsActive} onValueChange={setIIsActive} />
              </View>
            </View>
            <View style={styles.modalActions}>
              <Button variant="ghost" onPress={closeItemForm} style={{ flex: 1 }}>Huỷ</Button>
              <Button onPress={handleSubmitItem} loading={isItemPending} style={{ flex: 1 }}>Lưu</Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Log modal */}
      <Modal visible={logOpen} transparent animationType="fade" onRequestClose={closeLogForm}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Phiếu nhập/xuất — {logTarget?.name}
            </Text>

            <View style={styles.segment}>
              {(['IMPORT', 'EXPORT', 'ADJUST'] as InventoryLogType[]).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setLogType(t)}
                  style={[styles.segmentItem, logType === t && styles.segmentItemActive]}
                >
                  <Text style={[styles.segmentText, logType === t && styles.segmentTextActive]}>
                    {LOG_TYPE_LABEL[t]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={{ gap: spacing.md }}>
              <Input
                label="Số lượng"
                required
                value={logQuantity}
                onChangeText={setLogQuantity}
                placeholder="0"
                keyboardType="numeric"
              />
              <Input
                label="Đơn giá"
                value={logUnitPrice}
                onChangeText={setLogUnitPrice}
                placeholder="0"
                keyboardType="numeric"
              />
              <Input
                label="Ghi chú"
                value={logNote}
                onChangeText={setLogNote}
                multiline
                numberOfLines={3}
                style={{ minHeight: 72, textAlignVertical: 'top' }}
              />
            </View>
            <View style={styles.modalActions}>
              <Button variant="ghost" onPress={closeLogForm} style={{ flex: 1 }}>Huỷ</Button>
              <Button onPress={handleSubmitLog} loading={createLogMutation.isPending} style={{ flex: 1 }}>
                Lưu phiếu
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.primary },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningLight,
    padding: spacing.md,
    margin: spacing.lg,
    marginBottom: 0,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  alertText: { fontSize: 13, color: '#78350f', fontWeight: '600', flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  logRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.lg },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
  qty: { fontSize: 16, fontWeight: '700', color: colors.text },
  dateText: { fontSize: 12, color: colors.textMuted },
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
  modalCard: {
    width: '100%',
    maxWidth: 640,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  switchLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  segmentItemActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  segmentTextActive: { color: '#fff' },
});
