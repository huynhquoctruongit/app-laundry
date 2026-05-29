import React, { useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { ReadOnlyBanner } from '@/components/common/ReadOnlyBanner';
import { supplierApi } from '@/api/supplier.api';
import { extractError } from '@/api/client';
import { usePermissions } from '@/hooks/usePermissions';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import type { Supplier } from '@/types/api';

export function SuppliersScreen() {
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');

  const listQuery = useQuery({
    queryKey: ['suppliers', { search }],
    queryFn: () => supplierApi.list({ search: search || undefined, pageSize: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      supplierApi.create({
        name,
        phone: phone || undefined,
        email: email || undefined,
        address: address || undefined,
        note: note || undefined,
      }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã thêm nhà cung cấp' });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      closeForm();
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      supplierApi.update(editing!.id, {
        name,
        phone: phone || undefined,
        email: email || undefined,
        address: address || undefined,
        note: note || undefined,
      }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã cập nhật nhà cung cấp' });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      closeForm();
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => supplierApi.remove(id),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã xoá nhà cung cấp' });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  function openCreate() {
    setEditing(null);
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setNote('');
    setFormOpen(true);
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setName(s.name);
    setPhone(s.phone ?? '');
    setEmail(s.email ?? '');
    setAddress(s.address ?? '');
    setNote(s.note ?? '');
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  function confirmDelete(s: Supplier) {
    Alert.alert('Xoá nhà cung cấp', `Bạn có chắc muốn xoá ${s.name}?`, [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Xoá', style: 'destructive', onPress: () => deleteMutation.mutate(s.id) },
    ]);
  }

  function handleSubmit() {
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Vui lòng nhập tên' });
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
            placeholder="Tìm nhà cung cấp..."
            value={search}
            onChangeText={setSearch}
            leftIcon={<Icon name="magnify" size={20} color={colors.textMuted} />}
          />
        </View>
        {canCreate && (
          <Button onPress={openCreate} leftIcon={<Icon name="plus" size={20} color="#fff" />}>
            Thêm nhà cung cấp
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
                <View style={styles.avatar}>
                  <Icon name="truck-delivery" size={22} color={colors.warning} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>
                    {item.phone || '—'}{item.email ? ` · ${item.email}` : ''}
                  </Text>
                  {item.address && <Text style={styles.meta} numberOfLines={1}>{item.address}</Text>}
                </View>
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
              </CardContent>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={!listQuery.isLoading ? <EmptyState title="Chưa có nhà cung cấp" /> : null}
      />

      <Modal visible={formOpen} transparent animationType="fade" onRequestClose={closeForm}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editing ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp'}
            </Text>
            <View style={{ gap: spacing.md }}>
              <Input label="Tên" required value={name} onChangeText={setName} placeholder="Công ty ABC" />
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Số điện thoại"
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="0901234567"
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="email@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>
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
    backgroundColor: colors.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
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
    maxWidth: 600,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
});
