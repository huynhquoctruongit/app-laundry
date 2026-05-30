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

  const report = dashboardQuery.data;

  const onRefresh = useCallback(() => {
    dashboardQuery.refetch();
    ordersQuery.refetch();
  }, [dashboardQuery, ordersQuery]);

  const isRefreshing = dashboardQuery.isFetching || ordersQuery.isFetching;

  const stats = [
    { label: 'Doanh thu', value: report?.revenue ?? 0, isCurrency: true, icon: 'wallet', color: colors.primary, bg: colors.primaryLight },
    { label: 'Lợi nhuận', value: report?.profit ?? 0, isCurrency: true, icon: 'trending-up', color: colors.success, bg: colors.successLight },
    { label: 'Đơn mới', value: report?.newOrders ?? 0, isCurrency: false, icon: 'clipboard-list', color: colors.warning, bg: colors.warningLight },
    { label: 'Đã giao', value: report?.deliveredOrders ?? 0, isCurrency: false, icon: 'package-variant', color: '#8b5cf6', bg: '#ede9fe' },
  ];

  const shortcuts = [
    { label: 'Tạo đơn', icon: 'plus-circle', route: 'OrderCreate', color: colors.primary, bg: colors.primaryLight },
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
      {/* Quick create button — nổi bật */}
      <Pressable
        onPress={() => navigation.navigate('OrderCreate')}
        style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.85 }]}
      >
        <Icon name="plus-circle" size={28} color="#fff" />
        <Text style={styles.createBtnText}>Tạo đơn mới</Text>
      </Pressable>

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
                  <Text style={styles.statValue}>
                    {dashboardQuery.isLoading
                      ? '—'
                      : s.isCurrency && !showFinancial
                        ? '••••'
                        : s.isCurrency
                          ? formatCurrency(s.value)
                          : s.value}
                  </Text>
                  {s.isCurrency && (
                    <Pressable onPress={() => setShowFinancial((v) => !v)}>
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
                  style={styles.shortcut}
                  onPress={() =>
                    s.route
                      ? navigation.navigate(s.route)
                      : navigation.navigate(s.drawer)
                  }
                >
                  <View style={[styles.shortcutIcon, { backgroundColor: s.bg }]}>
                    <Icon name={s.icon} size={22} color={s.color} />
                  </View>
                  <Text style={styles.shortcutLabel}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
          </CardContent>
        </Card>
      </View>

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
              <View>
                <Text style={styles.orderCode}>{o.code}</Text>
                <Text style={styles.orderMeta}>{o.customer?.name} · {formatDateTime(o.createdAt)}</Text>
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
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  createBtnText: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  statLabel: { fontSize: 13, color: colors.textMuted },
  statValue: { fontSize: 22, fontWeight: '700', color: colors.text },
  todoItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fef3c7', padding: spacing.md, borderRadius: radius.md },
  todoBadge: { backgroundColor: '#fde68a', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 99 },
  shortcutsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  shortcut: { width: '31%', alignItems: 'center', gap: 6, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  shortcutIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  shortcutLabel: { fontSize: 12, fontWeight: '600', color: colors.text, textAlign: 'center' },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  orderCode: { fontSize: 14, fontWeight: '700', color: colors.text },
  orderMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  orderAmount: { fontSize: 14, fontWeight: '600', color: colors.text },
});
