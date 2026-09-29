import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { timesheetApi } from '@/api/timesheet.api';
import { extractError } from '@/api/client';
import { colors } from '@/theme/colors';

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}
function hhmm(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Đồng hồ chạy theo giây — chỉ chạy khi popup đang mở. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) {
      return;
    }
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/**
 * Nút tròn nổi trên mọi màn hình để nhân viên tự chấm công.
 * Bấm → popup toàn màn hình với 1 nút to hiện giờ:phút: chưa vào ca thì "Vào ca",
 * đang trong ca thì "Kết ca". Giờ tính lương làm tròn 30' ở backend.
 */
export function TimeClockButton() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const now = useNow(open);

  const currentQuery = useQuery({
    queryKey: ['timesheet', 'current'],
    queryFn: () => timesheetApi.current(),
    staleTime: 60_000,
  });
  const current = currentQuery.data;
  const inShift = Boolean(current);

  const mutation = useMutation({
    mutationFn: () => (inShift ? timesheetApi.checkOut() : timesheetApi.checkIn()),
    onSuccess: (entry) => {
      const at = hhmm(new Date(entry.checkOut ?? entry.checkIn));
      Toast.show({ type: 'success', text1: inShift ? `Đã kết ca lúc ${at}` : `Đã vào ca lúc ${at}` });
      queryClient.invalidateQueries({ queryKey: ['timesheet'] });
      setOpen(false);
    },
    onError: (err) => {
      Toast.show({ type: 'error', text1: extractError(err).message });
      // Trạng thái có thể đã đổi ở máy khác — tải lại.
      queryClient.invalidateQueries({ queryKey: ['timesheet', 'current'] });
    },
  });

  const accent = inShift ? colors.danger : colors.success;

  return (
    <>
      <Pressable
        onPress={() => {
          currentQuery.refetch();
          setOpen(true);
        }}
        style={({ pressed }) => [styles.fab, { backgroundColor: accent, opacity: pressed ? 0.85 : 1 }]}
        accessibilityLabel={inShift ? 'Kết ca' : 'Vào ca'}
        hitSlop={8}
      >
        <Icon name={inShift ? 'timer-sand' : 'clock-check-outline'} size={28} color="#fff" />
      </Pressable>

      <Modal visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.screen}>
          <Pressable style={styles.close} onPress={() => setOpen(false)} hitSlop={12}>
            <Icon name="close" size={32} color={colors.textMuted} />
          </Pressable>

          <Text style={styles.title}>{inShift ? 'Kết ca' : 'Vào ca'}</Text>
          {current ? (
            <Text style={styles.sub}>Bạn đã vào ca lúc {hhmm(new Date(current.checkIn))}</Text>
          ) : (
            <Text style={styles.sub}>Bấm vào đồng hồ để xác nhận vào ca</Text>
          )}

          <Pressable
            onPress={() => mutation.mutate()}
            disabled={mutation.isPending || currentQuery.isFetching}
            style={({ pressed }) => [
              styles.clock,
              { backgroundColor: accent, transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            {mutation.isPending || currentQuery.isFetching ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : (
              <>
                <Text style={styles.clockTime}>{hhmm(now)}</Text>
                <Text style={styles.clockLabel}>{inShift ? 'KẾT CA' : 'VÀO CA'}</Text>
              </>
            )}
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 96,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  close: { position: 'absolute', top: 24, right: 24 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  sub: { fontSize: 16, color: colors.textMuted, marginBottom: 24 },
  clock: {
    width: 300,
    height: 300,
    borderRadius: 150,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  clockTime: {
    fontSize: 88,
    fontWeight: '800',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  clockLabel: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: 2, marginTop: 4 },
});
