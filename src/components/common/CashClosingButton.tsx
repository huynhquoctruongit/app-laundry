import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { cashClosingApi, type CashClosing } from '@/api/cashClosing.api';
import { extractError } from '@/api/client';
import { usePermissions } from '@/hooks/usePermissions';
import { useResponsive } from '@/hooks/useResponsive';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { formatCurrency, formatDateTime } from '@/lib/utils';

const pad2 = (n: number) => n.toString().padStart(2, '0');
const dm = (date: string) => date.split('-').reverse().slice(0, 2).join('/');
/** "1250000" → "1.250.000" (hiển thị trong ô nhập) */
const fmtInput = (digits: string) => (digits ? Number(digits).toLocaleString('vi-VN') : '');

function diffTone(diff: number) {
  if (diff === 0) return { bg: colors.successLight, fg: '#047857', text: 'Két khớp', icon: 'check-circle' };
  if (diff < 0) return { bg: colors.dangerLight, fg: '#b91c1c', text: `Thiếu ${formatCurrency(-diff)}`, icon: 'alert-circle' };
  return { bg: colors.warningLight, fg: '#92400e', text: `Dư ${formatCurrency(diff)}`, icon: 'alert' };
}

/** Drawer cố định bên trái trên POS/tablet (khớp AppDrawer) → căn nút vào giữa header phần nội dung. */
const POS_DRAWER_WIDTH = 240;

/**
 * Nút mở popup chốt két cuối ngày.
 *  - POS/tablet: nút "Chốt két" nằm giữa thanh header
 *  - Điện thoại: nút tròn nổi ngay trên nút "Vào ca"
 */
export function CashClosingButton() {
  const [open, setOpen] = useState(false);
  const { isPhone } = useResponsive();
  const insets = useSafeAreaInsets();
  const preview = useQuery({
    queryKey: ['cash-closing', 'preview'],
    queryFn: () => cashClosingApi.preview(),
    staleTime: 60_000,
  });
  const closed = Boolean(preview.data?.closing);
  const openModal = () => {
    preview.refetch();
    setOpen(true);
  };
  const badge = (
    <View style={styles.fabBadge}>
      <Icon name="check" size={12} color="#fff" />
    </View>
  );

  return (
    <>
      {isPhone ? (
        <Pressable
          onPress={openModal}
          style={({ pressed }) => [styles.fab, { opacity: pressed ? 0.85 : 1 }]}
          accessibilityLabel="Chốt két"
          hitSlop={8}
        >
          <Icon name="cash-register" size={28} color="#fff" />
          {closed && badge}
        </Pressable>
      ) : (
        // Lớp phủ ngang header phần nội dung, chỉ nút nhận chạm (box-none)
        <View pointerEvents="box-none" style={[styles.headerSlot, { top: insets.top + 8, left: POS_DRAWER_WIDTH }]}>
          <Pressable
            onPress={openModal}
            style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.85 : 1 }]}
            accessibilityLabel="Chốt két"
          >
            <Icon name="cash-register" size={22} color="#fff" />
            <Text style={styles.headerBtnText}>{closed ? 'Đã chốt két' : 'Chốt két'}</Text>
            {closed && badge}
          </Pressable>
        </View>
      )}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Chốt két</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={12}>
                <Icon name="close" size={26} color={colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.lg }} keyboardShouldPersistTaps="handled">
              {open && <ClosingBody />}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function ClosingBody() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['cash-closing', 'preview'], queryFn: () => cashClosingApi.preview() });
  const p = query.data;

  const [expenses, setExpenses] = useState<string | null>(null); // null = chưa sửa → dùng mặc định
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');

  const expenseDigits = expenses ?? String(p?.defaultExpenses ?? 0);
  const expenseNum = Number(expenseDigits) || 0;
  const expected = (p?.expectedBeforeExpenses ?? 0) - expenseNum;
  const countedNum = Number(counted) || 0;
  const diff = countedNum - expected;
  const tone = diffTone(diff);

  const submit = useMutation({
    mutationFn: () =>
      cashClosingApi.create({ countedCash: countedNum, expenses: expenseNum, note: note.trim() || undefined }),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã chốt két — đã báo chủ tiệm' });
      qc.invalidateQueries({ queryKey: ['cash-closing'] });
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  if (query.isLoading || !p) {
    return <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: spacing.xl }} />;
  }

  if (p.closing) {
    return (
      <>
        <ClosedSummary c={p.closing} />
        <ClosingBook />
      </>
    );
  }

  const confirm = () => {
    if (!counted) {
      Toast.show({ type: 'error', text1: 'Nhập số tiền mặt đếm được trong két' });
      return;
    }
    if (diff !== 0 && !note.trim()) {
      Toast.show({ type: 'error', text1: 'Két lệch tiền — vui lòng ghi lý do' });
      return;
    }
    Alert.alert('Chốt két hôm nay?', `Két đếm ${formatCurrency(countedNum)} — ${tone.text.toLowerCase()}.`, [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Chốt két', onPress: () => submit.mutate() },
    ]);
  };

  return (
    <>
      <Text style={styles.dateText}>Ngày {dm(p.date)}</Text>
      <Line label="Tiền đầu ngày" value={formatCurrency(p.openingCash)} />
      <Line label={`+ Đã thu (${p.orderCount} đơn)`} value={formatCurrency(p.collected)} />
      <Line label={`− Chuyển khoản (${p.transferCount} GD)`} value={formatCurrency(p.transfers)} muted />
      <View style={styles.lineRow}>
        <Text style={styles.lineLabel}>− Chi phí (đá, cf ông Địa…)</Text>
        <TextInput
          style={[styles.input, styles.expenseInput]}
          keyboardType="number-pad"
          value={fmtInput(expenseDigits)}
          onChangeText={(t) => setExpenses(t.replace(/\D/g, ''))}
        />
      </View>
      <View style={styles.divider} />
      <View style={styles.lineRow}>
        <Text style={[styles.lineLabel, styles.strongLabel]}>= Tiền mặt phải có trong két</Text>
        <Text style={styles.bigValue}>{formatCurrency(expected)}</Text>
      </View>

      <Text style={styles.countLabel}>Tiền mặt đếm được trong két</Text>
      <View style={styles.countBox}>
        <TextInput
          style={styles.countInput}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={colors.textSubtle}
          value={fmtInput(counted)}
          onChangeText={(t) => setCounted(t.replace(/\D/g, '').replace(/^0+/, ''))}
          autoFocus
        />
        <Text style={styles.countUnit}>đ</Text>
      </View>

      <View style={[styles.result, { backgroundColor: tone.bg }]}>
        <Icon name={tone.icon} size={26} color={tone.fg} />
        <Text style={[styles.resultText, { color: tone.fg }]}>{counted ? tone.text : 'Nhập số tiền đếm được'}</Text>
      </View>

      {counted !== '' && diff !== 0 && (
        <TextInput
          style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
          multiline
          placeholder="Lý do lệch (bắt buộc) — vd: thối nhầm, khách thiếu 2k…"
          value={note}
          onChangeText={setNote}
        />
      )}
      {counted !== '' && (
        <Text style={styles.hint}>
          Để lại {formatCurrency(p.openingCash)} trong két cho ngày mai, nộp{' '}
          {formatCurrency(Math.max(0, countedNum - p.openingCash))} cho chủ tiệm.
        </Text>
      )}
      <Pressable
        style={({ pressed }) => [styles.submit, (submit.isPending || pressed) && { opacity: 0.8 }]}
        onPress={confirm}
        disabled={submit.isPending}
      >
        {submit.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Icon name="cash-lock" size={22} color="#fff" />
            <Text style={styles.submitText}>Chốt két</Text>
          </>
        )}
      </Pressable>
    </>
  );
}

