import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
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

const STATUS_FILTERS: { value: OrderStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'CREATED', label: ORDER_STATUS_LABEL.CREATED },
  { value: 'RECEIVED', label: ORDER_STATUS_LABEL.RECEIVED },
  { value: 'WASHING', label: ORDER_STATUS_LABEL.WASHING },
  { value: 'READY', label: ORDER_STATUS_LABEL.READY },
  { value: 'DELIVERED', label: ORDER_STATUS_LABEL.DELIVERED },
  { value: 'CANCELLED', label: ORDER_STATUS_LABEL.CANCELLED },
];

export function OrdersScreen() {
  const navigation = useNavigation<any>();
  const { canCreate } = usePermissions();
  const { isPhone } = useResponsive();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrderStatus | 'ALL'>('ALL');

  // Lightweight query just for the badge counts
  const countsQuery = useQuery({
    queryKey: ['orders', 'status-counts'],
    queryFn: () => orderApi.statusCounts(),
    staleTime: 30_000,
  });

  const counts = countsQuery.data ?? {};
  const totalAll = Object.values(counts).reduce((s, n) => s + n, 0);

  // Infinite-scroll query for the list
  const ordersQuery = useInfiniteQuery({
    queryKey: ['orders', { search, status }],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      orderApi.list({
        search: search || undefined,
        status: status === 'ALL' ? undefined : status,
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
        {canCreate && (
          <Button
            onPress={() => navigation.navigate('OrderCreate')}
            leftIcon={<Icon name="plus" size={20} color="#fff" />}
            style={isPhone ? { alignSelf: 'stretch' } : undefined}
          >
            Tạo đơn mới
          </Button>
        )}
      </View>

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
                  <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Text style={styles.code}>{item.code}</Text>
                    <OrderStatusBadge status={item.status} />
                  </View>
                  <Text style={styles.customer}>{item.customer?.name ?? '—'}</Text>
                  <Text style={styles.meta}>
                    {item.customer?.phone ?? ''} · {formatDateTime(item.createdAt)}
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
  code: { fontSize: 16, fontWeight: '700', color: colors.text },
  customer: { fontSize: 14, color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted },
  amount: { fontSize: 16, fontWeight: '700', color: colors.primary },
});
