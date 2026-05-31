import React, { useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { ReadOnlyBanner } from '@/components/common/ReadOnlyBanner';
import { CustomerStatsBlock } from '@/components/common/CustomerStatsBlock';
import { customerApi } from '@/api/customer.api';
import { extractError } from '@/api/client';
import { usePermissions } from '@/hooks/usePermissions';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { formatDateTime } from '@/lib/utils';
import type { Customer } from '@/types/api';

export function CustomersScreen() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');

  const listQuery = useQuery({
    queryKey: ['customers', { search }],
    queryFn: () =>
      customerApi.list({ search: search || undefined, pageSize: 100 }),
  });

  // Tải stats khi mở edit modal
  const statsQuery = useQuery({
    queryKey: ['customer', editing?.id, 'stats'],
    queryFn: () => customerApi.stats(editing!.id),
    enabled: !!editing,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      customerApi.create({ name, phone, address: address || undefined, note: note || undefined }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã thêm khách hàng' });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      closeForm();
    },
    onError: (err) =>
      Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      customerApi.update(editing!.id, {
        name,
        phone,
        address: address || undefined,
        note: note || undefined,
      }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã cập nhật khách hàng' });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      // Refresh các đơn/QR vì hiển thị thông tin khách theo thời gian thực
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order'] });
      queryClient.invalidateQueries({ queryKey: ['booking'] });
      closeForm();
    },
    onError: (err) =>
      Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customerApi.remove(id),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã xoá khách hàng' });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err) =>
      Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  function openCreate() {
    setEditing(null);
    setName('');
    setPhone('');
    setAddress('');
    setNote('');
    setFormOpen(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setName(c.name);
    setPhone(c.phone ?? '');
    setAddress(c.address ?? '');
    setNote(c.note ?? '');
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  function confirmDelete(c: Customer) {
    Alert.alert('Xoá khách hàng', `Bạn có chắc muốn xoá ${c.name}?`, [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(c.id),
      },
    ]);
  }

  function handleSubmit() {
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Vui lòng nhập tên khách hàng' });
      return;
    }
    if (editing) updateMutation.mutate();
    else createMutation.mutate();
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1, maxWidth: 360 }}>
          <Input
            placeholder="Tìm tên, SĐT..."
            value={search}
            onChangeText={setSearch}
            leftIcon={<Icon name="magnify" size={20} color={colors.textMuted} />}
          />
        </View>
        {canCreate && (
          <Button onPress={openCreate} leftIcon={<Icon name="plus" size={20} color="#fff" />}>
            Thêm khách hàng
          </Button>
        )}
      </View>

      {!canEdit && <ReadOnlyBanner />}

      <FlatList
        data={listQuery.data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        refreshing={listQuery.isFetching}
        onRefresh={() => listQuery.refetch()}
        renderItem={({ item }) => (
          <Pressable onPress={canEdit ? () => openEdit(item) : undefined}>
            <Card>
              <CardContent style={styles.row}>
                <View style={styles.avatar}>
                  <Icon name="account" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>{item.phone}</Text>
                  {item.address && <Text style={styles.meta} numberOfLines={1}>{item.address}</Text>}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={styles.dateText}>{formatDateTime(item.createdAt)}</Text>
                  {(canEdit || canDelete) && (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {canEdit && (
                        <Pressable
                          onPress={() => openEdit(item)}
                          style={styles.iconBtn}
                          hitSlop={8}
                        >
                          <Icon name="pencil" size={18} color={colors.textMuted} />
                        </Pressable>
                      )}
                      {canDelete && (
                        <Pressable
                          onPress={() => confirmDelete(item)}
                          style={styles.iconBtn}
                          hitSlop={8}
                        >
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
        ListEmptyComponent={
          !listQuery.isLoading ? <EmptyState title="Chưa có khách hàng" /> : null
        }
      />

      {/* Form Modal */}
      <Modal visible={formOpen} transparent animationType="fade" onRequestClose={closeForm}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editing ? 'Sửa khách hàng' : 'Thêm khách hàng'}
            </Text>
            <ScrollView
              style={{ maxHeight: 540 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.lg }}
            >
              <View style={{ gap: spacing.md }}>
                <Input label="Tên" required value={name} onChangeText={setName} placeholder="Nguyễn Văn A" />
                <Input
                  label="Số điện thoại (không bắt buộc)"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="0901234567"
                  keyboardType="phone-pad"
                />
                <Input label="Địa chỉ" value={address} onChangeText={setAddress} placeholder="Địa chỉ" />
                <Input
                  label="Ghi chú"
                  value={note}
                  onChangeText={setNote}
                  placeholder="Ghi chú thêm"
                  multiline
                  numberOfLines={3}
                  style={{ minHeight: 72, textAlignVertical: 'top' }}
                />
              </View>

              {/* Thống kê khách — chỉ hiện khi sửa (có editing) */}
              {editing && (
                <View style={{ gap: spacing.sm }}>
                  <View style={styles.statsHeader}>
                    <Icon name="chart-bar" size={18} color={colors.primary} />
                    <Text style={styles.statsHeaderText}>Thống kê khách hàng</Text>
                  </View>
                  <CustomerStatsBlock
                    stats={statsQuery.data}
                    isLoading={statsQuery.isLoading}
                  />
                </View>
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <Button variant="ghost" onPress={closeForm} style={{ flex: 1 }}>
                Huỷ
              </Button>
              <Button onPress={handleSubmit} loading={isPending} style={{ flex: 1 }}>
                Lưu
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
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
    maxWidth: 520,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.lg,
    maxHeight: '92%',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
  },
  statsHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
});
