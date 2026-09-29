import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { reportApi, type ServiceStat } from '@/api/report.api';
import { useResponsive } from '@/hooks/useResponsive';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { formatCurrency, formatDate } from '@/lib/utils';

type SortKey = 'revenue' | 'orderCount' | 'customerCount';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'revenue', label: 'Doanh thu' },
  { key: 'orderCount', label: 'Số đơn' },
  { key: 'customerCount', label: 'Số khách' },
];

const RANK_COLORS = ['#f59e0b', '#94a3b8', '#fb923c'];

const pad2 = (n: number) => n.toString().padStart(2, '0');
const monthKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
const num = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 1 });

/** SL hiển thị: có cân thì "x kg", không thì "x <đơn vị>". */
function usage(s: { quantity: number; weight: number }, unit: string | null) {
  if (s.weight > 0) {
    return `${num(s.weight)} kg`;
  }
  return `${num(s.quantity)} ${unit ?? 'cái'}`;
}

function GrowthBadge({ value, hasPrev }: { value: number | null; hasPrev: boolean }) {
  if (value === null) {
    return hasPrev ? null : (
      <View style={[styles.badge, { backgroundColor: colors.infoLight }]}>
        <Text style={[styles.badgeText, { color: colors.info }]}>Mới</Text>
      </View>
    );
  }
  const up = value >= 0;
  const fg = up ? '#047857' : '#b91c1c';
  return (
    <View style={[styles.badge, { backgroundColor: up ? colors.successLight : colors.dangerLight }]}>
      <Icon name={up ? 'trending-up' : 'trending-down'} size={12} color={fg} />
      <Text style={[styles.badgeText, { color: fg }]}>
        {up ? '+' : ''}
        {num(value)}%
      </Text>
    </View>
  );
}

function Kpi({ icon, label, value, color, bg, extra }: {
  icon: string; label: string; value: string; color: string; bg: string; extra?: React.ReactNode;
}) {
  return (
    <Card style={styles.kpi}>
      <View style={[styles.kpiIcon, { backgroundColor: bg }]}>
        <Icon name={icon} size={22} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.kpiLabel}>{label}</Text>
        <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
        {extra}
      </View>
    </Card>
  );
}

