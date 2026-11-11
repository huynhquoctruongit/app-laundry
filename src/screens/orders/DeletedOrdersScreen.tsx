import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQuery } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Card, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { orderApi, type DeletedOrderItem } from '@/api/order.api';
import { extractError } from '@/api/client';
import { useResponsive } from '@/hooks/useResponsive';
import { ORDER_STATUS_LABEL, type OrderStatus } from '@/helpers/enums/order-status';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { formatCurrency, formatDate } from '@/lib/utils';

type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

const pad2 = (n: number) => n.toString().padStart(2, '0');
const toYmd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** "dd/MM HH:mm" */
function formatShortDateTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

const PRESETS: { v: Exclude<DatePreset, 'custom'>; label: string }[] = [
  { v: 'today', label: 'Hôm nay' },
  { v: 'yesterday', label: 'Hôm qua' },
  { v: 'week', label: '7 ngày' },
  { v: 'month', label: 'Tháng này' },
];

export function DeletedOrdersScreen() {
  const { isPhone } = useResponsive();
  const [from, setFrom] = useState<Date>(startOfDay());
  const [to, setTo] = useState<Date>(startOfDay());
  const [preset, setPreset] = useState<DatePreset>('today');
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  function applyPreset(p: Exclude<DatePreset, 'custom'>) {
    const today = startOfDay();
    let f = today;
    if (p === 'yesterday') f = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    else if (p === 'week') f = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    else if (p === 'month') f = new Date(today.getFullYear(), today.getMonth(), 1);
    setFrom(f);
    setTo(p === 'yesterday' ? f : today);
    setPreset(p);
  }

  const query = useQuery({
    queryKey: ['orders', 'deleted', toYmd(from), toYmd(to)],
    queryFn: () => orderApi.deleted({ from: toYmd(from), to: toYmd(to) }),
  });
  const data = query.data;

  const renderItem = ({ item }: { item: DeletedOrderItem }) => (
    <Card>
      <CardContent style={styles.itemContent}>
        <View style={styles.row}>
          <Text style={styles.code}>{item.code}</Text>
          <Text style={styles.amount}>{formatCurrency(item.totalAmount)}</Text>
        </View>
        <Text style={styles.customer} numberOfLines={1}>
          {item.customerName || '-'}
          {item.customerPhone ? ` · ${item.customerPhone}` : ''}
        </Text>
        {item.items.length > 0 && (
          <Text style={styles.muted} numberOfLines={2}>
            {item.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}
          </Text>
        )}
        <Text style={styles.muted}>
          Tạo {formatShortDateTime(item.orderCreatedAt)} ·{' '}
          {ORDER_STATUS_LABEL[item.status as OrderStatus] ?? item.status}
        </Text>
        <View style={styles.deletedRow}>
          <Icon name="delete-outline" size={15} color={colors.danger} />
          <Text style={styles.deletedText} numberOfLines={1}>
            Xoá lúc {formatShortDateTime(item.deletedAt)} bởi {item.deletedByName || 'không rõ'}
          </Text>
        </View>
      </CardContent>
    </Card>
  );

  return (
    <View style={styles.container}>
      <View style={styles.presetRow}>
        {PRESETS.map((p) => (
          <Pressable
            key={p.v}
            onPress={() => applyPreset(p.v)}
            style={[styles.presetChip, preset === p.v && styles.presetChipActive]}
          >
            <Text style={[styles.presetChipText, preset === p.v && styles.presetChipTextActive]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={[styles.dateRow, isPhone && { flexWrap: 'wrap' }]}>
        <Pressable style={[styles.dateBtn, { flex: 1 }]} onPress={() => setShowFromPicker(true)}>
          <Icon name="calendar" size={18} color={colors.textMuted} />
          <Text style={styles.dateBtnText} numberOfLines={1}>Từ: {formatDate(from)}</Text>
        </Pressable>
        <Pressable style={[styles.dateBtn, { flex: 1 }]} onPress={() => setShowToPicker(true)}>
          <Icon name="calendar" size={18} color={colors.textMuted} />
          <Text style={styles.dateBtnText} numberOfLines={1}>Đến: {formatDate(to)}</Text>
        </Pressable>
        {showFromPicker && (
          <DateTimePicker
            value={from}
            mode="date"
            maximumDate={new Date()}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, d) => {
              setShowFromPicker(Platform.OS === 'ios');
              if (d) {
                const f = startOfDay(d);
                setFrom(f);
                if (f > to) setTo(f);
                setPreset('custom');
              }
            }}
          />
        )}
        {showToPicker && (
          <DateTimePicker
            value={to}
            mode="date"
            maximumDate={new Date()}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, d) => {
              setShowToPicker(Platform.OS === 'ios');
              if (d) {
                const t = startOfDay(d);
                setTo(t);
                if (t < from) setFrom(t);
                setPreset('custom');
              }
            }}
          />
        )}
      </View>

      <View style={styles.summaryWrap}>
        <Card>
          <CardContent style={styles.summaryContent}>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>Số đơn đã xoá</Text>
              <Text style={styles.summaryValue}>{query.isLoading ? '—' : data?.count ?? 0}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.summaryLabel}>Tổng tiền các đơn</Text>
              <Text style={[styles.summaryValue, { color: colors.danger }]}>
                {query.isLoading ? '—' : formatCurrency(data?.totalAmount ?? 0)}
              </Text>
            </View>
          </CardContent>
        </Card>
      </View>

      <FlatList
        data={data?.items ?? []}
        keyExtractor={(o) => o.id}
        renderItem={renderItem}
        contentContainerStyle={{
          padding: isPhone ? spacing.md : spacing.lg,
          paddingTop: spacing.sm,
          gap: spacing.sm,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => query.refetch()}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          query.isLoading ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
          ) : query.isError ? (
            <EmptyState title="Không tải được danh sách" description={extractError(query.error).message} />
          ) : (
            <EmptyState
              title="Không có đơn nào bị xoá"
              description="Thử chọn khoảng ngày khác"
              icon={<Icon name="delete-off-outline" size={40} color={colors.textSubtle} />}
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  presetRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: spacing.md, paddingTop: spacing.md,
  },
  presetChip: {
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 99,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  presetChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  presetChipText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  presetChipTextActive: { color: '#fff' },
  dateRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    minWidth: 140, paddingHorizontal: spacing.md, height: 44,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
  },
  dateBtnText: { fontSize: 14, color: colors.text, fontWeight: '500', flexShrink: 1 },
  summaryWrap: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  summaryContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  summaryLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  summaryValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  itemContent: { padding: spacing.md, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  code: { fontSize: 14, fontWeight: '800', color: colors.text, fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo' },
  amount: { fontSize: 16, fontWeight: '800', color: colors.text },
  customer: { fontSize: 14, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  deletedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 8,
    backgroundColor: '#fef2f2', alignSelf: 'flex-start',
  },
  deletedText: { fontSize: 12, fontWeight: '600', color: colors.danger },
});
