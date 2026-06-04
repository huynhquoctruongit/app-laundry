import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { reportApi } from '@/api/report.api';
import { customerApi } from '@/api/customer.api';
import { useResponsive } from '@/hooks/useResponsive';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';

type ReportTab = 'financial' | 'sales' | 'customers' | 'inventory';
type DatePreset = 'today' | 'week' | 'month' | 'lastMonth' | 'custom';

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function ReportsScreen() {
  const { isPhone } = useResponsive();
  const [tab, setTab] = useState<ReportTab>('financial');
  const [from, setFrom] = useState<Date>(startOfMonth());
  const [to, setTo] = useState<Date>(new Date());
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [preset, setPreset] = useState<DatePreset>('month'); // mặc định "Tháng này"

  function applyPreset(p: Exclude<DatePreset, 'custom'>) {
    const now = new Date();
    let f: Date;
    let t: Date = now;
    if (p === 'today') {
      f = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (p === 'week') {
      const dow = (now.getDay() + 6) % 7; // Thứ 2 = 0
      f = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
    } else if (p === 'month') {
      f = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      // Tháng trước: ngày 1 → ngày cuối tháng trước
      f = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      t = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    }
    setFrom(f);
    setTo(t);
    setPreset(p);
  }

  const params = useMemo(
    () => ({ from: from.toISOString(), to: to.toISOString() }),
    [from, to],
  );

  const financialQuery = useQuery({
    queryKey: ['report', 'financial', params],
    queryFn: () => reportApi.financial(params),
    enabled: tab === 'financial',
  });

  const salesQuery = useQuery({
    queryKey: ['report', 'sales', params],
    queryFn: () => reportApi.sales(params),
    enabled: tab === 'sales',
  });

  const inventoryQuery = useQuery({
    queryKey: ['report', 'inventory'],
    queryFn: () => reportApi.inventory(),
    enabled: tab === 'inventory',
  });

  const topCustomersQuery = useQuery({
    queryKey: ['customers', 'top', params],
    queryFn: () =>
      customerApi.top({ from: params.from, to: params.to, limit: 30 }),
    enabled: tab === 'customers',
  });

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={[styles.tabs, isPhone && styles.tabsPhone]}>
        {(
          [
            { value: 'financial', label: 'Tài chính', icon: 'wallet' },
            { value: 'sales', label: 'Bán hàng', icon: 'cart' },
            { value: 'customers', label: 'Khách hàng', icon: 'account-group' },
            { value: 'inventory', label: 'Kho hàng', icon: 'warehouse' },
          ] as { value: ReportTab; label: string; icon: string }[]
        ).map((t) => (
          <Pressable
            key={t.value}
            style={[styles.tab, isPhone && styles.tabPhone, tab === t.value && styles.tabActive]}
            onPress={() => setTab(t.value)}
          >
            <Icon name={t.icon} size={18} color={tab === t.value ? colors.primary : colors.textMuted} />
            <Text style={[styles.tabText, tab === t.value && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Chọn nhanh + khoảng ngày — ẩn ở tab kho hàng */}
      {tab !== 'inventory' && (
        <View>
          <View style={styles.presetRow}>
            {(
              [
                { v: 'today', label: 'Hôm nay' },
                { v: 'week', label: 'Tuần này' },
                { v: 'month', label: 'Tháng này' },
                { v: 'lastMonth', label: 'Tháng trước' },
              ] as { v: Exclude<DatePreset, 'custom'>; label: string }[]
            ).map((p) => (
              <Pressable
                key={p.v}
                onPress={() => applyPreset(p.v)}
                style={[styles.presetChip, preset === p.v && styles.presetChipActive]}
              >
                <Text style={[styles.presetChipText, preset === p.v && styles.presetChipTextActive]}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={[styles.dateRow, isPhone && styles.dateRowPhone]}>
            <Pressable style={styles.dateBtn} onPress={() => setShowFromPicker(true)}>
              <Icon name="calendar" size={18} color={colors.textMuted} />
              <Text style={styles.dateBtnText}>Từ: {formatDate(from)}</Text>
            </Pressable>
            <Pressable style={styles.dateBtn} onPress={() => setShowToPicker(true)}>
              <Icon name="calendar" size={18} color={colors.textMuted} />
              <Text style={styles.dateBtnText}>Đến: {formatDate(to)}</Text>
            </Pressable>
            {showFromPicker && (
              <DateTimePicker
                value={from}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, d) => {
                  setShowFromPicker(Platform.OS === 'ios');
                  if (d) {
                    setFrom(d);
                    setPreset('custom');
                  }
                }}
              />
            )}
            {showToPicker && (
              <DateTimePicker
                value={to}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, d) => {
                  setShowToPicker(Platform.OS === 'ios');
                  if (d) {
                    setTo(d);
                    setPreset('custom');
                  }
                }}
              />
            )}
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: isPhone ? spacing.md : spacing.lg, gap: spacing.lg }}>
        {tab === 'financial' && (
          <>
            <View style={styles.cardsRow}>
              <StatCard
                label="Doanh thu"
                value={formatCurrency(financialQuery.data?.revenue ?? 0)}
                icon="trending-up"
                color={colors.success}
                bg={colors.successLight}
              />
              <StatCard
                label="Chi phí"
                value={formatCurrency(financialQuery.data?.expenses ?? 0)}
                icon="trending-down"
                color={colors.danger}
                bg={colors.dangerLight}
              />
              <StatCard
                label="Lợi nhuận"
                value={formatCurrency(financialQuery.data?.profit ?? 0)}
                icon="wallet"
                color={colors.primary}
                bg={colors.primaryLight}
              />
            </View>

            <Card>
              <CardHeader><CardTitle>Doanh thu theo danh mục</CardTitle></CardHeader>
              <CardContent>
                <CategoryList data={financialQuery.data?.incomeByCategory ?? {}} color={colors.success} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Chi phí theo danh mục</CardTitle></CardHeader>
              <CardContent>
                <CategoryList data={financialQuery.data?.expenseByCategory ?? {}} color={colors.danger} />
              </CardContent>
            </Card>
          </>
        )}

        {tab === 'sales' && (
          <>
            <View style={styles.cardsRow}>
              <StatCard
                label="Số đơn"
                value={String(salesQuery.data?.totalOrders ?? 0)}
                icon="package-variant"
                color={colors.primary}
                bg={colors.primaryLight}
              />
              <StatCard
                label="Doanh thu"
                value={formatCurrency(salesQuery.data?.totalRevenue ?? 0)}
                icon="trending-up"
                color={colors.success}
                bg={colors.successLight}
              />
              <StatCard
                label="TB / đơn"
                value={formatCurrency(salesQuery.data?.avgOrderValue ?? 0)}
                icon="chart-line"
                color={colors.warning}
                bg={colors.warningLight}
              />
            </View>

            <Card>
              <CardHeader><CardTitle>Dịch vụ bán chạy</CardTitle></CardHeader>
              <CardContent style={{ gap: spacing.sm }}>
                {(salesQuery.data?.topProducts ?? []).length === 0 ? (
                  <Text style={{ color: colors.textMuted }}>Chưa có dữ liệu</Text>
                ) : (
                  (salesQuery.data?.topProducts ?? []).map((p, i) => (
                    <View key={p.name + i} style={[styles.listRow, isPhone && styles.listRowPhone]}>
                      <View style={styles.rank}>
                        <Text style={styles.rankText}>{i + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listName}>{p.name}</Text>
                        <Text style={styles.listMeta}>SL: {p.quantity}</Text>
                      </View>
                      <Text style={[styles.listAmount, isPhone && { alignSelf: 'flex-end' }]}>
                        {formatCurrency(p.revenue)}
                      </Text>
                    </View>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Đơn theo trạng thái</CardTitle></CardHeader>
              <CardContent>
                <CategoryList
                  data={(salesQuery.data?.ordersByStatus ?? {}) as Record<string, number>}
                  color={colors.primary}
                  isCurrency={false}
                />
              </CardContent>
            </Card>
          </>
        )}

        {tab === 'customers' && (
          <>
            <View style={styles.cardsRow}>
              <StatCard
                label="Số khách"
                value={String(topCustomersQuery.data?.length ?? 0)}
                icon="account-group"
                color={colors.primary}
                bg={colors.primaryLight}
              />
              <StatCard
                label="Tổng chi"
                value={formatCurrency(
                  (topCustomersQuery.data ?? []).reduce(
                    (s, c) => s + c.totalSpent,
                    0,
                  ),
                )}
                icon="cash-multiple"
                color={colors.success}
                bg={colors.successLight}
              />
              <StatCard
                label="Tổng đơn"
                value={String(
                  (topCustomersQuery.data ?? []).reduce(
                    (s, c) => s + c.orderCount,
                    0,
                  ),
                )}
                icon="package-variant"
                color={colors.warning}
                bg={colors.warningLight}
              />
            </View>

            <Card>
              <CardHeader>
                <CardTitle>Top khách chi tiêu nhiều nhất</CardTitle>
              </CardHeader>
              <CardContent style={{ gap: spacing.sm }}>
                {(topCustomersQuery.data ?? []).length === 0 ? (
                  <Text style={{ color: colors.textMuted }}>Chưa có dữ liệu</Text>
                ) : (
                  (topCustomersQuery.data ?? []).map((c, i) => (
                    <View key={c.customer.id} style={[styles.customerRow, isPhone && styles.listRowPhone]}>
                      <View style={styles.rank}>
                        <Text style={styles.rankText}>{i + 1}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listName}>{c.customer.name}</Text>
                        <Text style={styles.listMeta}>
                          {c.customer.phone} · {c.orderCount} đơn ·{' '}
                          {c.frequencyLabel}
                          {c.daysSinceLastOrder !== null
                            ? ` · ${c.daysSinceLastOrder} ngày trước`
                            : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: isPhone ? 'stretch' : 'flex-end' }}>
                        <Text style={styles.listAmount}>
                          {formatCurrency(c.totalSpent)}
                        </Text>
                        <Text style={styles.listMeta}>
                          TB {formatCurrency(c.avgOrderValue)}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}

        {tab === 'inventory' && (
          <>
            <View style={styles.cardsRow}>
              <StatCard
                label="Tổng mặt hàng"
                value={String(inventoryQuery.data?.totalItems ?? 0)}
                icon="package-variant"
                color={colors.primary}
                bg={colors.primaryLight}
              />
              <StatCard
                label="Sắp hết"
                value={String(inventoryQuery.data?.lowStockItems ?? 0)}
                icon="alert"
                color={colors.danger}
                bg={colors.dangerLight}
              />
            </View>

            <Card>
              <CardHeader><CardTitle>Phiếu nhập gần đây</CardTitle></CardHeader>
              <CardContent style={{ gap: spacing.sm }}>
                {(inventoryQuery.data?.recentImports ?? []).length === 0 ? (
                  <Text style={{ color: colors.textMuted }}>Chưa có phiếu nhập</Text>
                ) : (
                  (inventoryQuery.data?.recentImports ?? []).map((r, i) => (
                    <View key={i} style={[styles.listRow, isPhone && styles.listRowPhone]}>
                      <Badge bg={colors.successLight} fg={colors.success}>Nhập</Badge>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listName}>{r.itemName}</Text>
                        <Text style={styles.listMeta}>{formatDateTime(r.date)}</Text>
                      </View>
                      <Text style={[styles.listAmount, isPhone && { alignSelf: 'flex-end' }]}>+{r.quantity}</Text>
                    </View>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Phiếu xuất gần đây</CardTitle></CardHeader>
              <CardContent style={{ gap: spacing.sm }}>
                {(inventoryQuery.data?.recentExports ?? []).length === 0 ? (
                  <Text style={{ color: colors.textMuted }}>Chưa có phiếu xuất</Text>
                ) : (
                  (inventoryQuery.data?.recentExports ?? []).map((r, i) => (
                    <View key={i} style={[styles.listRow, isPhone && styles.listRowPhone]}>
                      <Badge bg={colors.warningLight} fg={colors.warning}>Xuất</Badge>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listName}>{r.itemName}</Text>
                        <Text style={styles.listMeta}>{formatDateTime(r.date)}</Text>
                      </View>
                      <Text style={[styles.listAmount, isPhone && { alignSelf: 'flex-end' }]}>-{r.quantity}</Text>
                    </View>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  bg,
}: { label: string; value: string; icon: string; color: string; bg: string }) {
  const { isPhone } = useResponsive();
  return (
    <Card style={{ flex: 1, minWidth: isPhone ? '100%' : 200 }}>
      <CardContent style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg }}>
        <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={24} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, color: colors.textMuted }}>{label}</Text>
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>{value}</Text>
        </View>
      </CardContent>
    </Card>
  );
}

function CategoryList({
  data,
  color,
  isCurrency = true,
}: { data: Record<string, number>; color: string; isCurrency?: boolean }) {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return <Text style={{ color: colors.textMuted }}>Chưa có dữ liệu</Text>;
  }
  return (
    <View style={{ gap: spacing.sm }}>
      {entries.map(([k, v]) => (
        <View key={k} style={styles.catRow}>
          <View style={[styles.catDot, { backgroundColor: color }]} />
          <Text style={styles.catName}>{k}</Text>
          <Text style={[styles.catValue, { color }]}>
            {isCurrency ? formatCurrency(v) : v}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabsPhone: {
    flexWrap: 'wrap',
  },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabPhone: {
    width: '50%',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.primary },
  presetRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
  },
  presetChip: {
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 99,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  presetChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  presetChipText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  presetChipTextActive: { color: '#fff' },
  dateRow: {
    flexDirection: 'row', gap: spacing.md,
    padding: spacing.lg, paddingBottom: 0,
  },
  dateRowPhone: {
    flexDirection: 'column',
    padding: spacing.md,
    paddingBottom: 0,
  },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, height: 44,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
  },
  dateBtnText: { fontSize: 14, color: colors.text, fontWeight: '500' },
  cardsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  catRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catName: { flex: 1, fontSize: 14, color: colors.text },
  catValue: { fontSize: 14, fontWeight: '700' },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderRadius: radius.md, backgroundColor: colors.background,
  },
  listRowPhone: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  customerRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    borderRadius: radius.md, backgroundColor: colors.background,
  },
  rank: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  rankText: { fontWeight: '700', color: colors.primary },
  listName: { fontSize: 14, fontWeight: '600', color: colors.text },
  listMeta: { fontSize: 12, color: colors.textMuted },
  listAmount: { fontSize: 14, fontWeight: '700', color: colors.text },
});
