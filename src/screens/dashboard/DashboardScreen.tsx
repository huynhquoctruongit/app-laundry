import React, { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { OrderStatusBadge } from '@/components/common/OrderStatusBadge';
import { reportApi } from '@/api/report.api';
import { orderApi } from '@/api/order.api';
import { bankApi } from '@/api/bank.api';
import { useResponsive } from '@/hooks/useResponsive';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { formatCurrency, formatDateTime } from '@/lib/utils';

export function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { isPhone } = useResponsive();
  const [showFinancial, setShowFinancial] = useState(true);

  const dashboardQuery = useQuery({
    queryKey: ['report', 'dashboard'],
    queryFn: () => reportApi.dashboard(),
  });

  const ordersQuery = useQuery({
    queryKey: ['orders', 'recent'],
    queryFn: () => orderApi.list({ page: 1, pageSize: 10 }),
  });

  // Tiền chuyển khoản hôm nay (GPM Pay) — làm mới mỗi 30s cho gần real-time
  const bankQuery = useQuery({
    queryKey: ['bank', 'today'],
    queryFn: () => bankApi.today(),
    refetchInterval: 30_000,
  });

  const report = dashboardQuery.data;
  const transfers = bankQuery.data;

  const onRefresh = useCallback(() => {
    dashboardQuery.refetch();
    ordersQuery.refetch();
    bankQuery.refetch();
  }, [dashboardQuery, ordersQuery, bankQuery]);

  const isRefreshing =
    dashboardQuery.isFetching || ordersQuery.isFetching || bankQuery.isFetching;

  const stats = [
    { label: 'Doanh thu', value: report?.revenue ?? 0, isCurrency: true, icon: 'wallet', color: colors.primary, bg: colors.primaryLight },
    { label: 'Đã thu', value: report?.profit ?? 0, isCurrency: true, icon: 'cash-check', color: colors.success, bg: colors.successLight },
    { label: 'Chuyển khoản', value: transfers?.total ?? 0, isCurrency: true, icon: 'bank', color: '#0d9488', bg: '#ccfbf1' },
    { label: 'Đơn mới', value: report?.newOrders ?? 0, isCurrency: false, icon: 'clipboard-list', color: colors.warning, bg: colors.warningLight },
    { label: 'Đã giao', value: report?.deliveredOrders ?? 0, isCurrency: false, icon: 'package-variant', color: '#8b5cf6', bg: '#ede9fe' },
  ];

  const shortcuts: Array<{
    label: string; icon: string; color: string; bg: string;
    route?: string; drawer?: string; highlight?: boolean;
  }> = [
    { label: 'Tạo đơn', icon: 'plus-circle', route: 'OrderCreate', color: colors.primary, bg: colors.primaryLight, highlight: true },
    { label: 'Quét QR', icon: 'qrcode-scan', route: 'Scanner', color: '#0ea5e9', bg: '#dbeafe' },
    { label: 'Thu chi', icon: 'wallet', drawer: 'Finance', color: colors.success, bg: colors.successLight },
    { label: 'Kho hàng', icon: 'warehouse', drawer: 'Inventory', color: colors.warning, bg: colors.warningLight },
    { label: 'Báo cáo', icon: 'chart-bar', drawer: 'Reports', color: '#8b5cf6', bg: '#ede9fe' },
    { label: 'Khách', icon: 'account-group', drawer: 'Customers', color: '#ec4899', bg: '#fce7f3' },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        padding: isPhone ? spacing.md : spacing.xl,
        gap: spacing.lg,
      }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
    >
      {/* Stats */}
      <View style={styles.statsGrid}>
        {stats.map((s) => (
          <Card
            key={s.label}
            style={{
              flex: 1,
              minWidth: isPhone ? '46%' : 200,
            }}
          >
            <CardContent style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg }}>
              <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: s.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={s.icon} size={24} color={s.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statLabel}>{s.label}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text
                    style={[styles.statValue, { flexShrink: 1 }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.5}
                  >
                    {dashboardQuery.isLoading
                      ? '—'
                      : s.isCurrency && !showFinancial
                        ? '••••'
                        : s.isCurrency
                          ? formatCurrency(s.value)
                          : s.value}
                  </Text>
                  {s.isCurrency && (
                    <Pressable onPress={() => setShowFinancial((v) => !v)} hitSlop={8}>
                      <Icon name={showFinancial ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
                    </Pressable>
                  )}
                </View>
              </View>
            </CardContent>
          </Card>
        ))}
      </View>

      {/* Todo + Shortcuts */}
      <View
        style={{
          flexDirection: isPhone ? 'column' : 'row',
          gap: spacing.lg,
        }}
      >
        {/* Todo */}
        {report?.todoList && report.todoList.length > 0 && (
          <Card style={{ flex: 1 }}>
            <CardHeader>
              <CardTitle>Cần xử lý</CardTitle>
            </CardHeader>
            <CardContent style={{ gap: spacing.sm }}>
              {report.todoList.map((t, i) => (
                <View key={i} style={styles.todoItem}>
                  <Text style={{ color: '#92400e', fontSize: 14 }}>{t.label}</Text>
                  <View style={styles.todoBadge}>
                    <Text style={{ color: '#78350f', fontWeight: '700', fontSize: 12 }}>{t.count}</Text>
                  </View>
                </View>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Shortcuts */}
        <Card style={{ flex: 1 }}>
          <CardHeader>
            <CardTitle>Truy cập nhanh</CardTitle>
          </CardHeader>
          <CardContent>
            <View style={styles.shortcutsGrid}>
              {shortcuts.map((s) => (
                <Pressable
                  key={s.label}
                  style={[styles.shortcut, s.highlight && styles.shortcutHighlight]}
                  onPress={() =>
                    s.route
                      ? navigation.navigate(s.route)
                      : navigation.navigate(s.drawer)
                  }
                >
                  <View
                    style={[
                      styles.shortcutIcon,
                      { backgroundColor: s.highlight ? 'rgba(255,255,255,0.25)' : s.bg },
                    ]}
                  >
                    <Icon name={s.icon} size={22} color={s.highlight ? '#fff' : s.color} />
                  </View>
                  <Text style={[styles.shortcutLabel, s.highlight && styles.shortcutLabelHighlight]}>
                    {s.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </CardContent>
        </Card>
      </View>

      {/* Chuyển khoản gần đây (GPM Pay) */}
      <Card>
        <CardHeader style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <CardTitle>Chuyển khoản gần đây</CardTitle>
          <Icon name="bank" size={20} color="#0d9488" />
        </CardHeader>
        <CardContent style={{ gap: spacing.sm }}>
          {!transfers || transfers.items.length === 0 ? (
            <Text style={{ textAlign: 'center', color: colors.textMuted, padding: spacing.lg }}>
              Chưa có chuyển khoản hôm nay
            </Text>
          ) : (
            transfers.items.slice(0, 6).map((t) => (
              <View key={t.id} style={styles.transferItem}>
                <View style={{ flex: 1, marginRight: spacing.md }}>
                  <Text style={styles.transferContent} numberOfLines={1}>
                    {t.content || t.counterName || t.gateway || 'Chuyển khoản'}
                  </Text>
                  <Text style={styles.transferMeta}>{formatDateTime(t.transactionAt)}</Text>
                </View>
                <Text style={styles.transferAmount}>+{formatCurrency(t.amount)}</Text>
              </View>
            ))
          )}
        </CardContent>
      </Card>

      {/* Recent orders */}
      <Card>
        <CardHeader style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <CardTitle>Đơn hàng gần đây</CardTitle>
          <Button variant="ghost" size="sm" onPress={() => navigation.navigate('Orders')}>
            Xem tất cả
          </Button>
        </CardHeader>
        <CardContent style={{ gap: spacing.sm }}>
          {ordersQuery.data?.items.length === 0 && (
            <Text style={{ textAlign: 'center', color: colors.textMuted, padding: spacing.lg }}>Chưa có đơn nào</Text>
          )}
          {ordersQuery.data?.items.slice(0, 6).map((o) => (
            <Pressable
              key={o.id}
              style={[
                styles.orderRow,
                isPhone && {
                  flexDirection: 'column',
                  alignItems: 'stretch',
                },
              ]}
              onPress={() => navigation.navigate('OrderDetail', { id: o.id })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.orderCustomer}>{o.customer?.name ?? '—'}</Text>
                <Text style={styles.orderMeta}>{o.code} · {formatDateTime(o.createdAt)}</Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: isPhone ? 'space-between' : 'flex-start',
                  gap: spacing.md,
                }}
              >
                <Text style={styles.orderAmount}>{formatCurrency(o.totalAmount)}</Text>
                <OrderStatusBadge status={o.status} />
              </View>
            </Pressable>
          ))}
        </CardContent>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  statLabel: { fontSize: 13, color: colors.textMuted },
  statValue: { fontSize: 22, fontWeight: '700', color: colors.text },
  todoItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fef3c7', padding: spacing.md, borderRadius: radius.md },
  todoBadge: { backgroundColor: '#fde68a', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 99 },
  shortcutsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  shortcut: { width: '31%', alignItems: 'center', gap: 6, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  shortcutHighlight: { backgroundColor: colors.primary, borderColor: colors.primary },
  shortcutIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  shortcutLabel: { fontSize: 12, fontWeight: '600', color: colors.text, textAlign: 'center' },
  shortcutLabelHighlight: { color: '#fff', fontWeight: '800' },
  transferItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ccfbf1', padding: spacing.md, borderRadius: radius.md },
  transferContent: { fontSize: 13, color: '#115e59' },
  transferMeta: { fontSize: 11, color: '#0d9488', marginTop: 2 },
  transferAmount: { fontSize: 14, fontWeight: '700', color: '#0f766e' },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  orderCustomer: { fontSize: 16, fontWeight: '700', color: colors.text },
  orderMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  orderAmount: { fontSize: 14, fontWeight: '600', color: colors.text },
});
