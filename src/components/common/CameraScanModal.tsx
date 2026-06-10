import React, { useEffect, useRef, useState } from 'react';
import {
  Linking,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { Camera, CameraType } from 'react-native-camera-kit';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';

export type ScanStatus =
  | 'verified'
  | 'anomaly'
  | 'duplicate'
  | 'notfound'
  | 'cancelled'
  | 'other';

export interface ScanFeedback {
  status: ScanStatus;
  label: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Xử lý 1 mã quét được, trả về feedback để hiện trên camera. */
  onScan: (code: string) => Promise<ScanFeedback> | ScanFeedback;
  title?: string;
  /** vd "còn 5 bịch chưa quét" */
  subtitle?: string;
}

// Cùng 1 mã trong khoảng này sẽ bị bỏ qua (chống quét trùng khi giữ camera trên 1 bịch)
const COOLDOWN_MS = 2500;

const FB: Record<ScanStatus, { bg: string; icon: string }> = {
  verified: { bg: '#16a34a', icon: 'check-circle' },
  anomaly: { bg: '#f59e0b', icon: 'alert' },
  duplicate: { bg: '#0ea5e9', icon: 'check-all' },
  notfound: { bg: '#475569', icon: 'magnify-close' },
  cancelled: { bg: '#dc2626', icon: 'close-circle' },
  other: { bg: '#0ea5e9', icon: 'information' },
};

export function CameraScanModal({
  visible,
  onClose,
  onScan,
  title = 'Quét bằng camera',
  subtitle,
}: Props) {
  const [perm, setPerm] = useState<'checking' | 'granted' | 'denied'>('checking');
  const [count, setCount] = useState(0);
  const [last, setLast] = useState<ScanFeedback | null>(null);
  const recentRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!visible) return;
    setCount(0);
    setLast(null);
    recentRef.current.clear();
    (async () => {
      setPerm('checking');
      try {
        if (Platform.OS !== 'android') {
          setPerm('granted');
          return;
        }
        const have = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
        if (have) {
          setPerm('granted');
          return;
        }
        const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
          title: 'Quyền camera',
          message: 'Cần quyền camera để quét mã đơn hàng.',
          buttonPositive: 'Đồng ý',
          buttonNegative: 'Để sau',
        });
        setPerm(res === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied');
      } catch {
        setPerm('denied');
      }
    })();
  }, [visible]);

  async function handleRead(e: { nativeEvent?: { codeStringValue?: string } }) {
    const code = (e?.nativeEvent?.codeStringValue ?? '').trim();
    if (!code) return;
    const now = Date.now();
    const prev = recentRef.current.get(code);
    if (prev && now - prev < COOLDOWN_MS) return; // chống trùng
    recentRef.current.set(code, now);
    Vibration.vibrate(40);
    try {
      const fb = await onScan(code);
      setLast(fb);
      if (fb.status === 'verified' || fb.status === 'anomaly') {
        setCount((n) => n + 1);
      }
    } catch {
      setLast({ status: 'notfound', label: code });
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        {perm === 'granted' ? (
          <Camera
            style={StyleSheet.absoluteFill}
            cameraType={CameraType.Back}
            scanBarcode
            showFrame={false}
            scanThrottleDelay={400}
            onReadCode={handleRead}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.permBox]}>
            <Icon name="camera-off" size={56} color="#fff" />
            <Text style={styles.permText}>
              {perm === 'checking' ? 'Đang mở camera…' : 'Cần cấp quyền camera để quét'}
            </Text>
            {perm === 'denied' && (
              <Pressable
                style={styles.permBtn}
                onPress={() => Linking.openSettings().catch(() => {})}
              >
                <Text style={styles.permBtnText}>Mở Cài đặt để cấp quyền</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Khung ngắm giữa màn hình */}
        {perm === 'granted' && (
          <View pointerEvents="none" style={styles.frameWrap}>
            <View style={styles.frame} />
            <Text style={styles.frameHint}>Đưa mã vạch / QR vào khung — quét liên tục</Text>
          </View>
        )}

        {/* Thanh trên: tiêu đề + bộ đếm + đóng */}
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.topTitle}>{title}</Text>
            {subtitle ? <Text style={styles.topSub}>{subtitle}</Text> : null}
          </View>
          <View style={styles.countPill}>
            <Icon name="barcode-scan" size={16} color="#fff" />
            <Text style={styles.countText}>{count}</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <Icon name="close" size={26} color="#fff" />
          </Pressable>
        </View>

        {/* Banner kết quả lần quét gần nhất */}
        {last && (
          <View style={[styles.fbBar, { backgroundColor: FB[last.status].bg }]}>
            <Icon name={FB[last.status].icon} size={28} color="#fff" />
            <Text style={styles.fbText} numberOfLines={1}>
              {last.label}
            </Text>
          </View>
        )}

        {/* Nút Xong dưới đáy */}
        <Pressable style={styles.doneBtn} onPress={onClose}>
          <Icon name="check" size={20} color={colors.primary} />
          <Text style={styles.doneText}>Xong</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  permBox: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  permText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  permBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  permBtnText: { color: '#fff', fontWeight: '700' },
  frameWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: 260,
    height: 260,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  frameHint: { color: 'rgba(255,255,255,0.9)', marginTop: spacing.md, fontSize: 13, fontWeight: '500' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'android' ? 44 : 56,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  topTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  topSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
  },
  countText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  closeBtn: { padding: 4 },
  fbBar: {
    position: 'absolute',
    bottom: 96,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  fbText: { color: '#fff', fontSize: 18, fontWeight: '800', flex: 1 },
  doneBtn: {
    position: 'absolute',
    bottom: spacing.xl,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#fff',
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.md,
    borderRadius: 99,
    elevation: 6,
  },
  doneText: { color: colors.primary, fontWeight: '800', fontSize: 16 },
});
