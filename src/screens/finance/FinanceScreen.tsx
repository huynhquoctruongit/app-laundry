import React, { useState } from 'react';
import { Alert, FlatList, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/common/EmptyState';
import { ReadOnlyBanner } from '@/components/common/ReadOnlyBanner';
import { financeApi, type TransactionType } from '@/api/finance.api';
import { extractError } from '@/api/client';
import { usePermissions } from '@/hooks/usePermissions';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import type { Transaction } from '@/types/api';

const INCOME_CATEGORIES = ['Doanh thu', 'Khác'];
const EXPENSE_CATEGORIES = ['Nhân viên', 'Mặt bằng', 'Điện nước', 'Vật tư', 'Khác'];

export function FinanceScreen() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [tab, setTab] = useState<TransactionType>('INCOME');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const [type, setType] = useState<TransactionType>('INCOME');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const summaryQuery = useQuery({
    queryKey: ['finance', 'summary'],
    queryFn: () => financeApi.summary(),
  });

  const listQuery = useQuery({
    queryKey: ['finance', { type: tab }],
    queryFn: () => financeApi.list({ type: tab, pageSize: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      financeApi.create({
        type,
        category: category || 'Khác',
        amount: Number(amount),
        description: description || undefined,
        date: date.toISOString(),
      }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã thêm giao dịch' });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      closeForm();
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      financeApi.update(editing!.id, {
        type,
        category: category || 'Khác',
        amount: Number(amount),
        description: description || undefined,
        date: date.toISOString(),
      }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã cập nhật giao dịch' });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      closeForm();
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => financeApi.remove(id),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã xoá giao dịch' });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  function openCreate() {
    setEditing(null);
    setType(tab);
    setCategory('');
    setAmount('');
    setDescription('');
    setDate(new Date());
    setFormOpen(true);
  }

  function openEdit(t: Transaction) {
    setEditing(t);
    setType(t.type);
    setCategory(t.category);
    setAmount(String(t.amount ?? ''));
    setDescription(t.description ?? '');
    setDate(t.date ? new Date(t.date) : new Date());
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  function confirmDelete(t: Transaction) {
    Alert.alert('Xoá giao dịch', 'Bạn có chắc muốn xoá giao dịch này?', [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Xoá', style: 'destructive', onPress: () => deleteMutation.mutate(t.id) },
    ]);
  }

  function handleSubmit() {
    if (!amount || Number(amount) <= 0) {
      Toast.show({ type: 'error', text1: 'Số tiền phải > 0' });
      return;
    }
    if (editing) updateMutation.mutate();
    else createMutation.mutate();
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const summary = summaryQuery.data;
  const categories = type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <View style={styles.container}>
      {/* Summary cards */}
      <View style={styles.summary}>
        <Card style={{ flex: 1 }}>
          <CardContent style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: colors.successLight }]}>
              <Icon name="trending-up" size={22} color={colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>Tổng thu</Text>
              <Text style={[styles.summaryValue, { color: colors.success }]}>
                {formatCurrency(summary?.totalIncome ?? 0)}
              </Text>
            </View>
          </CardContent>
        </Card>
        <Card style={{ flex: 1 }}>
          <CardContent style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: colors.dangerLight }]}>
              <Icon name="trending-down" size={22} color={colors.danger} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>Tổng chi</Text>
              <Text style={[styles.summaryValue, { color: colors.danger }]}>
                {formatCurrency(summary?.totalExpense ?? 0)}
              </Text>
            </View>
          </CardContent>
        </Card>
        <Card style={{ flex: 1 }}>
          <CardContent style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: colors.primaryLight }]}>
              <Icon name="wallet" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>Số dư</Text>
              <Text style={[styles.summaryValue, { color: colors.primary }]}>
                {formatCurrency(summary?.balance ?? 0)}
              </Text>
            </View>
          </CardContent>
        </Card>
      </View>

      {/* Tabs + Add button */}
      <View style={styles.header}>
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, tab === 'INCOME' && styles.tabActive]}
            onPress={() => setTab('INCOME')}
          >
            <Text style={[styles.tabText, tab === 'INCOME' && styles.tabTextActive]}>Thu</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === 'EXPENSE' && styles.tabActive]}
            onPress={() => setTab('EXPENSE')}
          >
            <Text style={[styles.tabText, tab === 'EXPENSE' && styles.tabTextActive]}>Chi</Text>
          </Pressable>
        </View>
        {canCreate && (
          <Button onPress={openCreate} leftIcon={<Icon name="plus" size={20} color="#fff" />}>
            Thêm giao dịch
          </Button>
        )}
      </View>

      {!canEdit && <ReadOnlyBanner />}

      <FlatList
        data={listQuery.data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        renderItem={({ item }) => (
          <Pressable onPress={canEdit ? () => openEdit(item) : undefined}>
            <Card>
              <CardContent style={styles.row}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                    <Badge
                      bg={item.type === 'INCOME' ? colors.successLight : colors.dangerLight}
                      fg={item.type === 'INCOME' ? colors.success : colors.danger}
                    >
                      {item.category}
                    </Badge>
                    <Text style={styles.dateText}>{formatDate(item.date)}</Text>
                  </View>
                  {item.description && (
                    <Text style={styles.meta} numberOfLines={2}>{item.description}</Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={[styles.amount, { color: item.type === 'INCOME' ? colors.success : colors.danger }]}>
                    {item.type === 'INCOME' ? '+' : '-'}{formatCurrency(item.amount)}
                  </Text>
                  {(canEdit || canDelete) && (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
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
        )}
        ListEmptyComponent={!listQuery.isLoading ? <EmptyState title="Chưa có giao dịch" /> : null}
      />

      {/* Form */}
      <Modal visible={formOpen} transparent animationType="fade" onRequestClose={closeForm}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editing ? 'Sửa giao dịch' : 'Thêm giao dịch'}
            </Text>

            <View style={styles.segment}>
              <Pressable
                onPress={() => setType('INCOME')}
                style={[styles.segmentItem, type === 'INCOME' && { backgroundColor: colors.success }]}
              >
                <Text style={[styles.segmentText, type === 'INCOME' && styles.segmentTextActive]}>Thu</Text>
              </Pressable>
              <Pressable
                onPress={() => setType('EXPENSE')}
                style={[styles.segmentItem, type === 'EXPENSE' && { backgroundColor: colors.danger }]}
              >
                <Text style={[styles.segmentText, type === 'EXPENSE' && styles.segmentTextActive]}>Chi</Text>
              </Pressable>
            </View>

            <View style={{ gap: spacing.md }}>
              <View>
                <Text style={styles.fieldLabel}>Danh mục</Text>
                <View style={styles.chipRow}>
                  {categories.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setCategory(c)}
                      style={[styles.chip, category === c && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
                    </Pressable>
                  ))}
                </View>
                <Input
                  placeholder="Hoặc nhập danh mục khác"
                  value={category}
                  onChangeText={setCategory}
                />
              </View>

              <Input
                label="Số tiền"
                required
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                keyboardType="numeric"
              />

              <View>
                <Text style={styles.fieldLabel}>Ngày</Text>
                <Pressable onPress={() => setShowDatePicker(true)} style={styles.dateBtn}>
                  <Icon name="calendar" size={18} color={colors.textMuted} />
                  <Text style={styles.dateBtnText}>{formatDate(date)}</Text>
                </Pressable>
                {showDatePicker && (
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(_, d) => {
                      setShowDatePicker(Platform.OS === 'ios');
                      if (d) setDate(d);
                    }}
                  />
                )}
              </View>

              <Input
                label="Mô tả"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                style={{ minHeight: 72, textAlignVertical: 'top' }}
              />
            </View>

            <View style={styles.modalActions}>
              <Button variant="ghost" onPress={closeForm} style={{ flex: 1 }}>Huỷ</Button>
              <Button onPress={handleSubmit} loading={isPending} style={{ flex: 1 }}>Lưu</Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  summary: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  summaryIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  summaryLabel: { fontSize: 12, color: colors.textMuted },
  summaryValue: { fontSize: 20, fontWeight: '700' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.background,
    padding: 4,
    borderRadius: radius.md,
  },
  tab: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: radius.sm },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  dateText: { fontSize: 12, color: colors.textMuted },
  meta: { fontSize: 13, color: colors.textMuted },
  amount: { fontSize: 16, fontWeight: '700' },
  iconBtn: {
    width: 32, height: 32, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.background,
  },
  modalBackdrop: {
    flex: 1, backgroundColor: colors.overlay,
    alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
  },
  modalCard: {
    width: '100%', maxWidth: 600,
    backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.xl, gap: spacing.lg,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  segmentItem: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderRadius: radius.sm },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  segmentTextActive: { color: '#fff' },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: 99, backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, height: 52,
    backgroundColor: colors.inputBg,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
  },
  dateBtnText: { fontSize: 15, color: colors.text },
});
