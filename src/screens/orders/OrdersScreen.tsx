import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
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
  const [page, setPage] = useState(1);

  const ordersQuery = useQuery({
    queryKey: ['orders', { search, status, page }],
    queryFn: () =>
      orderApi.list({
        search: search || undefined,
        status: status === 'ALL' ? undefined : status,
        page,
        pageSize: 20,
      }),
  });

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
              onChangeText={(v) => { setSearch(v); setPage(1); }}
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
        {STATUS_FILTERS.map((f) => (
          <Pressable
            key={f.value}
            onPress={() => { setStatus(f.value); setPage(1); }}
            style={[styles.chip, status === f.value && styles.chipActive]}
          >
            <Text style={[styles.chipText, status === f.value && styles.chipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={ordersQuery.data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: isPhone ? spacing.md : spacing.lg, gap: spacing.sm }}
        refreshing={ordersQuery.isFetching}
        onRefresh={() => ordersQuery.refetch()}
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
      />

      {/* Pagination */}
      {(ordersQuery.data?.total ?? 0) > 20 && (
        <View style={styles.pagination}>
          <Button
            variant="outline"
            size="sm"
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Trước
          </Button>
          <Text style={{ color: colors.textMuted }}>
            Trang {page} / {Math.ceil((ordersQuery.data?.total ?? 0) / 20)}
          </Text>
          <Button
            variant="outline"
            size="sm"
            onPress={() => setPage((p) => p + 1)}
            disabled={page * 20 >= (ordersQuery.data?.total ?? 0)}
          >
            Sau
          </Button>
        </View>
      )}
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
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 99, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, padding: spacing.lg },
  rowPhone: { flexDirection: 'column', alignItems: 'stretch', padding: spacing.md },
  code: { fontSize: 16, fontWeight: '700', color: colors.text },
  customer: { fontSize: 14, color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted },
  amount: { fontSize: 16, fontWeight: '700', color: colors.primary },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.lg, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
});
