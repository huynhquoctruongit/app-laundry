import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { OrderStatusBadge } from '@/components/common/OrderStatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { orderApi } from '@/api/order.api';
import { usePermissions } from '@/hooks/usePermissions';
import { useResponsive } from '@/hooks/useResponsive';
import { ORDER_STATUS_LABEL, OrderStatus } from '@/helpers/enums/order-status';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { formatCurrency, formatDateTime } from '@/lib/utils';

const PAGE_SIZE = 20;

const fmtDay = (d: Date) =>
  d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });

const STATUS_FILTERS: { value: OrderStatus | 'ALL' | 'BOOKING'; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'BOOKING', label: 'Đơn đặt' },
  { value: 'CREATED', label: ORDER_STATUS_LABEL.CREATED },
  { value: 'RECEIVED', label: ORDER_STATUS_LABEL.RECEIVED },
  { value: 'WASHING', label: ORDER_STATUS_LABEL.WASHING },
  { value: 'READY', label: ORDER_STATUS_LABEL.READY },
  { value: 'DELIVERED', label: ORDER_STATUS_LABEL.DELIVERED },
  { value: 'CANCELLED', label: ORDER_STATUS_LABEL.CANCELLED },
];

export function OrdersScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { canCreateOrder } = usePermissions();
  const { isPhone } = useResponsive();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrderStatus | 'ALL' | 'BOOKING'>('ALL');

  // Lọc theo ngày — mặc định Hôm nay
  const [dateMode, setDateMode] = useState<'today' | 'yesterday' | 'custom'>('today');
  const [customDate, setCustomDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const selectedDate = useMemo(() => {
    if (dateMode === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d;
    }
    if (dateMode === 'custom') return customDate;
    return new Date();
  }, [dateMode, customDate]);

  const { dateFrom, dateTo } = useMemo(() => {
    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(selectedDate);
    end.setHours(23, 59, 59, 999);
    return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
  }, [selectedDate]);

  // Lightweight query just for the badge counts
  const countsQuery = useQuery({
    queryKey: ['orders', 'status-counts', { dateFrom, dateTo }],
    queryFn: () => orderApi.statusCounts({ dateFrom, dateTo }),
    staleTime: 30_000,
  });

  const counts = countsQuery.data ?? {};
  // "Tất cả" = số đơn tạo trong ngày (BE trả key ALL theo ngày được chọn)
  const totalAll = counts.ALL ?? 0;

  // Infinite-scroll query for the list
  const ordersQuery = useInfiniteQuery({
    queryKey: ['orders', { search, status, dateFrom, dateTo }],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      orderApi.list({
        search: search || undefined,
        status: status === 'ALL' || status === 'BOOKING' ? undefined : status,
        fromBooking: status === 'BOOKING' ? true : undefined,
        // BE bỏ qua lọc ngày khi đang search (tìm xuyên suốt mọi ngày)
        dateFrom,
        dateTo,
        page: pageParam as number,
        pageSize: PAGE_SIZE,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      return loaded < lastPage.total ? allPages.length + 1 : undefined;
    },
  });

  const items = ordersQuery.data?.pages.flatMap((p) => p.items) ?? [];

  const handleRefresh = () => {
    ordersQuery.refetch();
    countsQuery.refetch();
  };

  // Mỗi lần màn được focus (vd quay lại sau khi chuyển đơn/đổi trạng thái) → làm mới
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }, [queryClient]),
  );

  const handleEndReached = () => {
    if (ordersQuery.hasNextPage && !ordersQuery.isFetchingNextPage) {
      ordersQuery.fetchNextPage();
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, isPhone && styles.headerPhone]}>
        <View
          style={{
            flex: isPhone ? undefined : 1,
            flexDirection: 'row',
            gap: spacing.md,
            alignItems: 'center',
            alignSelf: 'stretch',
          }}
        >
          <View style={{ flex: 1, maxWidth: isPhone ? undefined : 320 }}>
            <Input
              placeholder="Tìm mã đơn, tên KH, SĐT..."
              value={search}
              onChangeText={(v) => setSearch(v)}
              leftIcon={<Icon name="magnify" size={20} color={colors.textMuted} />}
            />
          </View>
        </View>
        {canCreateOrder && (
          <Button
            onPress={() => navigation.navigate('OrderCreate')}
            leftIcon={<Icon name="plus" size={20} color="#fff" />}
            style={isPhone ? { alignSelf: 'stretch' } : undefined}
          >
            Tạo đơn mới
          </Button>
        )}
      </View>

      {/* Date filter — mặc định Hôm nay */}
      <View style={styles.dateRow}>
        <Pressable
          onPress={() => setDateMode('today')}
          style={[styles.dateChip, dateMode === 'today' && styles.dateChipActive]}
        >
          <Text style={[styles.dateChipText, dateMode === 'today' && styles.dateChipTextActive]}>
            Hôm nay
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setDateMode('yesterday')}
          style={[styles.dateChip, dateMode === 'yesterday' && styles.dateChipActive]}
        >
          <Text style={[styles.dateChipText, dateMode === 'yesterday' && styles.dateChipTextActive]}>
            Hôm qua
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setShowDatePicker(true)}
          style={[styles.dateChip, dateMode === 'custom' && styles.dateChipActive]}
        >
          <Icon name="calendar" size={15} color={dateMode === 'custom' ? '#fff' : colors.textMuted} />
          <Text style={[styles.dateChipText, dateMode === 'custom' && styles.dateChipTextActive]}>
            {dateMode === 'custom' ? fmtDay(customDate) : 'Chọn ngày'}
          </Text>
        </Pressable>
      </View>
      {showDatePicker && (
        <DateTimePicker
          value={dateMode === 'custom' ? customDate : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          onChange={(_, d) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (d) {
              setCustomDate(d);
              setDateMode('custom');
            }
          }}
        />
      )}

      {/* Status filter chips */}
      <View style={styles.chipRow}>
        {STATUS_FILTERS.map((f) => {
          const count = f.value === 'ALL' ? totalAll : (counts[f.value] ?? 0);
          const isActive = status === f.value;
          return (
            <Pressable
              key={f.value}
              onPress={() => setStatus(f.value)}
              style={[styles.chip, isActive && styles.chipActive]}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {f.label}
              </Text>
              {count > 0 && (
                <View style={[styles.badge, isActive && styles.badgeActive]}>
                  <Text style={[styles.badgeText, isActive && styles.badgeTextActive]}>
                    {count}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* List */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: isPhone ? spacing.md : spacing.lg, gap: spacing.sm }}
        refreshing={ordersQuery.isRefetching && !ordersQuery.isFetchingNextPage}
        onRefresh={handleRefresh}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('OrderDetail', { id: item.id })}>
            <Card>
              <CardContent style={isPhone ? StyleSheet.flatten([styles.row, styles.rowPhone]) : styles.row}>
                <View style={{ flex: isPhone ? undefined : 1, gap: 4 }}>
                  {/* Tên khách = thông tin chính (to + đậm nhất) */}
                  <Text style={styles.customer}>{item.customer?.name ?? '—'}</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                    <OrderStatusBadge status={item.status} />
                    {item.fromBooking && (
                      <View style={styles.shipBadge}>
                        <Text style={styles.shipBadgeText}>SHIPPING</Text>
                      </View>
                    )}
                    {/* Mã đơn = phụ (nhỏ, mờ) */}
                    <Text style={styles.code}>{item.code}</Text>
                  </View>
                  <Text style={styles.meta}>
                    {item.customer?.phone ? `${item.customer.phone} · ` : ''}
                    {item.status === 'DELIVERED' && item.deliveredAt
                      ? `Giao ${formatDateTime(item.deliveredAt)}`
                      : formatDateTime(item.createdAt)}
                  </Text>
                </View>
                <Text style={[styles.amount, isPhone && { alignSelf: 'flex-end' }]}>
                  {formatCurrency(item.totalAmount)}
                </Text>
              </CardContent>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={
          !ordersQuery.isLoading ? <EmptyState title="Không có đơn nào" /> : null
        }
        ListFooterComponent={
          ordersQuery.isFetchingNextPage ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={{ paddingVertical: spacing.lg }}
            />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.lg, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerPhone: {
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: spacing.md,
  },
  dateRow: { flexDirection: 'row', gap: 6, paddingHorizontal: spacing.md, paddingTop: spacing.md, backgroundColor: colors.card, alignItems: 'center' },
  dateChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 99, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  dateChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dateChipText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  dateChipTextActive: { color: '#fff' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: spacing.md, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 99, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  badgeTextActive: { color: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, padding: spacing.lg },
  rowPhone: { flexDirection: 'column', alignItems: 'stretch', padding: spacing.md },
  code: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  customer: { fontSize: 18, fontWeight: '800', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted },
  amount: { fontSize: 16, fontWeight: '700', color: colors.primary },
  shipBadge: {
    backgroundColor: '#000',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  shipBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
});