function ServiceCard({ service: s, rank, maxRevenue, open, onToggle }: {
  service: ServiceStat; rank: number; maxRevenue: number; open: boolean; onToggle: () => void;
}) {
  const barWidth = maxRevenue > 0 ? Math.max(2, (s.revenue / maxRevenue) * 100) : 0;
  return (
    <Card style={open ? { ...styles.serviceCard, borderColor: colors.primary } : styles.serviceCard}>
      <Pressable onPress={onToggle} style={{ padding: spacing.md, gap: spacing.sm }}>
        <View style={styles.serviceHead}>
          <View style={[styles.rank, { backgroundColor: RANK_COLORS[rank - 1] ?? colors.hover }]}>
            <Text style={[styles.rankText, rank <= 3 && { color: '#fff' }]}>{rank}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.serviceName} numberOfLines={2}>{s.name}</Text>
            <GrowthBadge value={s.growth} hasPrev={s.prevRevenue > 0} />
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.serviceRevenue}>{formatCurrency(s.revenue)}</Text>
            <Text style={styles.serviceShare}>{num(s.share)}%</Text>
          </View>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={22} color={colors.textMuted} />
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${barWidth}%` }]} />
        </View>
        <View style={styles.metaRow}>
          <Meta icon="receipt" text={`${s.orderCount} đơn`} />
          <Meta icon="account-multiple" text={`${s.customerCount} khách`} />
          <Meta icon="scale" text={usage(s, s.unit)} />
          <Meta icon="cash" text={`TB ${formatCurrency(s.avgPerOrder)}/đơn`} />
          {s.prevRevenue > 0 && <Meta icon="history" text={`Tháng trước ${formatCurrency(s.prevRevenue)}`} />}
        </View>
      </Pressable>

      {open && (
        <View style={styles.topBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs }}>
            <Icon name="crown" size={18} color="#f59e0b" />
            <Text style={styles.topTitle}>Top {s.topCustomers.length} khách dùng nhiều nhất</Text>
          </View>
          {s.topCustomers.map((c, i) => (
            <View key={c.customerId} style={styles.customerRow}>
              <Text style={styles.customerRank}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.customerName} numberOfLines={1}>{c.name}</Text>
                <Text style={styles.customerMeta}>
                  {c.phone ? `${c.phone} · ` : ''}{c.orderCount} đơn · {usage(c, s.unit)} · gần nhất {formatDate(c.lastAt)}
                </Text>
              </View>
              <Text style={styles.customerAmount}>{formatCurrency(c.revenue)}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

function Meta({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon name={icon} size={14} color={colors.textMuted} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

/** Thống kê theo dịch vụ trong tháng: xếp hạng doanh thu + top 10 khách mỗi dịch vụ. */
export function ServiceStatsView() {
  const { isPhone } = useResponsive();
  const [cursor, setCursor] = useState(() => new Date());
  const [sort, setSort] = useState<SortKey>('revenue');
  const [search, setSearch] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const month = monthKey(cursor);
  const isCurrentMonth = month === monthKey(new Date());

  const query = useQuery({
    queryKey: ['report', 'services', month],
    queryFn: () => reportApi.services(month),
  });
  const data = query.data;

  const services = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (data?.services ?? []).filter((s) => !q || s.name.toLowerCase().includes(q));
    return [...list].sort((a, b) => b[sort] - a[sort] || b.revenue - a.revenue);
  }, [data, sort, search]);
  const maxRevenue = Math.max(0, ...(data?.services ?? []).map((s) => s.revenue));

  const shiftMonth = (delta: number) => {
    setOpenKey(null);
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  };

  return (
    <ScrollView contentContainerStyle={{ padding: isPhone ? spacing.md : spacing.lg, gap: spacing.md }}>
      {/* Chọn tháng */}
      <View style={styles.monthBar}>
        <Pressable onPress={() => shiftMonth(-1)} style={styles.monthBtn} hitSlop={8}>
          <Icon name="chevron-left" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.monthText}>Tháng {pad2(cursor.getMonth() + 1)}/{cursor.getFullYear()}</Text>
        <Pressable
          onPress={() => shiftMonth(1)}
          disabled={isCurrentMonth}
          style={[styles.monthBtn, isCurrentMonth && { opacity: 0.4 }]}
          hitSlop={8}
        >
          <Icon name="chevron-right" size={26} color={colors.text} />
        </Pressable>
      </View>

      {/* Sắp xếp + tìm */}
      <View style={styles.filterRow}>
        <View style={styles.segment}>
          {SORTS.map((o) => (
            <Pressable
              key={o.key}
              onPress={() => setSort(o.key)}
              style={[styles.segmentItem, sort === o.key && styles.segmentItemActive]}
            >
              <Text style={[styles.segmentText, sort === o.key && { color: '#fff' }]}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={[styles.search, isPhone && { width: '100%' }]}>
          <Icon name="magnify" size={18} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm dịch vụ…"
            placeholderTextColor={colors.textSubtle}
            style={styles.searchInput}
          />
        </View>
      </View>

      {query.isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : !data || data.services.length === 0 ? (
        <EmptyState title="Chưa có đơn nào trong tháng này" />
      ) : (
        <>
          <View style={styles.kpiRow}>
            <Kpi
              icon="cash-multiple"
              label="Doanh thu dịch vụ"
              value={formatCurrency(data.totalRevenue)}
              color={colors.success}
              bg={colors.successLight}
              extra={<GrowthBadge value={data.growth} hasPrev={data.prevTotalRevenue > 0} />}
            />
            <Kpi icon="receipt" label="Số đơn" value={num(data.totalOrders)} color={colors.primary} bg={colors.primaryLight} />
            <Kpi icon="account-group" label="Khách hàng" value={num(data.totalCustomers)} color="#7c3aed" bg="#ede9fe" />
            <Kpi icon="layers-outline" label="Loại dịch vụ" value={num(data.serviceCount)} color={colors.warning} bg={colors.warningLight} />
          </View>

          {services.map((s, i) => (
            <ServiceCard
              key={s.key}
              service={s}
              rank={i + 1}
              maxRevenue={maxRevenue}
              open={openKey === s.key}
              onToggle={() => setOpenKey((k) => (k === s.key ? null : s.key))}
            />
          ))}
          {services.length === 0 && (
            <Text style={styles.footnote}>Không có dịch vụ khớp “{search}”</Text>
          )}

          <Text style={styles.footnote}>
            * Tính theo ngày tạo đơn, không gồm đơn đã huỷ. Doanh thu theo thành tiền từng dịch vụ (chưa trừ giảm giá
            của cả đơn). % tăng/giảm so với tháng trước. Bấm vào dịch vụ để xem top 10 khách.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  monthBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  monthText: { fontSize: 19, fontWeight: '700', color: colors.text, minWidth: 150, textAlign: 'center' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  segment: {
    flexDirection: 'row', padding: 3, gap: 3, borderRadius: radius.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  segmentItem: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.sm },
  segmentItemActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flexGrow: 1, minWidth: 180,
    paddingHorizontal: spacing.md, height: 42, borderRadius: radius.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0 },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpi: {
    flexGrow: 1, flexBasis: 160, flexDirection: 'row', alignItems: 'center',
    gap: spacing.md, padding: spacing.md,
  },
  kpiIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  kpiLabel: { fontSize: 12, color: colors.textMuted },
  kpiValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  serviceCard: { borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  serviceHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rank: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 14, fontWeight: '800', color: colors.textMuted },
  serviceName: { fontSize: 16, fontWeight: '700', color: colors.text },
  serviceRevenue: { fontSize: 17, fontWeight: '800', color: colors.text },
  serviceShare: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.hover, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: 4 },
  metaText: { fontSize: 12, color: colors.textMuted },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start',
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  topBox: {
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background,
    padding: spacing.md, gap: 2,
  },
  topTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  customerRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  customerRank: { width: 22, fontSize: 13, fontWeight: '700', color: colors.textMuted, textAlign: 'center' },
  customerName: { fontSize: 14, fontWeight: '600', color: colors.text },
  customerMeta: { fontSize: 11, color: colors.textMuted },
  customerAmount: { fontSize: 14, fontWeight: '700', color: colors.success },
  footnote: { fontSize: 11, color: colors.textMuted, textAlign: 'center' },
});
