import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '@/components/ui/Button';
import { CameraScanModal, type ScanFeedback } from '@/components/common/CameraScanModal';
import { orderApi } from '@/api/order.api';
import { extractError } from '@/api/client';
import { useResponsive } from '@/hooks/useResponsive';
import {
  setScannerOverride,
  setScannerActive,
  isScannerActive,
} from '@/native/scanner-bridge';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { formatCurrency, matchScannedOrder, orderCodeSuffix } from '@/lib/utils';
import type { Order } from '@/types/api';

type BagState = 'pending' | 'verified' | 'anomaly';

interface AuditEntry {
  order: Order;
  state: BagState;
  scannedAt?: number;
}

export function OrderAuditScreen() {
  const queryClient = useQueryClient();
  const { isPhone, width } = useResponsive();
  // Phone: 2 cols, tablet/POS: 4 cols (Sunmi rộng đủ cho 4)
  const numColumns = isPhone ? 2 : width >= 1200 ? 5 : width >= 900 ? 4 : 3;

  // Tải toàn bộ đơn chưa giao (cả READY/CREATED/RECEIVED/WASHING) — bịch trên kệ
  const readyQuery = useQuery({
    queryKey: ['orders', 'audit-pending'],
    queryFn: async () => {
      const result = await orderApi.list({ pageSize: 500 });
      // Filter client-side: bỏ DELIVERED + CANCELLED
      return {
        ...result,
        items: result.items.filter(
          (o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED',
        ),
      };
    },
  });

  const [auditMap, setAuditMap] = useState<Map<string, AuditEntry>>(new Map());
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  // Ref để handleScan đọc map mới nhất (tránh stale closure do useCallback [])
  const auditMapRef = useRef(auditMap);
  useEffect(() => { auditMapRef.current = auditMap; }, [auditMap]);

  // Khởi tạo map khi data về
  useEffect(() => {
    if (!readyQuery.data) return;
    setAuditMap((prev) => {
      const next = new Map<string, AuditEntry>();
      for (const o of readyQuery.data.items) {
        // Giữ lại state cũ nếu đã scan
        const existing = prev.get(o.code);
        next.set(o.code, {
          order: o,
          state: existing?.state ?? 'pending',
          scannedAt: existing?.scannedAt,
        });
      }
      // Giữ lại các "anomaly" (đơn đã giao bị quét nhầm lên kệ)
      for (const [code, entry] of prev) {
        if (entry.state === 'anomaly' && !next.has(code)) {
          next.set(code, entry);
        }
      }
      return next;
    });
  }, [readyQuery.data]);

  // Handler xử lý 1 scan — KHÔNG hoàn thành đơn, chỉ check
  const handleScan = useCallback(
    async (scanned: string): Promise<ScanFeedback> => {
      const code = scanned.trim();
      if (code.length < 2) return { status: 'notfound', label: code };

      // Mã quét có thể là mã đầy đủ (bag cũ) HOẶC đuôi mã (bag mới) → resolve về
      // key đầy đủ trong danh sách bịch trên kệ.
      const v = code.toUpperCase();
      let matchedKey: string | null = null;
      for (const k of auditMapRef.current.keys()) {
        if (k.toUpperCase() === v || orderCodeSuffix(k).toUpperCase() === v) {
          matchedKey = k;
          break;
        }
      }

      if (matchedKey) {
        const key = matchedKey;
        const ent = auditMapRef.current.get(key);
        const name = ent?.order.customer?.name ?? key;
        setLastScanned(key);
        if (ent?.state === 'anomaly') return { status: 'anomaly', label: name };
        const already = ent?.state === 'verified';
        setAuditMap((prev) => {
          const e = prev.get(key);
          if (!e || e.state === 'anomaly') return prev;
          const next = new Map(prev);
          next.set(key, { ...e, state: 'verified', scannedAt: Date.now() });
          return next;
        });
        return { status: already ? 'duplicate' : 'verified', label: name };
      }

      setLastScanned(code);
      // Không có trong danh sách — tra cứu trạng thái thực
      try {
        const result = await orderApi.list({ search: code, pageSize: 5 });
        const found = matchScannedOrder(result.items, code);
        if (!found) {
          Toast.show({ type: 'error', text1: 'Không tìm thấy đơn', text2: code });
          return { status: 'notfound', label: code };
        }
        const fname = found.customer?.name ?? found.code;
        if (found.status === 'DELIVERED') {
          // Anomaly: hệ thống đã ghi giao nhưng đồ vẫn ở kệ
          setAuditMap((prev) => {
            const next = new Map(prev);
            next.set(found.code, { order: found, state: 'anomaly', scannedAt: Date.now() });
            return next;
          });
          setLastScanned(found.code);
          Toast.show({ type: 'info', text1: 'Bất thường: đơn đã giao nhưng còn trên kệ', text2: found.code });
          return { status: 'anomaly', label: `Bất thường: ${fname}` };
        }
        if (found.status === 'CANCELLED') {
          Toast.show({
            type: 'error',
            text1: 'Đơn đã huỷ',
            text2: `${found.customer?.name ?? ''} · ${found.code}`,
          });
          return { status: 'cancelled', label: `Đã huỷ: ${fname}` };
        }
        // Trạng thái khác (CREATED/RECEIVED/WASHING) — coi như cần xử lý
        Toast.show({
          type: 'info',
          text1: `Đơn trạng thái: ${found.status}`,
          text2: found.customer?.name ?? found.code,
        });
        return { status: 'other', label: fname };
      } catch (err) {
        Toast.show({
          type: 'error',
          text1: 'Lỗi tải dữ liệu',
          text2: extractError(err).message,
        });
        return { status: 'notfound', label: code };
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Khi vào màn — đăng ký override scanner + bật scanner nếu đang tắt
  useFocusEffect(
    useCallback(() => {
      const wasActive = isScannerActive();
      setScannerActive(true);
      setScannerOverride((code) => handleScan(code));
      return () => {
        setScannerOverride(null);
        if (!wasActive) setScannerActive(false);
      };
    }, [handleScan]),
  );

  const entries = useMemo(() => {
    const arr = Array.from(auditMap.values());
    // Anomaly lên đầu, kế đến chưa quét, cuối cùng đã quét
    arr.sort((a, b) => {
      const order: Record<BagState, number> = { anomaly: 0, pending: 1, verified: 2 };
      return order[a.state] - order[b.state];
    });
    return arr;
  }, [auditMap]);

  const stats = useMemo(() => {
    let scannedCount = 0;
    let scannedAmount = 0;
    let pendingCount = 0;
    let pendingAmount = 0;
    let anomalyCount = 0;
    let anomalyAmount = 0;
    for (const e of entries) {
      const amt = Number(e.order.totalAmount);
      if (e.state === 'verified') {
        scannedCount += 1;
        scannedAmount += amt;
      } else if (e.state === 'anomaly') {
        anomalyCount += 1;
        anomalyAmount += amt;
      } else {
        pendingCount += 1;
        pendingAmount += amt;
      }
    }
    return {
      scannedCount,
      scannedAmount,
      pendingCount,
      pendingAmount,
      anomalyCount,
      anomalyAmount,
    };
  }, [entries]);

  function resetAudit() {
    setAuditMap((prev) => {
      const next = new Map<string, AuditEntry>();
      for (const [code, entry] of prev) {
        if (entry.state === 'anomaly') continue; // bỏ anomaly khi reset
        next.set(code, { ...entry, state: 'pending', scannedAt: undefined });
      }
      return next;
    });
    setLastScanned(null);
    Toast.show({ type: 'info', text1: 'Đã reset rà soát' });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Icon name="magnify-scan" size={24} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Rà soát đơn cuối ngày</Text>
          <Text style={styles.subtitle}>
            Quét lần lượt từng bịch trên kệ. KHÔNG hoàn thành đơn — chỉ kiểm tra.
          </Text>
        </View>
        <Pressable
          onPress={() => {
            queryClient.invalidateQueries({ queryKey: ['orders', 'audit-pending'] });
          }}
          style={styles.iconBtn}
        >
          <Icon name="refresh" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      {readyQuery.isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Đang tải danh sách đơn…</Text>
        </View>
      ) : readyQuery.isError ? (
        <View style={styles.emptyBox}>
          <Icon name="alert-circle-outline" size={64} color={colors.danger} />
          <Text style={styles.emptyTitle}>Không tải được dữ liệu</Text>
          <Text style={styles.emptyDesc}>
            {String((readyQuery.error as any)?.message ?? 'Lỗi kết nối. Kéo xuống để thử lại.')}
          </Text>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.emptyBox}>
          <Icon name="package-variant-closed" size={64} color={colors.textSubtle} />
          <Text style={styles.emptyTitle}>Không có bịch nào trên kệ</Text>
          <Text style={styles.emptyDesc}>
            Mọi đơn đã được giao hoặc chưa có đơn nào.
          </Text>
        </View>
      ) : (
        <FlatList
          key={`audit-cols-${numColumns}`}
          data={entries}
          keyExtractor={(item) => item.order.code}
          numColumns={numColumns}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => (
            <BagCard entry={item} pulse={lastScanned === item.order.code} />
          )}
          refreshing={readyQuery.isFetching}
          onRefresh={() => {
            queryClient.invalidateQueries({ queryKey: ['orders', 'audit-pending'] });
          }}
        />
      )}

      {/* Bottom totals panel */}
      <View style={styles.bottomPanel}>
        <View style={styles.statsRow}>
          <StatCard
            label="Đã quét"
            count={stats.scannedCount}
            amount={stats.scannedAmount}
            color={colors.success}
            bg={colors.successLight}
          />
          <StatCard
            label="Chưa quét"
            count={stats.pendingCount}
            amount={stats.pendingAmount}
            color={colors.warning}
            bg={colors.warningLight}
            warn={stats.pendingCount > 0}
          />
          {stats.anomalyCount > 0 && (
            <StatCard
              label="Bất thường"
              count={stats.anomalyCount}
              amount={stats.anomalyAmount}
              color={colors.danger}
              bg={colors.dangerLight}
            />
          )}
        </View>

        {/* paddingRight chừa chỗ cho FAB toggle máy quét ở góc dưới-phải */}
        <View style={{ flexDirection: 'row', gap: spacing.md, paddingRight: 56 }}>
          <Button
            style={{ flex: 1 }}
            onPress={() => setCameraOpen(true)}
            leftIcon={<Icon name="camera" size={18} color="#fff" />}
          >
            Quét bằng camera
          </Button>
          {entries.length > 0 && (
            <Button
              variant="outline"
              onPress={resetAudit}
              leftIcon={<Icon name="restart" size={16} color={colors.text} />}
            >
              Reset
            </Button>
          )}
        </View>
      </View>

      {/* Camera quét hàng loạt — dùng cho điện thoại quét bịch ở xa */}
      <CameraScanModal
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onScan={handleScan}
        title="Quét bịch trên kệ"
        subtitle={
          stats.pendingCount > 0
            ? `Còn ${stats.pendingCount} bịch chưa quét`
            : 'Đã quét hết các bịch'
        }
      />
    </View>
  );
}

// ─── Bag card with pulse animation ──────────────────────────────────────────

function BagCard({ entry, pulse }: { entry: AuditEntry; pulse: boolean }) {
  const { order, state } = entry;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (pulse) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.08,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 8,
          stiffness: 120,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [pulse, entry.scannedAt, scaleAnim]);

  const stateStyle = (() => {
    switch (state) {
      case 'verified':
        return {
          bg: colors.successLight,
          border: colors.success,
          icon: colors.success,
          text: '#065f46',
        };
      case 'anomaly':
        return {
          bg: colors.dangerLight,
          border: colors.danger,
          icon: colors.danger,
          text: '#991b1b',
        };
      default:
        return {
          bg: colors.background,
          border: colors.border,
          icon: colors.textMuted,
          text: colors.text,
        };
    }
  })();

  return (
    <Animated.View
      style={[
        styles.bag,
        {
          backgroundColor: stateStyle.bg,
          borderColor: stateStyle.border,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Icon name="package-variant-closed" size={36} color={stateStyle.icon} />
      <Text
        style={[styles.bagName, { color: stateStyle.text }]}
        numberOfLines={1}
      >
        {order.customer?.name ?? '—'}
      </Text>
      <Text style={[styles.bagAmount, { color: stateStyle.icon }]}>
        {formatCurrency(Number(order.totalAmount))}
      </Text>
      {state === 'verified' && (
        <View style={[styles.badge, { backgroundColor: colors.success }]}>
          <Icon name="check" size={12} color="#fff" />
        </View>
      )}
      {state === 'anomaly' && (
        <View style={[styles.badge, { backgroundColor: colors.danger }]}>
          <Icon name="alert" size={12} color="#fff" />
        </View>
      )}
    </Animated.View>
  );
}

// ─── Stat card ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  count,
  amount,
  color,
  bg,
  warn,
}: {
  label: string;
  count: number;
  amount: number;
  color: string;
  bg: string;
  warn?: boolean;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <Text style={[styles.statLabel, { color }]}>
        {label}
        {warn && count > 0 ? ' ⚠️' : ''}
      </Text>
      <Text style={[styles.statCount, { color }]}>{count} đơn</Text>
      <Text style={[styles.statAmount, { color }]}>{formatCurrency(amount)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.background,
  },

  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: { fontSize: 14, color: colors.textMuted },

  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
    gap: spacing.sm,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  emptyDesc: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },

  grid: { padding: spacing.md, paddingBottom: 220 },
  gridRow: { gap: spacing.sm, marginBottom: spacing.sm },
  bag: {
    flex: 1,
    maxWidth: 180,        // không cho 1 bịch giãn full chiều ngang
    aspectRatio: 1,
    maxHeight: 180,
    borderRadius: radius.lg,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    gap: 2,
    position: 'relative',
  },
  bagName: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  bagAmount: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.85,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    gap: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  statCount: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  statAmount: { fontSize: 16, fontWeight: '800' },
});
