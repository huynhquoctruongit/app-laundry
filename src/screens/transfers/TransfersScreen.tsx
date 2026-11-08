import React, { useEffect, useMemo, useState } from 'react';
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
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { bankApi, type BankHistoryItem } from '@/api/bank.api';
import { extractError } from '@/api/client';
import { useResponsive } from '@/hooks/useResponsive';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { formatCurrency, formatDate } from '@/lib/utils';

type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

const PAGE_SIZE = 50;

const pad2 = (n: number) => n.toString().padStart(2, '0');

/** Date (giờ máy — VN) → "YYYY-MM-DD" cho BE */
function toYmd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** "dd/MM HH:mm" */
function formatShortDateTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const PRESETS: { v: Exclude<DatePreset, 'custom'>; label: string }[] = [
  { v: 'today', label: 'Hôm nay' },
  { v: 'yesterday', label: 'Hôm qua' },
  { v: 'week', label: '7 ngày' },
  { v: 'month', label: 'Tháng này' },
];

export function TransfersScreen() {
  const navigation = useNavigation<any>();
  const { isPhone } = useResponsive();
  const [from, setFrom] = useState<Date>(startOfDay());
  const [to, setTo] = useState<Date>(startOfDay());
  const [preset, setPreset] = useState<DatePreset>('today');
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');

  // Debounce ô tìm kiếm để không gọi API mỗi lần gõ
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  function applyPreset(p: Exclude<DatePreset, 'custom'>) {
    const today = startOfDay();
    let f = today;
    let t = today;
    if (p === 'yesterday') {
      f = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
      t = f;
    } else if (p === 'week') {
      f = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    } else if (p === 'month') {
      f = new Date(today.getFullYear(), today.getMonth(), 1);
    }
    setFrom(f);
    setTo(t);
    setPreset(p);
  }

  const params = useMemo(() => ({ from: toYmd(from), to: toYmd(to), q: q || undefined }), [from, to, q]);

  const historyQuery = useInfiniteQuery({
    queryKey: ['bank', 'history', params],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => bankApi.history({ ...params, page: pageParam as number, pageSize: PAGE_SIZE }),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      return loaded < lastPage.count && lastPage.items.length > 0 ? allPages.length + 1 : undefined;
    },
  });

  const pages = historyQuery.data?.pages ?? [];
  const items = pages.flatMap((p) => p.items);
  const summary = pages[0];

  const handleEndReached = () => {
    if (historyQuery.hasNextPage && !historyQuery.isFetchingNextPage) {
      historyQuery.fetchNextPage();
    }
  };

  const renderItem = ({ item }: { item: BankHistoryItem }) => (
    <Card>
      <CardContent style={styles.itemContent}>
        <View style={styles.itemTop}>
          <Text style={styles.itemTime}>{formatShortDateTime(item.transactionAt)}</Text>
          <Text style={styles.itemAmount} numberOfLines={1}>
            +{formatCurrency(item.amount)}
          </Text>
        </View>
        {item.counterName ? (
          <Text style={styles.itemName} numberOfLines={1}>
            {item.counterName}
          </Text>
        ) : null}
        {item.content ? (
          <Text style={styles.itemContentText} numberOfLines={2}>
            {item.content}
          </Text>
        ) : null}
        <View style={styles.itemBottom}>
          {item.order ? (
            <Pressable
              style={styles.orderChip}
              onPress={() => navigation.navigate('OrderDetail', { id: item.order!.id })}
              hitSlop={6}
            >
              <Icon name="link-variant" size={14} color={colors.primary} />
              <Text style={styles.orderChipText} numberOfLines={1}>
                {item.order.code}
                {item.order.customerName ? ` · ${item.order.customerName}` : ''}
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.unmatched}>Chưa khớp</Text>
          )}
          {item.gateway ? <Text style={styles.gateway}>{item.gateway}</Text> : null}
        </View>
      </CardContent>
    </Card>
  );

  return (
    <View style={styles.container}>
      {/* Chọn nhanh + khoảng ngày */}
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
      <View style={[styles.dateRow, isPhone && styles.dateRowPhone]}>
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
      <View style={styles.searchRow}>
        <Input
          placeholder="Tìm nội dung, tên người chuyển, mã đơn..."
          value={search}
          onChangeText={setSearch}
          scanCapture={false}
          leftIcon={<Icon name="magnify" size={20} color={colors.textMuted} />}
          rightIcon={
            search ? (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <Icon name="close" size={18} color={colors.textMuted} />
              </Pressable>
            ) : undefined
          }
        />
      </View>

      {/* Tổng kết */}
      <View style={styles.summaryWrap}>
        <Card>
          <CardContent style={styles.summaryContent}>
            <View style={styles.summaryIcon}>
              <Icon name="bank-transfer-in" size={24} color="#0d9488" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>Tổng tiền nhận</Text>
              <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {historyQuery.isLoading ? '—' : formatCurrency(summary?.total ?? 0)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.summaryLabel}>Số giao dịch</Text>
              <Text style={styles.summaryCount}>{historyQuery.isLoading ? '—' : summary?.count ?? 0}</Text>
            </View>
          </CardContent>
        </Card>
      </View>

      <FlatList
        data={items}
        keyExtractor={(t) => t.id}
        renderItem={renderItem}
        contentContainerStyle={{
          padding: isPhone ? spacing.md : spacing.lg,
          paddingTop: spacing.sm,
          gap: spacing.sm,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl
            refreshing={historyQuery.isRefetching && !historyQuery.isFetchingNextPage}
            onRefresh={() => historyQuery.refetch()}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          historyQuery.isLoading ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
          ) : historyQuery.isError ? (
            <EmptyState
              title="Không tải được lịch sử chuyển khoản"
              description={extractError(historyQuery.error).message}
            />
          ) : (
            <EmptyState
              title="Chưa có chuyển khoản"
              description="Không có giao dịch nào trong khoảng ngày đã chọn"
              icon={<Icon name="bank-off-outline" size={40} color={colors.textSubtle} />}
            />
          )
        }
        ListFooterComponent={
          historyQuery.isFetchingNextPage ? (
            <ActivityIndicator style={{ marginVertical: spacing.md }} color={colors.primary} />
          ) : null
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
  dateRow: {
    flexDirection: 'row', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm,
  },
  dateRowPhone: { flexWrap: 'wrap' },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    minWidth: 140,
    paddingHorizontal: spacing.md, height: 44,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
  },
  dateBtnText: { fontSize: 14, color: colors.text, fontWeight: '500', flexShrink: 1 },
  searchRow: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  summaryWrap: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  summaryContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  summaryIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: '#ccfbf1',
    alignItems: 'center', justifyContent: 'center',
  },
  summaryLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  summaryValue: { fontSize: 20, fontWeight: '800', color: colors.success },
  summaryCount: { fontSize: 20, fontWeight: '800', color: colors.text },
  itemContent: { padding: spacing.md, gap: 4 },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  itemTime: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  itemAmount: { fontSize: 17, fontWeight: '800', color: colors.success, flexShrink: 1 },
  itemName: { fontSize: 14, fontWeight: '700', color: colors.text },
  itemContentText: { fontSize: 13, color: colors.textMuted },
  itemBottom: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: spacing.sm, marginTop: 4,
  },
  orderChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1,
    paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 99,
    backgroundColor: colors.primaryLight,
  },
  orderChipText: { fontSize: 13, fontWeight: '700', color: colors.primary, flexShrink: 1 },
  unmatched: { fontSize: 13, color: colors.textSubtle, fontStyle: 'italic' },
  gateway: { fontSize: 12, color: colors.textSubtle },
});
