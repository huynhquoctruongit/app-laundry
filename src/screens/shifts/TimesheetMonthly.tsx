import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Card, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { timesheetApi, type TimesheetEntry, type TimesheetUser } from '@/api/timesheet.api';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}
function monthKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function hhmm(iso: string) {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function money(v: number) {
  return v.toLocaleString('vi-VN') + 'đ';
}
function hours(v: number) {
  return `${v.toLocaleString('vi-VN')}h`;
}

/** Thống kê chấm công theo tháng — ADMIN thấy mọi nhân viên, STAFF chỉ thấy mình. */
export function TimesheetMonthly() {
  const [cursor, setCursor] = useState(() => new Date());
  const month = monthKey(cursor);
  const shiftMonth = (delta: number) =>
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));

  const query = useQuery({
    queryKey: ['timesheet', 'monthly', month],
    queryFn: () => timesheetApi.monthly(month),
  });
  const data = query.data;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      {/* Chọn tháng */}
      <View style={styles.monthBar}>
        <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} style={styles.monthBtn}>
          <Icon name="chevron-left" size={28} color={colors.text} />
        </Pressable>
        <Text style={styles.monthText}>
          Tháng {pad2(cursor.getMonth() + 1)}/{cursor.getFullYear()}
        </Text>
        <Pressable onPress={() => shiftMonth(1)} hitSlop={10} style={styles.monthBtn}>
          <Icon name="chevron-right" size={28} color={colors.text} />
        </Pressable>
      </View>

      {query.isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : !data || data.users.length === 0 ? (
        <EmptyState title="Chưa có ca nào trong tháng này" />
      ) : (
        <>
          <Card>
            <CardContent style={styles.summary}>
              <Stat label="Tổng giờ" value={hours(data.totalHours)} />
              <Stat label="Tổng lương" value={money(data.totalAmount)} highlight />
              <Text style={styles.note}>
                Ngày thường {money(data.rates.weekday)}/giờ · Chủ nhật {money(data.rates.sunday)}/giờ ·
                Giờ vào/ra làm tròn 30 phút gần nhất
              </Text>
            </CardContent>
          </Card>

          {data.users.map((u) => (
            <UserCard key={u.userId} user={u} defaultOpen={data.users.length === 1} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={{ minWidth: 140 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, highlight && { color: colors.success }]}>{value}</Text>
    </View>
  );
}

function UserCard({ user, defaultOpen }: { user: TimesheetUser; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.userHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userMeta}>
            {user.entries.length} ca · {hours(user.totalHours)}
          </Text>
        </View>
        <Text style={styles.userAmount}>{money(user.totalAmount)}</Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={24} color={colors.textMuted} />
      </Pressable>
      {open && (
        <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.xs }}>
          {user.entries.map((e) => (
            <EntryRow key={e.id} entry={e} />
          ))}
        </View>
      )}
    </Card>
  );
}

function EntryRow({ entry: e }: { entry: TimesheetEntry }) {
  const d = new Date(e.checkIn);
  const inProgress = !e.roundedOut;
  return (
    <View style={[styles.entryRow, e.isSunday && { backgroundColor: colors.warningLight }]}>
      <Text style={[styles.entryDay, e.isSunday && { color: '#b45309' }]}>
        {WEEKDAYS[d.getDay()]} {pad2(d.getDate())}/{pad2(d.getMonth() + 1)}
      </Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.entryTime}>
          {hhmm(e.roundedIn)} – {e.roundedOut ? hhmm(e.roundedOut) : '…'}
        </Text>
        <Text style={styles.entryRaw}>
          Bấm {hhmm(e.checkIn)} – {e.checkOut ? hhmm(e.checkOut) : 'đang làm'}
        </Text>
      </View>
      {inProgress ? (
        <Text style={[styles.entryAmount, { color: colors.success }]}>Đang làm</Text>
      ) : (
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.entryAmount}>{money(e.amount)}</Text>
          <Text style={styles.entryRaw}>
            {hours(e.hours)} × {e.rate / 1000}k
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  monthBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthText: { fontSize: 20, fontWeight: '700', color: colors.text, minWidth: 160, textAlign: 'center' },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, padding: spacing.lg },
  statLabel: { fontSize: 12, color: colors.textMuted },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.text },
  note: { width: '100%', fontSize: 12, color: colors.textMuted },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  userName: { fontSize: 16, fontWeight: '700', color: colors.text },
  userMeta: { fontSize: 13, color: colors.textMuted },
  userAmount: { fontSize: 17, fontWeight: '800', color: colors.success },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
  },
  entryDay: { width: 64, fontSize: 14, fontWeight: '700', color: colors.text },
  entryTime: { fontSize: 15, fontWeight: '600', color: colors.text },
  entryRaw: { fontSize: 11, color: colors.textMuted },
  entryAmount: { fontSize: 15, fontWeight: '700', color: colors.text },
});
