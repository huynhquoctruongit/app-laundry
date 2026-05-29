import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { CustomerStats } from '@/api/customer.api';

interface Props {
  stats: CustomerStats | undefined;
  isLoading: boolean;
}

const FREQUENCY_COLORS: Record<
  CustomerStats['frequencyTone'],
  { bg: string; fg: string; icon: string }
> = {
  frequent: {
    bg: colors.successLight,
    fg: '#065f46',
    icon: 'fire',
  },
  regular: {
    bg: '#dbeafe',
    fg: '#1e40af',
    icon: 'calendar-check',
  },
  rare: {
    bg: colors.warningLight,
    fg: '#92400e',
    icon: 'calendar-clock',
  },
  new: {
    bg: '#f3f4f6',
    fg: '#374151',
    icon: 'account-star',
  },
};

export function CustomerStatsBlock({ stats, isLoading }: Props) {
  if (isLoading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Đang tải thống kê…</Text>
      </View>
    );
  }
  if (!stats) return null;

  const freqStyle = FREQUENCY_COLORS[stats.frequencyTone];

  if (stats.orderCount === 0) {
    return (
      <View style={styles.emptyBox}>
        <Icon name="information-outline" size={20} color={colors.textMuted} />
        <Text style={styles.emptyText}>
          Khách hàng chưa có đơn hoàn thành nào.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Frequency badge — to nhất */}
      <View style={[styles.freqBox, { backgroundColor: freqStyle.bg }]}>
        <Icon name={freqStyle.icon} size={24} color={freqStyle.fg} />
        <View style={{ flex: 1 }}>
          <Text style={styles.freqLabel}>Tần suất giặt</Text>
          <Text style={[styles.freqValue, { color: freqStyle.fg }]}>
            {stats.frequencyLabel}
          </Text>
          {stats.averageIntervalDays !== null && (
            <Text style={[styles.freqHint, { color: freqStyle.fg, opacity: 0.7 }]}>
              TB {Math.round(stats.averageIntervalDays)} ngày / lần
            </Text>
          )}
        </View>
      </View>

      {/* Tiền + lần giặt */}
      <View style={styles.statsRow}>
        <StatBox
          label="Số lần giặt"
          value={`${stats.orderCount}`}
          suffix="đơn"
          icon="package-variant"
          color={colors.primary}
          bg={colors.primaryLight}
        />
        <StatBox
          label="TB / đơn"
          value={formatCurrency(stats.avgOrderValue)}
          icon="chart-line-variant"
          color={colors.warning}
          bg={colors.warningLight}
        />
      </View>

      <View style={styles.statsRow}>
        <StatBox
          label="Tổng đã chi"
          value={formatCurrency(stats.totalSpent)}
          icon="cash-multiple"
          color={colors.success}
          bg={colors.successLight}
          large
        />
      </View>

      {/* Mốc thời gian */}
      <View style={styles.timelineBox}>
        {stats.firstOrderAt && (
          <View style={styles.timelineRow}>
            <Icon name="circle-small" size={20} color={colors.textMuted} />
            <Text style={styles.timelineLabel}>Lần đầu giặt</Text>
            <Text style={styles.timelineValue}>
              {formatDate(stats.firstOrderAt)}
            </Text>
          </View>
        )}
        {stats.lastOrderAt && (
          <View style={styles.timelineRow}>
            <Icon name="circle-small" size={20} color={colors.success} />
            <Text style={styles.timelineLabel}>Lần gần nhất</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.timelineValue}>
                {formatDate(stats.lastOrderAt)}
              </Text>
              {stats.daysSinceLastOrder !== null && (
                <Text style={styles.timelineHint}>
                  {stats.daysSinceLastOrder === 0
                    ? 'Hôm nay'
                    : `${stats.daysSinceLastOrder} ngày trước`}
                </Text>
              )}
            </View>
          </View>
        )}
      </View>

      {/* 5 đơn gần đây */}
      {stats.recentOrders.length > 0 && (
        <View style={styles.recentBox}>
          <Text style={styles.recentTitle}>5 đơn gần nhất</Text>
          {stats.recentOrders.map((o) => {
            const net = Number(o.totalAmount) - Number(o.discountAmount);
            return (
              <View key={o.id} style={styles.recentRow}>
                <Text style={styles.recentCode}>{o.code}</Text>
                <Text style={styles.recentDate}>
                  {formatDate(o.createdAt)}
                </Text>
                <Text style={styles.recentAmount}>{formatCurrency(net)}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function StatBox({
  label,
  value,
  suffix,
  icon,
  color,
  bg,
  large,
}: {
  label: string;
  value: string;
  suffix?: string;
  icon: string;
  color: string;
  bg: string;
  large?: boolean;
}) {
  return (
    <View style={[styles.statBox, { backgroundColor: bg }, large && { flex: 1 }]}>
      <View style={styles.statRow}>
        <Icon name={icon} size={18} color={color} />
        <Text style={[styles.statLabel, { color }]}>{label}</Text>
      </View>
      <View style={styles.statValueRow}>
        <Text style={[styles.statValue, { color }, large && { fontSize: 24 }]}>
          {value}
        </Text>
        {suffix ? <Text style={[styles.statSuffix, { color }]}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  loadingText: { fontSize: 13, color: colors.textMuted },
  emptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyText: { flex: 1, fontSize: 13, color: colors.textMuted },

  freqBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  freqLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  freqValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  freqHint: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },

  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    gap: 4,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  statSuffix: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.7,
  },

  timelineBox: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 2,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: 6,
    gap: 4,
  },
  timelineLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.textMuted,
  },
  timelineValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  timelineHint: {
    fontSize: 11,
    color: colors.textMuted,
  },

  recentBox: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  recentTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  recentCode: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'monospace',
    color: colors.text,
  },
  recentDate: {
    fontSize: 11,
    color: colors.textMuted,
  },
  recentAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    minWidth: 90,
    textAlign: 'right',
  },
});
