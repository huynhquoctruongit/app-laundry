import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { reportApi } from '@/api/report.api';
import { useResponsive } from '@/hooks/useResponsive';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ORDER_STATUS_LABEL, type OrderStatus } from '@/helpers/enums/order-status';

type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'lastMonth' | 'custom';

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function ReportsScreen() {
  const { isPhone } = useResponsive();
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
    } else if (p === 'yesterday') {
      f = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      t = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
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

  const salesQuery = useQuery({
    queryKey: ['report', 'sales', params],
    queryFn: () => reportApi.sales(params),
  });

  return (
    <View style={styles.container}>
      {/* Chọn nhanh + khoảng ngày */}
      <View>
        <View style={styles.presetRow}>
          {(
            [
              { v: 'today', label: 'Hôm nay' },
              { v: 'yesterday', label: 'Hôm qua' },
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

      <ScrollView contentContainerStyle={{ padding: isPhone ? spacing.md : spacing.lg, gap: spacing.lg }}>
        <View style={styles.cardsRow}>
          <StatCard
            label="Tổng đơn"
            value={String(salesQuery.data?.totalOrders ?? 0)}
            icon="package-variant"
            color={colors.primary}
            bg={colors.primaryLight}
          />
          <StatCard
            label="Đã thu"
            value={formatCurrency(salesQuery.data?.collected ?? 0)}
            icon="wallet"
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
          <CardHeader><CardTitle>Đã thu theo ngày</CardTitle></CardHeader>
          <CardContent>
            <DailyBarChart data={salesQuery.data?.dailyCollected ?? []} />
          </CardContent>
        </Card>

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
            <StatusList data={salesQuery.data?.ordersByStatus ?? {}} />
          </CardContent>
        </Card>
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

function StatusList({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  if (entries.length === 0) {
    return <Text style={{ color: colors.textMuted }}>Chưa có dữ liệu</Text>;
  }
  return (
    <View style={{ gap: spacing.sm }}>
      {entries.map(([k, v]) => (
        <View key={k} style={styles.catRow}>
          <View style={[styles.catDot, { backgroundColor: colors.primary }]} />
          <Text style={styles.catName}>
            {ORDER_STATUS_LABEL[k as OrderStatus] ?? k}
          </Text>
          <Text style={[styles.catValue, { color: colors.primary }]}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

// Rút gọn tiền cho nhãn cột: 630500 → "631k", 1250000 → "1.3tr"
function formatCompact(v: number): string {
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `${m % 1 === 0 ? m : m.toFixed(1)}tr`;
  }
  if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(v);
}

const CHART_HEIGHT = 140;

function DailyBarChart({ data }: { data: { date: string; amount: number }[] }) {
  if (data.length === 0) {
    return <Text style={{ color: colors.textMuted }}>Chưa có dữ liệu</Text>;
  }
  const max = Math.max(...data.map((d) => d.amount), 1);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chartRow}
    >
      {data.map((d) => {
        const day = new Date(d.date);
        const h = Math.max(2, Math.round((d.amount / max) * CHART_HEIGHT));
        return (
          <View key={d.date} style={styles.chartCol}>
            <Text style={styles.chartValue} numberOfLines={1}>
              {d.amount > 0 ? formatCompact(d.amount) : ''}
            </Text>
            <View style={styles.chartBarTrack}>
              <View style={[styles.chartBar, { height: h }]} />
            </View>
            <Text style={styles.chartLabel}>
              {day.getDate().toString().padStart(2, '0')}/
              {(day.getMonth() + 1).toString().padStart(2, '0')}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
  rank: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  rankText: { fontWeight: '700', color: colors.primary },
  listName: { fontSize: 14, fontWeight: '600', color: colors.text },
  listMeta: { fontSize: 12, color: colors.textMuted },
  listAmount: { fontSize: 14, fontWeight: '700', color: colors.text },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, paddingVertical: spacing.sm },
  chartCol: { alignItems: 'center', width: 44 },
  chartValue: { fontSize: 10, fontWeight: '600', color: colors.text, marginBottom: 4 },
  chartBarTrack: { height: CHART_HEIGHT, justifyContent: 'flex-end' },
  chartBar: { width: 22, borderRadius: 6, backgroundColor: colors.primary },
  chartLabel: { fontSize: 10, color: colors.textMuted, marginTop: 6 },
});
