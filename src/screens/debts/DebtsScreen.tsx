import React, { useState } from 'react';
import { Alert, FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { debtApi, type DebtType } from '@/api/debt.api';
import { customerApi } from '@/api/customer.api';
import { supplierApi } from '@/api/supplier.api';
import { extractError } from '@/api/client';
import { usePermissions } from '@/hooks/usePermissions';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { CustomerDebt, SupplierDebt } from '@/types/api';

type DebtTab = 'customers' | 'suppliers';

export function DebtsScreen() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [tab, setTab] = useState<DebtTab>('customers');

  // Add modal
  const [addOpen, setAddOpen] = useState(false);
  const [partnerId, setPartnerId] = useState('');
  const [amount, setAmount] = useState('');
  const [debtType, setDebtType] = useState<DebtType>('MONEY');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Pay modal
  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<CustomerDebt | SupplierDebt | null>(null);
  const [paidAmount, setPaidAmount] = useState('');

  const summaryQuery = useQuery({
    queryKey: ['debt', 'summary'],
    queryFn: () => debtApi.summary(),
  });

  const customersDebtQuery = useQuery({
    queryKey: ['debt', 'customers'],
    queryFn: () => debtApi.customers.list({ pageSize: 100 }),
    enabled: tab === 'customers',
  });

  const suppliersDebtQuery = useQuery({
    queryKey: ['debt', 'suppliers'],
    queryFn: () => debtApi.suppliers.list({ pageSize: 100 }),
    enabled: tab === 'suppliers',
  });

  // Partner pickers
  const customersQuery = useQuery({
    queryKey: ['customers', 'all'],
    queryFn: () => customerApi.list({ pageSize: 200 }),
    enabled: addOpen && tab === 'customers',
  });

  const suppliersQuery = useQuery({
    queryKey: ['suppliers', 'all'],
    queryFn: () => supplierApi.list({ pageSize: 200 }),
    enabled: addOpen && tab === 'suppliers',
  });

  const createMutation = useMutation<any, unknown, void>({
    mutationFn: async () => {
      if (tab === 'customers') {
        return debtApi.customers.create({
          customerId: partnerId,
          amount: Number(amount),
          type: debtType,
          description: description || undefined,
          dueDate: dueDate ? dueDate.toISOString() : undefined,
        });
      }
      return debtApi.suppliers.create({
        supplierId: partnerId,
        amount: Number(amount),
        type: debtType,
        description: description || undefined,
        dueDate: dueDate ? dueDate.toISOString() : undefined,
      });
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã thêm khoản nợ' });
      queryClient.invalidateQueries({ queryKey: ['debt'] });
      closeAdd();
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  const payMutation = useMutation<any, unknown, void>({
    mutationFn: async () => {
      if (!payTarget) throw new Error('missing target');
      if (tab === 'customers') {
        return debtApi.customers.pay(payTarget.id, Number(paidAmount));
      }
      return debtApi.suppliers.pay(payTarget.id, Number(paidAmount));
    },
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã ghi nhận thanh toán' });
      queryClient.invalidateQueries({ queryKey: ['debt'] });
      closePay();
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      tab === 'customers' ? debtApi.customers.remove(id) : debtApi.suppliers.remove(id),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã xoá khoản nợ' });
      queryClient.invalidateQueries({ queryKey: ['debt'] });
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  function openAdd() {
    setPartnerId('');
    setAmount('');
    setDebtType('MONEY');
    setDescription('');
    setDueDate(null);
    setAddOpen(true);
  }

  function closeAdd() {
    setAddOpen(false);
  }

  function openPay(d: CustomerDebt | SupplierDebt) {
    setPayTarget(d);
    setPaidAmount(String(d.amount));
    setPayOpen(true);
  }

  function closePay() {
    setPayOpen(false);
    setPayTarget(null);
  }

  function confirmDelete(id: string) {
    Alert.alert('Xoá khoản nợ', 'Bạn có chắc muốn xoá?', [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Xoá', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  }

  function handleSubmitAdd() {
    if (!partnerId) {
      Toast.show({ type: 'error', text1: 'Vui lòng chọn đối tác' });
      return;
    }
    if (!amount || Number(amount) <= 0) {
      Toast.show({ type: 'error', text1: 'Số tiền phải > 0' });
      return;
    }
    createMutation.mutate();
  }

  function handleSubmitPay() {
    if (!paidAmount || Number(paidAmount) <= 0) {
      Toast.show({ type: 'error', text1: 'Số tiền phải > 0' });
      return;
    }
    payMutation.mutate();
  }

  const summary = summaryQuery.data;
  const totalDebt = tab === 'customers' ? summary?.customerDebtTotal : summary?.supplierDebtTotal;
  const totalPaid = tab === 'customers' ? summary?.customerPaidTotal : summary?.supplierPaidTotal;
  const remaining = (totalDebt ?? 0) - (totalPaid ?? 0);
  const items =
    tab === 'customers'
      ? customersDebtQuery.data?.items ?? []
      : suppliersDebtQuery.data?.items ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Card style={{ flex: 1 }}>
          <CardContent style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: colors.warningLight }]}>
              <Icon name="cash-multiple" size={22} color={colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>Tổng nợ</Text>
              <Text style={[styles.summaryValue, { color: colors.warning }]}>
                {formatCurrency(totalDebt ?? 0)}
              </Text>
            </View>
          </CardContent>
        </Card>
        <Card style={{ flex: 1 }}>
          <CardContent style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: colors.successLight }]}>
              <Icon name="check-circle" size={22} color={colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>Đã trả</Text>
              <Text style={[styles.summaryValue, { color: colors.success }]}>
                {formatCurrency(totalPaid ?? 0)}
              </Text>
            </View>
          </CardContent>
        </Card>
        <Card style={{ flex: 1 }}>
          <CardContent style={styles.summaryCard}>
            <View style={[styles.summaryIcon, { backgroundColor: colors.dangerLight }]}>
              <Icon name="alert-circle" size={22} color={colors.danger} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>Còn nợ</Text>
              <Text style={[styles.summaryValue, { color: colors.danger }]}>
                {formatCurrency(remaining)}
              </Text>
            </View>
          </CardContent>
        </Card>
      </View>

      <View style={styles.header}>
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, tab === 'customers' && styles.tabActive]}
            onPress={() => setTab('customers')}
          >
            <Text style={[styles.tabText, tab === 'customers' && styles.tabTextActive]}>Khách hàng</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === 'suppliers' && styles.tabActive]}
            onPress={() => setTab('suppliers')}
          >
            <Text style={[styles.tabText, tab === 'suppliers' && styles.tabTextActive]}>Nhà cung cấp</Text>
          </Pressable>
        </View>
        {canCreate && (
          <Button onPress={openAdd} leftIcon={<Icon name="plus" size={20} color="#fff" />}>
            Thêm khoản nợ
          </Button>
        )}
      </View>

      {!canEdit && <ReadOnlyBanner />}

      <FlatList<any>
        data={items as any[]}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        renderItem={({ item }: { item: any }) => {
          const partnerName =
            tab === 'customers'
              ? (item as CustomerDebt).customer?.name
              : (item as SupplierDebt).supplier?.name;
          return (
            <Card>
              <CardContent style={styles.row}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                    <Text style={styles.name}>{partnerName ?? '—'}</Text>
                    <Badge
                      bg={item.type === 'MONEY' ? colors.primaryLight : colors.infoLight}
                      fg={item.type === 'MONEY' ? colors.primary : colors.info}
                    >
                      {item.type === 'MONEY' ? 'Tiền' : 'Hàng hóa'}
                    </Badge>
                    {item.isPaid && (
                      <Badge bg={colors.successLight} fg={colors.success}>Đã trả</Badge>
                    )}
                  </View>
                  {item.description && (
                    <Text style={styles.meta} numberOfLines={2}>{item.description}</Text>
                  )}
                  <Text style={styles.meta}>
                    Hạn: {item.dueDate ? formatDate(item.dueDate) : '—'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
                  {item.paidAmount != null && Number(item.paidAmount) > 0 && (
                    <Text style={[styles.meta, { color: colors.success }]}>
                      Đã trả: {formatCurrency(item.paidAmount)}
                    </Text>
                  )}
                  {(canEdit || canDelete) && (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {canEdit && !item.isPaid && (
                        <Button size="sm" onPress={() => openPay(item)}>
                          Đánh dấu đã trả
                        </Button>
                      )}
                      {canDelete && (
                        <Pressable onPress={() => confirmDelete(item.id)} style={styles.iconBtn}>
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
        ListEmptyComponent={
          !customersDebtQuery.isLoading && !suppliersDebtQuery.isLoading ? (
            <EmptyState title="Chưa có khoản nợ" />
          ) : null
        }
      />

      {/* Add modal */}
      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={closeAdd}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Thêm khoản nợ</Text>

            <View>
              <Text style={styles.fieldLabel}>
                {tab === 'customers' ? 'Khách hàng' : 'Nhà cung cấp'} *
              </Text>
              <ScrollView style={styles.pickerList} nestedScrollEnabled>
                {(tab === 'customers'
                  ? customersQuery.data?.items ?? []
                  : suppliersQuery.data?.items ?? []
                ).map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => setPartnerId(p.id)}
                    style={[styles.pickerItem, partnerId === p.id && styles.pickerItemActive]}
                  >
                    <Text style={[styles.pickerText, partnerId === p.id && { color: '#fff' }]}>
                      {p.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.segment}>
              <Pressable
                onPress={() => setDebtType('MONEY')}
                style={[styles.segmentItem, debtType === 'MONEY' && styles.segmentItemActive]}
              >
                <Text style={[styles.segmentText, debtType === 'MONEY' && styles.segmentTextActive]}>
                  Tiền
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setDebtType('GOODS')}
                style={[styles.segmentItem, debtType === 'GOODS' && styles.segmentItemActive]}
              >
                <Text style={[styles.segmentText, debtType === 'GOODS' && styles.segmentTextActive]}>
                  Hàng hóa
                </Text>
              </Pressable>
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
              <Text style={styles.fieldLabel}>Hạn thanh toán</Text>
              <Pressable onPress={() => setShowDatePicker(true)} style={styles.dateBtn}>
                <Icon name="calendar" size={18} color={colors.textMuted} />
                <Text style={styles.dateBtnText}>
                  {dueDate ? formatDate(dueDate) : 'Chọn ngày'}
                </Text>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={dueDate ?? new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, d) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (d) setDueDate(d);
                  }}
                />
              )}
            </View>

            <Input
              label="Ghi chú"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              style={{ minHeight: 72, textAlignVertical: 'top' }}
            />

            <View style={styles.modalActions}>
              <Button variant="ghost" onPress={closeAdd} style={{ flex: 1 }}>Huỷ</Button>
              <Button onPress={handleSubmitAdd} loading={createMutation.isPending} style={{ flex: 1 }}>
                Lưu
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Pay modal */}
      <Modal visible={payOpen} transparent animationType="fade" onRequestClose={closePay}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ghi nhận thanh toán</Text>
            <Text style={{ color: colors.textMuted }}>
              Tổng nợ: {payTarget ? formatCurrency(payTarget.amount) : '—'}
            </Text>
            <Input
              label="Số tiền thanh toán"
              required
              value={paidAmount}
              onChangeText={setPaidAmount}
              placeholder="0"
              keyboardType="numeric"
            />
            <View style={styles.modalActions}>
              <Button variant="ghost" onPress={closePay} style={{ flex: 1 }}>Huỷ</Button>
              <Button onPress={handleSubmitPay} loading={payMutation.isPending} style={{ flex: 1 }}>
                Xác nhận
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
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: colors.border,
  },
  tabs: {
    flexDirection: 'row', gap: spacing.sm,
    backgroundColor: colors.background, padding: 4, borderRadius: radius.md,
  },
  tab: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: radius.sm },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: '#fff' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.lg },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
  amount: { fontSize: 16, fontWeight: '700', color: colors.text },
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
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  pickerList: {
    maxHeight: 180, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
  },
  pickerItem: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  pickerItemActive: { backgroundColor: colors.primary },
  pickerText: { color: colors.text, fontSize: 14 },
  segment: {
    flexDirection: 'row', backgroundColor: colors.background,
    borderRadius: radius.md, padding: 4, gap: 4,
  },
  segmentItem: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderRadius: radius.sm },
  segmentItemActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  segmentTextActive: { color: '#fff' },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, height: 52,
    backgroundColor: colors.inputBg,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
  },
  dateBtnText: { fontSize: 15, color: colors.text },
});