function ClosedSummary({ c }: { c: CashClosing }) {
  const tone = diffTone(Number(c.difference));
  return (
    <View style={styles.summary}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="lock-check" size={22} color={colors.success} />
        <Text style={styles.summaryTitle}>Đã chốt két ngày {dm(c.date)}</Text>
      </View>
      <Text style={styles.hint}>
        {c.closedBy.name} chốt lúc {formatDateTime(c.createdAt)}
      </Text>
      <Line label="Phải có trong két" value={formatCurrency(Number(c.expectedCash))} />
      <Line label="Két đếm được" value={formatCurrency(Number(c.countedCash))} strong />
      <View style={[styles.result, { backgroundColor: tone.bg, paddingVertical: spacing.md }]}>
        <Icon name={tone.icon} size={22} color={tone.fg} />
        <Text style={[styles.resultText, { color: tone.fg, fontSize: 18 }]}>{tone.text}</Text>
      </View>
      {c.note ? <Text style={styles.hint}>Lý do: {c.note}</Text> : null}
    </View>
  );
}

/** Sổ chốt két tháng hiện tại — hiện ngay sau khi chốt. Chủ tiệm xoá được để chốt lại. */
function ClosingBook() {
  const qc = useQueryClient();
  const { isAdmin } = usePermissions();
  const [cursor, setCursor] = useState(() => new Date());
  const [openId, setOpenId] = useState<string | null>(null);
  const month = `${cursor.getFullYear()}-${pad2(cursor.getMonth() + 1)}`;
  const query = useQuery({ queryKey: ['cash-closing', 'list', month], queryFn: () => cashClosingApi.list(month) });
  const remove = useMutation({
    mutationFn: (id: string) => cashClosingApi.remove(id),
    onSuccess: () => {
      Toast.show({ type: 'success', text1: 'Đã xoá — có thể chốt lại' });
      qc.invalidateQueries({ queryKey: ['cash-closing'] });
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });
  useEffect(() => setOpenId(null), [month]);
  const data = query.data;

  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
      <View style={styles.bookHeader}>
        <Text style={styles.summaryTitle}>Sổ chốt két</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Pressable hitSlop={8} onPress={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
            <Icon name="chevron-left" size={26} color={colors.text} />
          </Pressable>
          <Text style={{ fontWeight: '700', color: colors.text }}>
            {pad2(cursor.getMonth() + 1)}/{cursor.getFullYear()}
          </Text>
          <Pressable hitSlop={8} onPress={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
            <Icon name="chevron-right" size={26} color={colors.text} />
          </Pressable>
        </View>
      </View>
      {query.isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : !data || data.items.length === 0 ? (
        <Text style={styles.hint}>Chưa có ngày nào chốt két trong tháng.</Text>
      ) : (
        <>
          <Text style={styles.hint}>
            {data.totals.days} ngày · tổng lệch {formatCurrency(data.totals.difference)} ({data.totals.mismatchDays} ngày lệch)
          </Text>
          {data.items.map((c) => {
            const tone = diffTone(Number(c.difference));
            const expanded = openId === c.id;
            return (
              <View key={c.id} style={styles.bookItem}>
                <Pressable style={styles.bookRow} onPress={() => setOpenId(expanded ? null : c.id)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bookDate}>{dm(c.date)} · {c.closedBy.name}</Text>
                    <Text style={styles.hint}>
                      Két {formatCurrency(Number(c.countedCash))} / phải có {formatCurrency(Number(c.expectedCash))}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                    <Text style={{ color: tone.fg, fontWeight: '700', fontSize: 12 }}>{tone.text}</Text>
                  </View>
                </Pressable>
                {expanded && (
                  <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: 2 }}>
                    <Line label="Tiền đầu ngày" value={formatCurrency(Number(c.openingCash))} />
                    <Line label="+ Đã thu" value={formatCurrency(Number(c.collected))} />
                    <Line label="− Chuyển khoản" value={formatCurrency(Number(c.transfers))} muted />
                    <Line label="− Chi phí" value={formatCurrency(Number(c.expenses))} muted />
                    <Text style={styles.hint}>Chốt lúc {formatDateTime(c.createdAt)}</Text>
                    {c.note ? <Text style={styles.hint}>Lý do: {c.note}</Text> : null}
                    {isAdmin && (
                      <Pressable
                        style={styles.deleteBtn}
                        onPress={() =>
                          Alert.alert('Xoá lần chốt này?', 'Nhân viên sẽ chốt lại được ngày này.', [
                            { text: 'Huỷ', style: 'cancel' },
                            { text: 'Xoá', style: 'destructive', onPress: () => remove.mutate(c.id) },
                          ])
                        }
                      >
                        <Icon name="trash-can-outline" size={18} color={colors.danger} />
                        <Text style={{ color: colors.danger, fontWeight: '600' }}>Xoá để chốt lại</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

function Line({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <View style={styles.lineRow}>
      <Text style={[styles.lineLabel, strong && styles.strongLabel]}>{label}</Text>
      <Text style={[styles.lineValue, muted && { color: colors.textMuted }, strong && { fontWeight: '800' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Ngay trên nút "Vào ca" (TimeClockButton: bottom 96, cao 60)
  fab: {
    position: 'absolute',
    bottom: 168,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  headerSlot: { position: 'absolute', right: 0, alignItems: 'center' },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#4f46e5',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  headerBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  fabBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  sheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '94%',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  dateText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  lineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  lineLabel: { flex: 1, fontSize: 15, color: colors.textMuted },
  strongLabel: { fontWeight: '800', color: colors.text },
  lineValue: { fontSize: 16, fontWeight: '600', color: colors.text },
  bigValue: { fontSize: 24, fontWeight: '800', color: colors.text },
  divider: { height: 1, backgroundColor: colors.border },
  input: {
    height: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text, fontSize: 16,
  },
  expenseInput: { width: 120, textAlign: 'right' },
  countLabel: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  countBox: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: colors.primary,
    borderRadius: radius.lg, paddingHorizontal: spacing.lg, backgroundColor: colors.inputBg,
  },
  countInput: { flex: 1, fontSize: 32, fontWeight: '800', color: colors.text, paddingVertical: spacing.md, textAlign: 'right' },
  countUnit: { fontSize: 24, fontWeight: '700', color: colors.textMuted, marginLeft: spacing.xs },
  result: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    padding: spacing.lg, borderRadius: radius.lg,
  },
  resultText: { fontSize: 22, fontWeight: '800' },
  hint: { fontSize: 13, color: colors.textMuted },
  submit: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    height: 54, borderRadius: radius.lg, backgroundColor: '#4f46e5',
  },
  submitText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  summary: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.background },
  summaryTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  bookHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bookItem: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' },
  bookRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  bookDate: { fontSize: 15, fontWeight: '700', color: colors.text },
  badge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, alignSelf: 'flex-start' },
});
