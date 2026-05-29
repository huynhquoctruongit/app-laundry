import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { BookingStatusBadge } from '@/components/common/BookingStatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { bookingApi } from '@/api/booking.api';
import {
  BOOKING_STATUS_LABEL,
  type BookingStatus,
} from '@/helpers/enums/booking-status';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { formatDateTime } from '@/lib/utils';

const STATUS_FILTERS: { value: BookingStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'PENDING', label: BOOKING_STATUS_LABEL.PENDING },
  { value: 'CONFIRMED', label: BOOKING_STATUS_LABEL.CONFIRMED },
  { value: 'CONVERTED', label: BOOKING_STATUS_LABEL.CONVERTED },
  { value: 'CANCELLED', label: BOOKING_STATUS_LABEL.CANCELLED },
];

export function BookingsScreen() {
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<BookingStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);

  const bookingsQuery = useQuery({
    queryKey: ['bookings', { search, status, page }],
    queryFn: () =>
      bookingApi.list({
        search: search || undefined,
        status: status === 'ALL' ? undefined : status,
        page,
        pageSize: 20,
      }),
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <View style={{ flex: 1, maxWidth: 360 }}>
            <Input
              placeholder="Tìm mã đặt lịch, tên KH, SĐT, địa chỉ..."
              value={search}
              onChangeText={(v) => { setSearch(v); setPage(1); }}
              leftIcon={<Icon name="magnify" size={20} color={colors.textMuted} />}
            />
          </View>
        </View>
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
        data={bookingsQuery.data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        refreshing={bookingsQuery.isFetching}
        onRefresh={() => bookingsQuery.refetch()}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('BookingDetail', { id: item.id })}>
            <Card>
              <CardContent style={styles.row}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                    <Text style={styles.code}>{item.code}</Text>
                    <BookingStatusBadge status={item.status} />
                  </View>
                  <Text style={styles.customer}>{item.customer?.name ?? '—'}</Text>
                  <Text style={styles.meta}>
                    {item.phone} · {formatDateTime(item.createdAt)}
                  </Text>
                  {item.address ? (
                    <Text style={styles.address} numberOfLines={1}>
                      <Icon name="map-marker" size={12} color={colors.textMuted} /> {item.address}
                    </Text>
                  ) : null}
                  {item.sourceOrder ? (
                    <Text style={styles.meta}>Từ đơn: {item.sourceOrder.code}</Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={styles.pickupLabel}>Hẹn lấy</Text>
                  <Text style={styles.pickup}>{formatDateTime(item.pickupAt)}</Text>
                </View>
              </CardContent>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={
          !bookingsQuery.isLoading ? (
            <EmptyState
              title="Chưa có yêu cầu đặt lịch"
              description="Khi khách quét QR trên hoá đơn và bấm đặt lại, yêu cầu sẽ hiển thị ở đây."
            />
          ) : null
        }
      />

      {/* Pagination */}
      {(bookingsQuery.data?.total ?? 0) > 20 && (
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
            Trang {page} / {Math.ceil((bookingsQuery.data?.total ?? 0) / 20)}
          </Text>
          <Button
            variant="outline"
            size="sm"
            onPress={() => setPage((p) => p + 1)}
            disabled={page * 20 >= (bookingsQuery.data?.total ?? 0)}
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: spacing.md, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 99, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, padding: spacing.lg },
  code: { fontSize: 16, fontWeight: '700', color: colors.primary },
  customer: { fontSize: 14, color: colors.text, fontWeight: '600' },
  meta: { fontSize: 12, color: colors.textMuted },
  address: { fontSize: 12, color: colors.textMuted },
  pickupLabel: { fontSize: 11, color: colors.textMuted },
  pickup: { fontSize: 13, fontWeight: '600', color: colors.text },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.lg, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
});
