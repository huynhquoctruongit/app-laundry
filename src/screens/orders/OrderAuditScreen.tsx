import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  ScrollView,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '@/components/ui/Button';
import { CameraScanModal, type ScanFeedback } from '@/components/common/CameraScanModal';
import { orderApi } from '@/api/order.api';
import { auditApi } from '@/api/audit.api';
import { extractError } from '@/api/client';
import { useResponsive } from '@/hooks/useResponsive';
import { usePermissions } from '@/hooks/usePermissions';
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
  /** Ai quét (từ máy chủ — có thể là máy khác) */
  auditedBy?: string;
  auditedAt?: string;
}

/** Đồng bộ kết quả quét giữa các máy mỗi … ms khi đang mở màn Rà soát */
const SYNC_INTERVAL_MS = 3000;

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export function OrderAuditScreen() {
  const queryClient = useQueryClient();
  const isFocused = useIsFocused();
  const { isAdmin } = usePermissions();
  const { isPhone, width } = useResponsive();
  // Phone: 2 cols, tablet/POS: 4 cols (Sunmi rộng đủ cho 4)
  const numColumns = isPhone ? 2 : width >= 1200 ? 5 : width >= 900 ? 4 : 3;

  // Tải toàn bộ đơn đã giặt xong chờ khách lấy (READY) — bịch trên kệ
  const readyQuery = useQuery({
    queryKey: ['orders', 'audit-pending'],
    queryFn: async () => {
      const result = await orderApi.list({ status: 'READY', pageSize: 1000 });
      return result;
    },
  });

  // Kết quả quét HÔM NAY của mọi máy (điện thoại + máy quét không dây) — gọi lại liên tục
  const auditsQuery = useQuery({
    queryKey: ['audits', 'today'],
    queryFn: () => auditApi.today(),
    refetchInterval: isFocused ? SYNC_INTERVAL_MS : false,
  });

  // Quét trên máy này nhưng chưa thấy trên máy chủ (đang gửi) → hiện ngay cho mượt
  const [optimistic, setOptimistic] = useState<Map<string, BagState>>(new Map());
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  /** Máy chủ là nguồn chuẩn; optimistic chỉ lấp khoảng trễ của lần quét trên máy này. */
  const auditMap = useMemo(() => {
    const map = new Map<string, AuditEntry>();
    const server = new Map((auditsQuery.data?.items ?? []).map((a) => [a.order.code, a]));
    for (const o of readyQuery.data?.items ?? []) {
      const a = server.get(o.code);
      const local = optimistic.get(o.code);
      map.set(o.code, {
        order: o,
        state: a ? (a.result === 'ANOMALY' ? 'anomaly' : 'verified') : local ?? 'pending',
        auditedBy: a?.auditedBy.name,
        auditedAt: a?.auditedAt,
      });
    }
    // Bất thường: đơn đã giao nhưng bịch vẫn trên kệ (không nằm trong danh sách chờ giao)
    for (const a of auditsQuery.data?.items ?? []) {
      if (a.result === 'ANOMALY' && !map.has(a.order.code)) {
        map.set(a.order.code, {
          order: a.order as unknown as Order,
          state: 'anomaly',
          auditedBy: a.auditedBy.name,
          auditedAt: a.auditedAt,
        });
      }
    }
    return map;
  }, [readyQuery.data, auditsQuery.data, optimistic]);

  // Máy chủ đã xác nhận (hoặc đã bị máy khác "Bắt đầu lại") → bỏ bản tạm trên máy này
  useEffect(() => {
    if (!auditsQuery.data) return;
    setOptimistic((prev) => {
      if (prev.size === 0) return prev;
      const serverCodes = new Set(auditsQuery.data.items.map((a) => a.order.code));
      const next = new Map([...prev].filter(([code]) => !serverCodes.has(code)));
      return next.size === prev.size ? prev : next;
    });
  }, [auditsQuery.data]);

  // Ref để handleScan đọc map mới nhất (tránh stale closure do useCallback [])
  const auditMapRef = useRef(auditMap);
  useEffect(() => { auditMapRef.current = auditMap; }, [auditMap]);

  /** Gửi kết quả quét lên máy chủ; bịch đã được máy khác quét → báo người quét trước */
  const pushAudit = useCallback(
    async (order: Pick<Order, 'id' | 'code'>, result: 'VERIFIED' | 'ANOMALY') => {
      try {
        const res = await auditApi.mark(order.id, result);
        if (res.duplicate) {
          Toast.show({
            type: 'info',
            text1: `${res.audit.auditedBy.name} đã quét bịch này lúc ${hhmm(res.audit.auditedAt)}`,
            text2: res.audit.order.customer?.name ?? res.audit.order.code,
          });
        }
      } catch (err) {
        Toast.show({ type: 'error', text1: 'Chưa lưu được lần quét', text2: extractError(err).message });
      } finally {
        queryClient.invalidateQueries({ queryKey: ['audits', 'today'] });
      }
    },
    [queryClient],
  );

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
        if (ent?.state === 'verified') {
          // Đã quét rồi (có thể bởi máy khác) → báo, không ghi lại
          return {
            status: 'duplicate',
            label: ent.auditedBy ? `${name} · ${ent.auditedBy} đã quét ${ent.auditedAt ? hhmm(ent.auditedAt) : ''}` : name,
          };
        }
        setOptimistic((prev) => new Map(prev).set(key, 'verified'));
        if (ent) void pushAudit(ent.order, 'VERIFIED');
        return { status: 'verified', label: name };
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
          // Anomaly: hệ thống đã ghi giao nhưng đồ vẫn ở kệ → ghi lên máy chủ cho mọi máy thấy
          setLastScanned(found.code);
          void pushAudit(found, 'ANOMALY');
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
    [pushAudit],
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
    Alert.alert(
      'Bắt đầu rà soát lại?',
      'Xoá kết quả quét hôm nay trên TẤT CẢ các máy (điện thoại + máy quét).',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Bắt đầu lại',
          style: 'destructive',
          onPress: async () => {
            try {
              await auditApi.resetToday();
              setOptimistic(new Map());
              setLastScanned(null);
              queryClient.invalidateQueries({ queryKey: ['audits', 'today'] });
              Toast.show({ type: 'info', text1: 'Đã reset rà soát (mọi máy)' });
            } catch (err) {
              Toast.show({ type: 'error', text1: extractError(err).message });
            }
          },
        },
      ],
    );
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
        {isAdmin && (
          <Pressable onPress={() => setHistoryOpen(true)} style={styles.iconBtn} accessibilityLabel="Lịch sử rà soát">
            <Icon name="history" size={20} color={colors.textMuted} />
          </Pressable>
        )}
        <Pressable
          onPress={() => {
            queryClient.invalidateQueries({ queryKey: ['orders', 'audit-pending'] });
            queryClient.invalidateQueries({ queryKey: ['audits', 'today'] });
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

      <AuditHistoryModal visible={historyOpen} onClose={() => setHistoryOpen(false)} />

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
      {entry.auditedBy ? (
        <Text style={styles.bagBy} numberOfLines={1}>
          {entry.auditedBy}
          {entry.auditedAt ? ` · ${hhmm(entry.auditedAt)}` : ''}
        </Text>
      ) : null}
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

// ─── Lịch sử rà soát (chủ tiệm) ─────────────────────────────────────────────

function AuditHistoryModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [cursor, setCursor] = useState(() => new Date());
  const month = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
  const query = useQuery({
    queryKey: ['audits', 'summary', month],
    queryFn: () => auditApi.summary(month),
    enabled: visible,
  });
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.histBackdrop}>
        <View style={styles.histCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.title}>Lịch sử rà soát</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Icon name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
            <Pressable hitSlop={8} onPress={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
              <Icon name="chevron-left" size={26} color={colors.text} />
            </Pressable>
            <Text style={{ fontWeight: '700', color: colors.text }}>Tháng {month.slice(5)}/{month.slice(0, 4)}</Text>
            <Pressable hitSlop={8} onPress={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
              <Icon name="chevron-right" size={26} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: spacing.sm }}>
            {query.isLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : !query.data || query.data.days.length === 0 ? (
              <Text style={styles.subtitle}>Chưa có ngày nào rà soát trong tháng.</Text>
            ) : (
              query.data.days.map((d) => (
                <View key={d.date} style={styles.histRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: colors.text }}>
                      {d.date.split('-').reverse().slice(0, 2).join('/')} · {hhmm(d.firstAt)}–{hhmm(d.lastAt)}
                    </Text>
                    <Text style={styles.subtitle}>{d.users.map((u) => `${u.name} ${u.count}`).join(' · ')}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontWeight: '800', color: colors.success }}>{d.verified} bịch</Text>
                    {d.anomaly > 0 && <Text style={{ fontWeight: '700', color: colors.danger }}>{d.anomaly} bất thường</Text>}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
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
  bagBy: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  histBackdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  histCard: { width: '100%', maxWidth: 480, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  histRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
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
