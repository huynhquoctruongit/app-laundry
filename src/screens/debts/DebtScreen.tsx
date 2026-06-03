import React from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { orderApi } from '@/api/order.api';
import { extractError } from '@/api/client';
import { useResponsive } from '@/hooks/useResponsive';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { Order } from '@/types/api';

export function DebtScreen() {
  const navigation = useNavigation<any>();
  const { isPhone } = useResponsive();
  const queryClient = useQueryClient();

  const debtQuery = useQuery({
    queryKey: ['orders', 'debt'],
    queryFn: () => orderApi.list({ debt: true, pageSize: 200 }),
  });

  const items = debtQuery.data?.items ?? [];
  const totalDebt = items.reduce((sum, o) => sum + Number(o.totalAmount), 0);

  const payMutation = useMutation({
    mutationFn: (id: string) => orderApi.setPayment(id, true),
    onSuccess: (order) => {
      Toast.show({ type: 'success', text1: `Đã thu tiền đơn ${order.code}` });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['report'] });
      queryClient.invalidateQueries({ queryKey: ['order', order.id] });
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  function confirmPay(o: Order) {
    Alert.alert(
      'Xác nhận đã thanh toán',
      `Khách "${o.customer?.name ?? '—'}" đã trả ${formatCurrency(o.totalAmount)} cho đơn ${o.code}?\nTiền sẽ được cộng vào lợi nhuận.`,
      [
        { text: 'Huỷ', style: 'cancel' },
        { text: 'Đã thanh toán', onPress: () => payMutation.mutate(o.id) },
      ],
    );
  }

  return (
    <View style={styles.container}>
      {/* Tổng đang nợ */}
      <View style={styles.summary}>
        <View>
          <Text style={styles.summaryLabel}>Tổng tiền đang nợ</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalDebt)}</Text>
        </View>
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryCount}>{items.length}</Text>
          <Text style={styles.summaryCountLabel}>đơn</Text>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: isPhone ? spacing.md : spacing.lg, gap: spacing.sm }}
        refreshing={debtQuery.isFetching}
        onRefresh={() => debtQuery.refetch()}
        renderItem={({ item }) => (
          <Card>
            <CardContent style={{ gap: spacing.sm, padding: spacing.lg }}>
              <Pressable
                onPress={() => navigation.navigate('OrderDetail', { id: item.id })}
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.customer}>{item.customer?.name ?? '—'}</Text>
                  {!!item.customer?.phone && (
                    <Text style={styles.meta}>{item.customer.phone}</Text>
                  )}
                  <Text style={styles.meta}>
                    {item.code} · giao {formatDateTime(item.deliveredAt ?? item.createdAt)}
                  </Text>
                </View>
                <Text style={styles.amount}>{formatCurrency(item.totalAmount)}</Text>
              </Pressable>
              <Button
                onPress={() => confirmPay(item)}
                loading={payMutation.isPending && payMutation.variables === item.id}
                leftIcon={<Icon name="cash-check" size={20} color="#fff" />}
                fullWidth
              >
                Đã thanh toán
              </Button>
            </CardContent>
          </Card>
        )}
        ListEmptyComponent={
          !debtQuery.isLoading ? (
            <EmptyState
              title="Không có đơn nợ"
              description="Tất cả đơn đã thu tiền 🎉"
              icon={<Icon name="cash-check" size={48} color={colors.textMuted} />}
            />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryLabel: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  summaryValue: { fontSize: 24, fontWeight: '800', color: colors.danger, marginTop: 2 },
  summaryBadge: {
    alignItems: 'center',
    backgroundColor: colors.dangerLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  summaryCount: { fontSize: 22, fontWeight: '800', color: colors.danger },
  summaryCountLabel: { fontSize: 11, color: colors.danger, fontWeight: '600' },
  customer: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  amount: { fontSize: 17, fontWeight: '800', color: colors.danger },
});
