import React, { useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/common/EmptyState';
import { staffApi, type UserRole } from '@/api/staff.api';
import { extractError } from '@/api/client';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import type { User } from '@/types/api';

const PERMISSIONS = [
  { key: 'ORDER_CREATE', label: 'Tạo đơn hàng' },
  { key: 'ORDER_UPDATE', label: 'Cập nhật đơn hàng' },
  { key: 'ORDER_DELETE', label: 'Xoá đơn hàng' },
  { key: 'CUSTOMER_MANAGE', label: 'Quản lý khách hàng' },
  { key: 'PRODUCT_MANAGE', label: 'Quản lý dịch vụ' },
  { key: 'INVENTORY_MANAGE', label: 'Quản lý kho hàng' },
  { key: 'FINANCE_MANAGE', label: 'Quản lý thu chi' },
  { key: 'REPORT_VIEW', label: 'Xem báo cáo' },
];

export function StaffScreen() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [permOpen, setPermOpen] = useState(false);
  const [permTarget, setPermTarget] = useState<User | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwTarget, setPwTarget] = useState<User | null>(null);

  // Form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('STAFF');
  const [isActive, setIsActive] = useState(true);

  // Permissions form
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [orderViewTimeLimit, setOrderViewTimeLimit] = useState('');

  // Reset password
  const [newPassword, setNewPassword] = useState('');

  const listQuery = useQuery({
    queryKey: ['staff', { search }],
    queryFn: () => staffApi.list({ search: search || undefined, pageSize: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      staffApi.create({
        email,
        password,
        name,
        phone: phone || undefined,
        role,
      }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã thêm nhân viên' });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      closeForm();
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      staffApi.update(editing!.id, {
        name,
        phone: phone || undefined,
        role,
        isActive,
      }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã cập nhật nhân viên' });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      closeForm();
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => staffApi.remove(id),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã xoá nhân viên' });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  const permMutation = useMutation({
    mutationFn: () =>
      staffApi.updatePermissions(permTarget!.id, {
        permissions: selectedPerms,
        orderViewTimeLimit: orderViewTimeLimit ? Number(orderViewTimeLimit) : null,
      }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã cập nhật quyền' });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      closePerm();
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  const pwMutation = useMutation({
    mutationFn: () => staffApi.resetPassword(pwTarget!.id, newPassword),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã đặt lại mật khẩu' });
      closePw();
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  function openCreate() {
    setEditing(null);
    setName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setRole('STAFF');
    setIsActive(true);
    setFormOpen(true);
  }

  function openEdit(s: User) {
    setEditing(s);
    setName(s.name);
    setEmail(s.email);
    setPhone(s.phone ?? '');
    setPassword('');
    setRole(s.role);
    setIsActive(s.isActive);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  function openPerm(s: User) {
    setPermTarget(s);
    const perms = s.permissions
      ? Object.entries(s.permissions).filter(([, v]) => v).map(([k]) => k)
      : [];
    setSelectedPerms(perms);
    setOrderViewTimeLimit(s.orderViewTimeLimit ?? '');
    setPermOpen(true);
  }

  function closePerm() {
    setPermOpen(false);
    setPermTarget(null);
  }

  function openPw(s: User) {
    setPwTarget(s);
    setNewPassword('');
    setPwOpen(true);
  }

  function closePw() {
    setPwOpen(false);
    setPwTarget(null);
    setNewPassword('');
  }

  function confirmDelete(s: User) {
    Alert.alert('Xoá nhân viên', `Bạn có chắc muốn xoá ${s.name}?`, [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Xoá', style: 'destructive', onPress: () => deleteMutation.mutate(s.id) },
    ]);
  }

  function handleSubmit() {
    if (!name.trim() || !email.trim()) {
      Toast.show({ type: 'error', text1: 'Vui lòng nhập đủ thông tin' });
      return;
    }
    if (!editing && !password.trim()) {
      Toast.show({ type: 'error', text1: 'Vui lòng nhập mật khẩu' });
      return;
    }
    if (editing) updateMutation.mutate();
    else createMutation.mutate();
  }

  function togglePerm(key: string) {
    setSelectedPerms((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1, maxWidth: 360 }}>
          <Input
            placeholder="Tìm tên, email..."
            value={search}
            onChangeText={setSearch}
            leftIcon={<Icon name="magnify" size={20} color={colors.textMuted} />}
          />
        </View>
        <Button onPress={openCreate} leftIcon={<Icon name="plus" size={20} color="#fff" />}>
          Thêm nhân viên
        </Button>
      </View>

      <FlatList
        data={listQuery.data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        renderItem={({ item }) => (
          <Card>
            <CardContent style={styles.row}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name?.[0]?.toUpperCase() ?? 'U'}</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Badge
                    bg={item.role === 'ADMIN' ? '#ede9fe' : colors.background}
                    fg={item.role === 'ADMIN' ? '#7c3aed' : colors.textMuted}
                  >
                    {item.role === 'ADMIN' ? 'Quản lý' : 'Nhân viên'}
                  </Badge>
                  {!item.isActive && (
                    <Badge bg={colors.dangerLight} fg={colors.danger}>Đã khoá</Badge>
                  )}
                </View>
                <Text style={styles.meta}>{item.email}</Text>
                {item.phone && <Text style={styles.meta}>{item.phone}</Text>}
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable onPress={() => openEdit(item)} style={styles.iconBtn}>
                  <Icon name="pencil" size={18} color={colors.textMuted} />
                </Pressable>
                <Pressable onPress={() => openPerm(item)} style={styles.iconBtn}>
                  <Icon name="shield-account" size={18} color={colors.primary} />
                </Pressable>
                <Pressable onPress={() => openPw(item)} style={styles.iconBtn}>
                  <Icon name="key" size={18} color={colors.warning} />
                </Pressable>
                <Pressable onPress={() => confirmDelete(item)} style={styles.iconBtn}>
                  <Icon name="trash-can-outline" size={18} color={colors.danger} />
                </Pressable>
              </View>
            </CardContent>
          </Card>
        )}
        ListEmptyComponent={!listQuery.isLoading ? <EmptyState title="Chưa có nhân viên" /> : null}
      />

      {/* Create/Edit modal */}
      <Modal visible={formOpen} transparent animationType="fade" onRequestClose={closeForm}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editing ? 'Sửa nhân viên' : 'Thêm nhân viên'}
            </Text>
            <View style={{ gap: spacing.md }}>
              <Input label="Tên" required value={name} onChangeText={setName} placeholder="Nguyễn Văn A" />
              <Input
                label="Email"
                required
                value={email}
                onChangeText={setEmail}
                placeholder="email@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!editing}
              />
              <Input
                label="Số điện thoại"
                value={phone}
                onChangeText={setPhone}
                placeholder="0901234567"
                keyboardType="phone-pad"
              />
              {!editing && (
                <Input
                  label="Mật khẩu"
                  required
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Mật khẩu"
                  secureTextEntry
                />
              )}
              <View>
                <Text style={styles.fieldLabel}>Vai trò</Text>
                <View style={styles.segment}>
                  <Pressable
                    onPress={() => setRole('STAFF')}
                    style={[styles.segmentItem, role === 'STAFF' && styles.segmentItemActive]}
                  >
                    <Text style={[styles.segmentText, role === 'STAFF' && styles.segmentTextActive]}>
                      Nhân viên
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setRole('ADMIN')}
                    style={[styles.segmentItem, role === 'ADMIN' && styles.segmentItemActive]}
                  >
                    <Text style={[styles.segmentText, role === 'ADMIN' && styles.segmentTextActive]}>
                      Quản lý
                    </Text>
                  </Pressable>
                </View>
              </View>
              {editing && (
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Hoạt động</Text>
                  <Switch value={isActive} onValueChange={setIsActive} />
                </View>
              )}
            </View>
            <View style={styles.modalActions}>
              <Button variant="ghost" onPress={closeForm} style={{ flex: 1 }}>Huỷ</Button>
              <Button onPress={handleSubmit} loading={isPending} style={{ flex: 1 }}>Lưu</Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Permissions modal */}
      <Modal visible={permOpen} transparent animationType="fade" onRequestClose={closePerm}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Phân quyền — {permTarget?.name}</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              <View style={{ gap: spacing.sm }}>
                {PERMISSIONS.map((p) => {
                  const checked = selectedPerms.includes(p.key);
                  return (
                    <View key={p.key} style={styles.permRow}>
                      <Text style={styles.permLabel}>{p.label}</Text>
                      <Switch value={checked} onValueChange={() => togglePerm(p.key)} />
                    </View>
                  );
                })}
              </View>
            </ScrollView>
            <Input
              label="Giới hạn xem đơn (phút, trống = không giới hạn)"
              value={orderViewTimeLimit}
              onChangeText={setOrderViewTimeLimit}
              placeholder="60"
              keyboardType="numeric"
            />
            <View style={styles.modalActions}>
              <Button variant="ghost" onPress={closePerm} style={{ flex: 1 }}>Huỷ</Button>
              <Button onPress={() => permMutation.mutate()} loading={permMutation.isPending} style={{ flex: 1 }}>
                Lưu quyền
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reset password modal */}
      <Modal visible={pwOpen} transparent animationType="fade" onRequestClose={closePw}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Đặt lại mật khẩu — {pwTarget?.name}</Text>
            <Input
              label="Mật khẩu mới"
              required
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="Mật khẩu mới"
            />
            <View style={styles.modalActions}>
              <Button variant="ghost" onPress={closePw} style={{ flex: 1 }}>Huỷ</Button>
              <Button
                onPress={() => {
                  if (!newPassword.trim()) {
                    Toast.show({ type: 'error', text1: 'Vui lòng nhập mật khẩu mới' });
                    return;
                  }
                  pwMutation.mutate();
                }}
                loading={pwMutation.isPending}
                style={{ flex: 1 }}
              >
                Đặt lại
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
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.primary },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
  iconBtn: {
    width: 36, height: 36, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.background,
  },
  modalBackdrop: {
    flex: 1, backgroundColor: colors.overlay,
    alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
  },
  modalCard: {
    width: '100%', maxWidth: 560,
    backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.xl, gap: spacing.lg,
    maxHeight: '92%',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  segment: {
    flexDirection: 'row', backgroundColor: colors.background,
    borderRadius: radius.md, padding: 4, gap: 4,
  },
  segmentItem: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderRadius: radius.sm },
  segmentItemActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  segmentTextActive: { color: '#fff' },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  switchLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  permRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  permLabel: { fontSize: 14, color: colors.text },
});
