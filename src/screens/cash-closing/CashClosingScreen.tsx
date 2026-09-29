import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { cashClosingApi, type CashClosing } from '@/api/cashClosing.api';
import { extractError } from '@/api/client';
import { usePermissions } from '@/hooks/usePermissions';
import { useResponsive } from '@/hooks/useResponsive';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { formatCurrency, formatDateTime } from '@/lib/utils';

const pad2 = (n: number) => n.toString().padStart(2, '0');
const dm = (date: string) => date.split('-').reverse().slice(0, 2).join('/');
const denomLabel = (d: number) => (d >= 1000 ? `${d / 1000}k` : `${d}đ`);

function diffTone(diff: number) {
  if (diff === 0) return { bg: colors.successLight, fg: '#047857', text: 'Két khớp', icon: 'check-circle' };
  if (diff < 0) return { bg: colors.dangerLight, fg: '#b91c1c', text: `Thiếu ${formatCurrency(-diff)}`, icon: 'alert-circle' };
  return { bg: colors.warningLight, fg: '#92400e', text: `Dư ${formatCurrency(diff)}`, icon: 'alert' };
}

type Tab = 'today' | 'history';

export function CashClosingScreen() {
  const { isAdmin } = usePermissions();
  const [tab, setTab] = useState<Tab>('today');
  return (
    <View style={styles.container}>
      {isAdmin && (
        <View style={styles.tabs}>
          {(
            [
              { v: 'today', label: 'Chốt két hôm nay' },
              { v: 'history', label: 'Sổ chốt két' },
            ] as { v: Tab; label: string }[]
          ).map((t) => (
            <Pressable key={t.v} onPress={() => setTab(t.v)} style={[styles.tab, tab === t.v && styles.tabActive]}>
              <Text style={[styles.tabText, tab === t.v && { color: '#fff' }]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {tab === 'today' ? <TodayClosing /> : <ClosingHistory />}
    </View>
  );
}

/** Nhân viên chốt két cuối ngày: hệ thống tự tính tiền phải có, nhân viên đếm theo mệnh giá. */
function TodayClosing() {
  const qc = useQueryClient();
  const { isPhone } = useResponsive();
  const query = useQuery({ queryKey: ['cash-closing', 'preview'], queryFn: () => cashClosingApi.preview() });
  const p = query.data;

  const [counts, setCounts] = useState<Record<string, string>>({});
  const [expenses, setExpenses] = useState('');
  const [expenseNote, setExpenseNote] = useState('');
  const [note, setNote] = useState('');

  const expenseNum = Number(expenses.replace(/\D/g, '')) || 0;
  const counted = useMemo(
    () => (p?.denominations ?? []).reduce((s, d) => s + d * (Number(counts[String(d)]) || 0), 0),
    [p, counts],
  );
  const expected = (p?.expectedBeforeExpenses ?? 0) - expenseNum;
  const diff = counted - expected;
  const tone = diffTone(diff);

  const submit = useMutation({
    mutationFn: () =>
      cashClosingApi.create({
        denominations: Object.fromEntries(
          (p?.denominations ?? []).map((d) => [String(d), Number(counts[String(d)]) || 0]),
        ),
        expenses: expenseNum,
        expenseNote: expenseNote.trim() || undefined,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã chốt két — đã báo chủ tiệm' });
      qc.invalidateQueries({ queryKey: ['cash-closing'] });
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  if (query.isLoading || !p) {
    return <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />;
  }
  if (p.closing) return <ClosedSummary closing={p.closing} />;

  const confirm = () => {
    if (diff !== 0 && !note.trim()) {
      Toast.show({ type: 'error', text1: 'Két lệch tiền — vui lòng ghi lý do' });
      return;
    }
    Alert.alert(
      'Chốt két hôm nay?',
      `Két đếm ${formatCurrency(counted)} — ${tone.text.toLowerCase()}.\nSau khi chốt sẽ không sửa được (chỉ chủ tiệm xoá để chốt lại).`,
      [
        { text: 'Huỷ', style: 'cancel' },
        { text: 'Chốt két', onPress: () => submit.mutate() },
      ],
    );
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: isPhone ? spacing.md : spacing.lg, gap: spacing.md }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
    >
      {/* Hệ thống tự tính */}
      <Card style={{ padding: spacing.lg, gap: spacing.sm }}>
        <Text style={styles.cardTitle}>Chốt két ngày {dm(p.date)}</Text>
        <Line label="Tiền đầu ngày" value={formatCurrency(p.openingCash)} />
        <Line label={`+ Đã thu (${p.orderCount} đơn)`} value={formatCurrency(p.collected)} />
        <Line label={`− Chuyển khoản (${p.transferCount} GD)`} value={formatCurrency(p.transfers)} muted />
        <View style={styles.lineRow}>
          <Text style={styles.lineLabel}>− Chi phí (đá, cf ông Địa…)</Text>
          <TextInput
            style={[styles.input, { width: 130, textAlign: 'right' }]}
            keyboardType="number-pad"
            placeholder="0"
            value={expenses ? Number(expenses).toLocaleString('vi-VN') : ''}
            onChangeText={(t) => setExpenses(t.replace(/\D/g, ''))}
          />
        </View>
        {expenseNum > 0 && (
          <TextInput
            style={styles.input}
            placeholder="Chi cho việc gì? (vd: mua đá 15k, cf ông Địa 10k)"
            value={expenseNote}
            onChangeText={setExpenseNote}
          />
        )}
        <View style={styles.divider} />
        <View style={styles.lineRow}>
          <Text style={[styles.lineLabel, { fontWeight: '800', color: colors.text }]}>= Tiền mặt phải có trong két</Text>
          <Text style={styles.bigValue}>{formatCurrency(expected)}</Text>
        </View>
      </Card>

      {/* Đếm két */}
      <Card style={{ padding: spacing.lg, gap: spacing.sm }}>
        <Text style={styles.cardTitle}>Đếm tiền mặt trong két</Text>
        <View style={styles.denomGrid}>
          {p.denominations.map((d) => {
            const n = Number(counts[String(d)]) || 0;
            return (
              <View key={d} style={[styles.denomRow, isPhone && { width: '100%' }]}>
                <Text style={styles.denomLabel}>{denomLabel(d)}</Text>
                <Text style={styles.times}>×</Text>
                <TextInput
                  style={[styles.input, styles.denomInput]}
                  keyboardType="number-pad"
                  placeholder="0"
                  value={counts[String(d)] ?? ''}
                  onChangeText={(t) => setCounts((c) => ({ ...c, [String(d)]: t.replace(/\D/g, '') }))}
                />
                <Text style={styles.denomSum}>{n ? formatCurrency(d * n) : ''}</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.divider} />
        <View style={styles.lineRow}>
          <Text style={[styles.lineLabel, { fontWeight: '800', color: colors.text }]}>Két đếm được</Text>
          <Text style={styles.bigValue}>{formatCurrency(counted)}</Text>
        </View>
      </Card>

      {/* Kết quả */}
      <View style={[styles.result, { backgroundColor: tone.bg }]}>
        <Icon name={tone.icon} size={28} color={tone.fg} />
        <Text style={[styles.resultText, { color: tone.fg }]}>{tone.text}</Text>
      </View>
      {diff !== 0 && (
        <TextInput
          style={[styles.input, { minHeight: 64, textAlignVertical: 'top' }]}
          multiline
          placeholder="Lý do lệch (bắt buộc) — vd: thối nhầm, khách thiếu 2k…"
          value={note}
          onChangeText={setNote}
        />
      )}
      <Text style={styles.hint}>
        Sau khi chốt, để lại {formatCurrency(p.openingCash)} trong két cho ngày mai, nộp{' '}
        {formatCurrency(Math.max(0, counted - p.openingCash))} cho chủ tiệm.
      </Text>
      <Button size="lg" onPress={confirm} loading={submit.isPending} leftIcon={<Icon name="cash-lock" size={22} color="#fff" />}>
        Chốt két
      </Button>
    </ScrollView>
  );
}

function ClosedSummary({ closing: c }: { closing: CashClosing }) {
  const diff = Number(c.difference);
  const tone = diffTone(diff);
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Card style={{ padding: spacing.lg, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name="lock-check" size={22} color={colors.success} />
          <Text style={styles.cardTitle}>Đã chốt két ngày {dm(c.date)}</Text>
        </View>
        <Text style={styles.hint}>
          {c.closedBy.name} chốt lúc {formatDateTime(c.createdAt)}
        </Text>
        <ClosingLines c={c} />
        <View style={[styles.result, { backgroundColor: tone.bg, marginTop: spacing.sm }]}>
          <Icon name={tone.icon} size={24} color={tone.fg} />
          <Text style={[styles.resultText, { color: tone.fg, fontSize: 18 }]}>{tone.text}</Text>
        </View>
        {c.note ? <Text style={styles.hint}>Lý do: {c.note}</Text> : null}
      </Card>
    </ScrollView>
  );
}

function ClosingLines({ c }: { c: CashClosing }) {
  return (
    <>
      <Line label="Tiền đầu ngày" value={formatCurrency(Number(c.openingCash))} />
      <Line label="+ Đã thu" value={formatCurrency(Number(c.collected))} />
      <Line label="− Chuyển khoản" value={formatCurrency(Number(c.transfers))} muted />
      {Number(c.expenses) > 0 && (
        <Line
          label={`− Chi phí${c.expenseNote ? ` (${c.expenseNote})` : ''}`}
          value={formatCurrency(Number(c.expenses))}
          muted
        />
      )}
      <Line label="= Phải có trong két" value={formatCurrency(Number(c.expectedCash))} strong />
      <Line label="Két đếm được" value={formatCurrency(Number(c.countedCash))} strong />
    </>
  );
}

/** ADMIN: sổ chốt két theo tháng */
function ClosingHistory() {
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(() => new Date());
  const [openId, setOpenId] = useState<string | null>(null);
  const month = `${cursor.getFullYear()}-${pad2(cursor.getMonth() + 1)}`;
  const query = useQuery({ queryKey: ['cash-closing', 'list', month], queryFn: () => cashClosingApi.list(month) });
  const remove = useMutation({
    mutationFn: (id: string) => cashClosingApi.remove(id),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã xoá — nhân viên có thể chốt lại' });
      qc.invalidateQueries({ queryKey: ['cash-closing'] });
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });
  const data = query.data;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <View style={styles.monthBar}>
        <Pressable style={styles.monthBtn} onPress={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
          <Icon name="chevron-left" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.monthText}>Tháng {pad2(cursor.getMonth() + 1)}/{cursor.getFullYear()}</Text>
        <Pressable style={styles.monthBtn} onPress={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
          <Icon name="chevron-right" size={26} color={colors.text} />
        </Pressable>
      </View>

      {query.isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="Chưa có ngày nào chốt két trong tháng" />
      ) : (
        <>
          <Card style={{ padding: spacing.lg, gap: spacing.xs }}>
            <Line label={`Số ngày đã chốt`} value={`${data.totals.days} ngày`} />
            <Line label="Tổng đã thu" value={formatCurrency(data.totals.collected)} />
            <Line label="Tổng chuyển khoản" value={formatCurrency(data.totals.transfers)} muted />
            <Line label="Tổng chi phí" value={formatCurrency(data.totals.expenses)} muted />
            <Line
              label={`Tổng chênh lệch (${data.totals.mismatchDays} ngày lệch)`}
              value={formatCurrency(data.totals.difference)}
              strong
            />
          </Card>
          {data.items.map((c) => {
            const tone = diffTone(Number(c.difference));
            const open = openId === c.id;
            return (
              <Card key={c.id} style={{ overflow: 'hidden' }}>
                <Pressable style={styles.histRow} onPress={() => setOpenId(open ? null : c.id)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.histDate}>{dm(c.date)} · {c.closedBy.name}</Text>
                    <Text style={styles.hint}>
                      Thu {formatCurrency(Number(c.collected))} · két {formatCurrency(Number(c.countedCash))}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                    <Text style={{ color: tone.fg, fontWeight: '700', fontSize: 12 }}>{tone.text}</Text>
                  </View>
                  <Icon name={open ? 'chevron-up' : 'chevron-down'} size={22} color={colors.textMuted} />
                </Pressable>
                {open && (
                  <View style={{ padding: spacing.md, paddingTop: 0, gap: spacing.xs }}>
                    <ClosingLines c={c} />
                    {c.note ? <Text style={styles.hint}>Lý do lệch: {c.note}</Text> : null}
                    <Button
                      variant="outline"
                      style={{ borderColor: colors.danger, marginTop: spacing.sm }}
                      loading={remove.isPending}
                      onPress={() =>
                        Alert.alert('Xoá lần chốt này?', 'Nhân viên sẽ chốt lại được ngày này.', [
                          { text: 'Huỷ', style: 'cancel' },
                          { text: 'Xoá', style: 'destructive', onPress: () => remove.mutate(c.id) },
                        ])
                      }
                    >
                      <Text style={{ color: colors.danger }}>Xoá để chốt lại</Text>
                    </Button>
                  </View>
                )}
              </Card>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

function Line({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <View style={styles.lineRow}>
      <Text style={[styles.lineLabel, strong && { fontWeight: '700', color: colors.text }]}>{label}</Text>
      <Text style={[styles.lineValue, muted && { color: colors.textMuted }, strong && { fontWeight: '800' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabs: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  tab: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  lineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  lineLabel: { flex: 1, fontSize: 15, color: colors.textMuted },
  lineValue: { fontSize: 16, fontWeight: '600', color: colors.text },
  bigValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  input: {
    height: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text, fontSize: 16,
  },
  denomGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: spacing.sm },
  denomRow: { width: '47%', flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  denomLabel: { width: 52, fontSize: 16, fontWeight: '800', color: colors.text },
  times: { fontSize: 16, color: colors.textMuted },
  denomInput: { width: 72, textAlign: 'center' },
  denomSum: { flex: 1, textAlign: 'right', fontSize: 14, color: colors.textMuted },
  result: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    padding: spacing.lg, borderRadius: radius.lg,
  },
  resultText: { fontSize: 22, fontWeight: '800' },
  hint: { fontSize: 13, color: colors.textMuted },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  monthBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  monthText: { fontSize: 19, fontWeight: '700', color: colors.text, minWidth: 150, textAlign: 'center' },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  histDate: { fontSize: 16, fontWeight: '700', color: colors.text },
  badge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
});
