import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Card, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/Button';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { extractError } from '@/api/client';
import { usePermissions } from '@/hooks/usePermissions';
import {
  timesheetApi,
  type TimesheetEntry,
  type TimesheetUser,
  type TimesheetWeek,
} from '@/api/timesheet.api';
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
/** "2026-10-05" → "05/10" */
function ddmm(ymd: string) {
  return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
}
function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Thống kê chấm công theo tháng — ADMIN thấy mọi nhân viên, STAFF chỉ thấy mình. */
export function TimesheetMonthly() {
  const { isAdmin } = usePermissions();
  const [editing, setEditing] = useState<{ entry: TimesheetEntry; name: string } | null>(null);
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
          {/* Tổng tháng = cộng các tuần lương (tuần thuộc tháng có ngày Chủ nhật cuối tuần) */}
          <Card>
            <CardContent style={styles.summary}>
              <Stat label="Tổng giờ tháng" value={hours(data.totalHours)} />
              <Stat label="Tổng lương tháng" value={money(data.totalAmount)} highlight />
              {data.users.length > 1 && (
                <View style={styles.userChips}>
                  {data.users.map((u) => (
                    <View key={u.userId} style={styles.userChip}>
                      <Text style={styles.userChipText}>
                        {u.name}: <Text style={{ fontWeight: '700' }}>{hours(u.totalHours)}</Text> ·{' '}
                        <Text style={{ fontWeight: '700', color: colors.success }}>{money(u.totalAmount)}</Text>
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              <Text style={styles.note}>
                {data.weeks.length} tuần ({ddmm(data.from)} – {ddmm(data.to)}) · Ngày thường{' '}
                {money(data.rates.weekday)}/giờ · Chủ nhật {money(data.rates.sunday)}/giờ · Giờ vào/ra làm
                tròn 30 phút · Tuần từ Thứ 2 đến Chủ nhật
              </Text>
            </CardContent>
          </Card>

          {data.weeks.map((w, idx) => (
            <WeekBlock
              key={w.start}
              week={w}
              index={data.weeks.length - idx}
              onEdit={isAdmin ? (entry, name) => setEditing({ entry, name }) : undefined}
            />
          ))}
        </>
      )}
      {editing && (
        <EditEntryModal entry={editing.entry} name={editing.name} onClose={() => setEditing(null)} />
      )}
    </ScrollView>
  );
}

/** ADMIN sửa giờ vào/ra hoặc xoá 1 ca chấm công. */
function EditEntryModal({ entry, name, onClose }: { entry: TimesheetEntry; name: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [checkIn, setCheckIn] = useState<Date | null>(new Date(entry.checkIn));
  const [checkOut, setCheckOut] = useState<Date | null>(entry.checkOut ? new Date(entry.checkOut) : null);
  const [open, setOpen] = useState(!entry.checkOut);

  const done = (msg: string) => {
    Toast.show({ type: 'success', text1: msg });
    qc.invalidateQueries({ queryKey: ['timesheet'] });
    onClose();
  };
  const save = useMutation({
    mutationFn: () =>
      timesheetApi.update(entry.id, {
        checkIn: checkIn!.toISOString(),
        checkOut: open ? null : checkOut!.toISOString(),
      }),
    onSuccess: () => done('Đã sửa ca chấm công'),
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });
  const remove = useMutation({
    mutationFn: () => timesheetApi.remove(entry.id),
    onSuccess: () => done('Đã xoá ca chấm công'),
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });
  const badOrder = !open && !!checkIn && !!checkOut && checkOut <= checkIn;
  const invalid = !checkIn || (!open && !checkOut) || badOrder;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Sửa ca chấm công — {name}</Text>
          <DateTimeField label="Giờ vào ca" value={checkIn} onChange={setCheckIn} />
          <DateTimeField label="Giờ kết ca" value={checkOut} onChange={setCheckOut} disabled={open} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.text }}>Chưa kết ca (đang làm)</Text>
            <Switch value={open} onValueChange={setOpen} />
          </View>
          {badOrder && <Text style={{ color: colors.danger, fontSize: 12 }}>Giờ kết ca phải sau giờ vào ca</Text>}
          <Text style={styles.note}>Giờ tính lương vẫn làm tròn 30 phút gần nhất.</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <Button
              variant="outline"
              style={{ flex: 1, borderColor: colors.danger }}
              loading={remove.isPending}
              onPress={() =>
                Alert.alert('Xoá ca chấm công', `Xoá ca này của ${name}?`, [
                  { text: 'Huỷ', style: 'cancel' },
                  { text: 'Xoá', style: 'destructive', onPress: () => remove.mutate() },
                ])
              }
            >
              <Text style={{ color: colors.danger }}>Xoá</Text>
            </Button>
            <Button variant="outline" style={{ flex: 1 }} onPress={onClose}>Huỷ</Button>
            <Button style={{ flex: 1 }} disabled={invalid} loading={save.isPending} onPress={() => save.mutate()}>
              Lưu
            </Button>
          </View>
        </View>
      </View>
    </Modal>
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

/** 1 tuần lương = 1 block riêng: tổng tuần + từng nhân viên (bấm để xem từng ca). */
function WeekBlock({ week, index, onEdit }: {
  week: TimesheetWeek; index: number; onEdit?: (entry: TimesheetEntry, name: string) => void;
}) {
  const today = todayYmd();
  const isCurrent = week.start <= today && today <= week.end;
  return (
    <View style={[styles.week, isCurrent && styles.weekCurrent]}>
      <View style={[styles.weekHeader, isCurrent && { backgroundColor: colors.primaryLight }]}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Text style={styles.weekTitle}>
            Tuần {index}: {ddmm(week.start)} – {ddmm(week.end)}
          </Text>
          {isCurrent && (
            <View style={styles.weekBadge}>
              <Text style={styles.weekBadgeText}>Tuần này</Text>
            </View>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.weekAmount}>{money(week.totalAmount)}</Text>
          <Text style={styles.userMeta}>{hours(week.totalHours)}</Text>
        </View>
      </View>
      {week.users.length === 0 ? (
        <Text style={[styles.note, { padding: spacing.md }]}>Chưa có ca nào trong tuần này</Text>
      ) : (
        <View style={{ padding: spacing.sm, gap: spacing.sm }}>
          {week.users.map((u) => (
            <UserCard
              key={u.userId}
              user={u}
              defaultOpen={week.users.length === 1}
              onEdit={onEdit ? (entry) => onEdit(entry, u.name) : undefined}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function UserCard({ user, defaultOpen, onEdit }: {
  user: TimesheetUser; defaultOpen: boolean; onEdit?: (entry: TimesheetEntry) => void;
}) {
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
            <EntryRow key={e.id} entry={e} onEdit={onEdit ? () => onEdit(e) : undefined} />
          ))}
        </View>
      )}
    </Card>
  );
}

function EntryRow({ entry: e, onEdit }: { entry: TimesheetEntry; onEdit?: () => void }) {
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
      {onEdit && (
        <Pressable onPress={onEdit} hitSlop={8} style={{ paddingLeft: 4 }}>
          <Icon name="pencil-outline" size={20} color={colors.primary} />
        </Pressable>
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
  userChips: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  userChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    backgroundColor: colors.background,
  },
  userChipText: { fontSize: 13, color: colors.text },
  week: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  weekCurrent: { borderColor: colors.primary, borderWidth: 1.5 },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  weekTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  weekBadge: { backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  weekBadgeText: { color: colors.primaryForeground, fontSize: 11, fontWeight: '700' },
  weekAmount: { fontSize: 18, fontWeight: '800', color: colors.success },
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
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { width: '100%', maxWidth: 480, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
});
