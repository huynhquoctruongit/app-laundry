import React, { useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/common/EmptyState';
import { shiftApi } from '@/api/shift.api';
import { extractError } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { formatDateTime, formatDate } from '@/lib/utils';

export function ShiftsScreen() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isAdmin } = usePermissions();

  const [openShiftModal, setOpenShiftModal] = useState(false);
  const [closeShiftModal, setCloseShiftModal] = useState(false);
  const [shiftName, setShiftName] = useState('');
  const [shiftNote, setShiftNote] = useState('');
  const [closeNote, setCloseNote] = useState('');

  const currentQuery = useQuery({
    queryKey: ['shifts', 'current'],
    queryFn: () => shiftApi.current(),
    refetchInterval: 30_000,
  });

  const historyQuery = useQuery({
    queryKey: ['shifts', 'history'],
    queryFn: () => shiftApi.list({ isOpen: false, pageSize: 20 }),
  });

  const openMutation = useMutation({
    mutationFn: () => shiftApi.create({ name: shiftName, note: shiftNote || undefined }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã mở ca làm việc' });
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setOpenShiftModal(false);
      setShiftName('');
      setShiftNote('');
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  const closeMutation = useMutation({
    mutationFn: () =>
      shiftApi.close(currentQuery.data!.id, { note: closeNote || undefined }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã đóng ca' });
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setCloseShiftModal(false);
      setCloseNote('');
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  const checkInMutation = useMutation({
    mutationFn: () =>
      shiftApi.checkIn(currentQuery.data!.id, { userId: user!.id }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã check-in' });
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  const checkOutMutation = useMutation({
    mutationFn: (attendanceId: string) =>
      shiftApi.checkOut(currentQuery.data!.id, attendanceId),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã check-out' });
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  const currentShift = currentQuery.data;
  const myAttendance = currentShift?.attendances?.find(
    (a) => a.userId === user?.id && !a.checkOut,
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        {/* Current shift */}
        {currentShift ? (
          <Card>
            <CardHeader style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <CardTitle>Ca đang mở: {currentShift.name}</CardTitle>
                <Badge bg={colors.successLight} fg={colors.success}>Đang mở</Badge>
              </View>
              {isAdmin && (
                <Button
                  variant="destructive"
                  onPress={() => setCloseShiftModal(true)}
                  leftIcon={<Icon name="logout" size={20} color="#fff" />}
                >
                  Đóng ca
                </Button>
              )}
            </CardHeader>
            <CardContent style={{ gap: spacing.md }}>
              <View style={styles.shiftInfo}>
                <InfoCol label="Mở bởi" value={currentShift.openedBy?.name ?? '—'} />
                <InfoCol label="Bắt đầu" value={formatDateTime(currentShift.startTime)} />
                <InfoCol
                  label="Nhân viên"
                  value={`${currentShift.attendances?.length ?? 0} người`}
                />
              </View>

              {/* Self check-in/out */}
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                {myAttendance ? (
                  <Button
                    variant="outline"
                    onPress={() => checkOutMutation.mutate(myAttendance.id)}
                    loading={checkOutMutation.isPending}
                    leftIcon={<Icon name="logout" size={20} color={colors.text} />}
                  >
                    Check-out của tôi
                  </Button>
                ) : (
                  <Button
                    variant="success"
                    onPress={() => checkInMutation.mutate()}
                    loading={checkInMutation.isPending}
                    leftIcon={<Icon name="login" size={20} color="#fff" />}
                  >
                    Check-in của tôi
                  </Button>
                )}
              </View>

              {/* Attendances */}
              <Text style={styles.subTitle}>Danh sách điểm danh</Text>
              {currentShift.attendances && currentShift.attendances.length > 0 ? (
                <View style={{ gap: spacing.xs }}>
                  {currentShift.attendances.map((a) => (
                    <View key={a.id} style={styles.attendanceRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.attendanceName}>{a.user?.name ?? '—'}</Text>
                        <Text style={styles.attendanceMeta}>
                          Vào: {formatDateTime(a.checkIn)}
                          {a.checkOut ? `  ·  Ra: ${formatDateTime(a.checkOut)}` : ''}
                        </Text>
                      </View>
                      <Badge
                        bg={a.checkOut ? colors.background : colors.successLight}
                        fg={a.checkOut ? colors.textMuted : colors.success}
                      >
                        {a.checkOut ? 'Đã ra' : 'Đang làm'}
                      </Badge>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ color: colors.textMuted }}>Chưa có điểm danh</Text>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent style={{ alignItems: 'center', gap: spacing.md, padding: spacing.xl }}>
              <Icon name="clock-outline" size={48} color={colors.textMuted} />
              <Text style={styles.noShiftTitle}>Chưa có ca làm việc nào đang mở</Text>
              {isAdmin ? (
                <Button
                  size="lg"
                  onPress={() => setOpenShiftModal(true)}
                  leftIcon={<Icon name="play-circle" size={22} color="#fff" />}
                >
                  Mở ca làm việc
                </Button>
              ) : (
                <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
                  Vui lòng chờ quản lý mở ca làm việc.
                </Text>
              )}
            </CardContent>
          </Card>
        )}

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle>Lịch sử ca làm việc</CardTitle>
          </CardHeader>
          <CardContent style={{ gap: spacing.sm }}>
            {(historyQuery.data?.items ?? []).length === 0 ? (
              <EmptyState title="Chưa có ca nào đã đóng" />
            ) : (
              (historyQuery.data?.items ?? []).map((s) => (
                <View key={s.id} style={styles.historyRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyName}>{s.name}</Text>
                    <Text style={styles.historyMeta}>
                      {formatDateTime(s.startTime)}
                      {s.endTime ? ` → ${formatDateTime(s.endTime)}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.historyMeta}>
                    {s._count?.attendances ?? 0} NV
                  </Text>
                </View>
              ))
            )}
          </CardContent>
        </Card>
      </ScrollView>

      {/* Open shift modal */}
      <Modal visible={openShiftModal} transparent animationType="fade" onRequestClose={() => setOpenShiftModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Mở ca làm việc</Text>
            <Input
              label="Tên ca"
              required
              value={shiftName}
              onChangeText={setShiftName}
              placeholder="Ca sáng / Ca chiều..."
            />
            <Input
              label="Ghi chú"
              value={shiftNote}
              onChangeText={setShiftNote}
              multiline
              numberOfLines={3}
              style={{ minHeight: 72, textAlignVertical: 'top' }}
            />
            <View style={styles.modalActions}>
              <Button variant="ghost" onPress={() => setOpenShiftModal(false)} style={{ flex: 1 }}>
                Huỷ
              </Button>
              <Button
                onPress={() => {
                  if (!shiftName.trim()) {
                    Toast.show({ type: 'error', text1: 'Vui lòng nhập tên ca' });
                    return;
                  }
                  openMutation.mutate();
                }}
                loading={openMutation.isPending}
                style={{ flex: 1 }}
              >
                Mở ca
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Close shift modal */}
      <Modal visible={closeShiftModal} transparent animationType="fade" onRequestClose={() => setCloseShiftModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Đóng ca làm việc</Text>
            <Text style={{ color: colors.textMuted }}>
              Ca: {currentShift?.name}
            </Text>
            <Input
              label="Ghi chú đóng ca"
              value={closeNote}
              onChangeText={setCloseNote}
              multiline
              numberOfLines={3}
              style={{ minHeight: 72, textAlignVertical: 'top' }}
            />
            <View style={styles.modalActions}>
              <Button variant="ghost" onPress={() => setCloseShiftModal(false)} style={{ flex: 1 }}>
                Huỷ
              </Button>
              <Button
                variant="destructive"
                onPress={() => closeMutation.mutate()}
                loading={closeMutation.isPending}
                style={{ flex: 1 }}
              >
                Đóng ca
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoCol({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: 160 }}>
      <Text style={{ fontSize: 12, color: colors.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  shiftInfo: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  subTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  attendanceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    backgroundColor: colors.background, borderRadius: radius.md,
  },
  attendanceName: { fontSize: 14, fontWeight: '600', color: colors.text },
  attendanceMeta: { fontSize: 12, color: colors.textMuted },
  noShiftTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    backgroundColor: colors.background, borderRadius: radius.md,
  },
  historyName: { fontSize: 14, fontWeight: '600', color: colors.text },
  historyMeta: { fontSize: 12, color: colors.textMuted },
  modalBackdrop: {
    flex: 1, backgroundColor: colors.overlay,
    alignItems: 'center', justifyContent: 'center', padding: spacing.lg,
  },
  modalCard: {
    width: '100%', maxWidth: 500,
    backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.xl, gap: spacing.lg,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
});
