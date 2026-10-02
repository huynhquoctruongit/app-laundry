import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, DeviceEventEmitter, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  compareUpdate,
  fetchManifest,
  updater,
  updaterAvailable,
  type UpdateManifest,
} from '@/lib/appUpdater';
import { colors } from '@/theme/colors';

const CHECK_EVENT = 'app-update-check';
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

/** Nút "Kiểm tra cập nhật" (Cài đặt) gọi hàm này. */
export function requestUpdateCheck() {
  DeviceEventEmitter.emit(CHECK_EVENT, true);
}

type ApkInfo = NonNullable<UpdateManifest['apk']>;
type OtaInfo = NonNullable<UpdateManifest['ota']>;

/**
 * Tự cập nhật app — mount 1 lần ở App:
 *  - mở app / quay lại app (cách 15 phút) → kiểm tra bản mới
 *  - có APK mới → popup "Cập nhật" → tải + mở trình cài
 *  - có gói OTA mới → tải ngầm → hỏi khởi động lại (bấm "Để sau" thì áp dụng ở lần mở app sau)
 */
export function AppUpdater() {
  const [apk, setApk] = useState<ApkInfo | null>(null);
  const [ota, setOta] = useState<OtaInfo | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [apkPath, setApkPath] = useState<string | null>(null);
  const [needPermission, setNeedPermission] = useState(false);
  const busy = useRef(false);
  const lastCheck = useRef(0);

  const check = useCallback(async (manual = false) => {
    if (!updaterAvailable || busy.current) return;
    busy.current = true;
    lastCheck.current = Date.now();
    try {
      const [info, manifest] = await Promise.all([updater.getInfo(), fetchManifest()]);
      if (!info) return;
      const res = compareUpdate(info, manifest);
      if (res.kind === 'apk') {
        setApk(res.apk);
      } else if (res.kind === 'ota') {
        await updater.downloadBundle(res.ota.url, res.ota.bundleVersion);
        setOta(res.ota);
      } else if (manual) {
        Toast.show({
          type: 'success',
          text1: 'Đang dùng bản mới nhất',
          text2: info.pendingBundleVersion ? 'Bản mới đã tải — mở lại app để áp dụng' : undefined,
        });
      }
    } catch (e) {
      if (manual) Toast.show({ type: 'error', text1: 'Không kiểm tra được cập nhật', text2: String((e as Error)?.message ?? e) });
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    if (!updaterAvailable) return;
    updater.markSuccess(); // app đã mở lên bình thường → giữ bản OTA đang chạy
    check();
    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && Date.now() - lastCheck.current > CHECK_INTERVAL_MS) check();
    });
    const manualSub = DeviceEventEmitter.addListener(CHECK_EVENT, () => check(true));
    return () => {
      appSub.remove();
      manualSub.remove();
    };
  }, [check]);

  const install = async (path: string) => {
    try {
      await updater.installApk(path);
      setNeedPermission(false);
    } catch (e) {
      if ((e as { code?: string })?.code === 'NEED_PERMISSION') setNeedPermission(true);
      else Toast.show({ type: 'error', text1: 'Không mở được trình cài đặt', text2: String((e as Error)?.message ?? e) });
    }
  };

  const startApk = async () => {
    if (!apk || progress !== null) return;
    if (apkPath) return install(apkPath);
    setProgress(0);
    const off = updater.onProgress((r, t) => setProgress(t > 0 ? r / t : 0));
    try {
      const path = await updater.downloadApk(apk.url);
      setApkPath(path);
      await install(path);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Tải bản cập nhật thất bại', text2: String((e as Error)?.message ?? e) });
    } finally {
      off();
      setProgress(null);
    }
  };

  if (apk) {
    const downloading = progress !== null;
    return (
      <Modal transparent animationType="fade" visible onRequestClose={() => !downloading && setApk(null)}>
        <View style={s.overlay}>
          <View style={s.card}>
            <View style={s.iconWrap}>
              <Icon name="cellphone-arrow-down" size={30} color={colors.primary} />
            </View>
            <Text style={s.title}>Có bản cập nhật mới</Text>
            <Text style={s.version}>Phiên bản {apk.versionName}</Text>
            {apk.notes ? <Text style={s.notes}>{apk.notes}</Text> : null}

            {downloading ? (
              <View style={{ width: '100%', marginTop: 16 }}>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${Math.round((progress ?? 0) * 100)}%` }]} />
                </View>
                <Text style={s.progressText}>Đang tải… {Math.round((progress ?? 0) * 100)}%</Text>
              </View>
            ) : needPermission ? (
              <Text style={s.hint}>
                Bật "Cho phép từ nguồn này" cho app Giặt Sấy rồi quay lại bấm "Cài đặt".
              </Text>
            ) : null}

            {!downloading && (
              <View style={s.row}>
                <Pressable style={[s.btn, s.btnGhost]} onPress={() => setApk(null)}>
                  <Text style={s.btnGhostText}>Để sau</Text>
                </Pressable>
                <Pressable style={[s.btn, s.btnPrimary]} onPress={startApk}>
                  <Text style={s.btnPrimaryText}>{apkPath ? 'Cài đặt' : 'Cập nhật ngay'}</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    );
  }

  if (ota) {
    return (
      <Modal transparent animationType="fade" visible onRequestClose={() => setOta(null)}>
        <View style={s.overlay}>
          <View style={s.card}>
            <View style={[s.iconWrap, { backgroundColor: colors.successLight }]}>
              <Icon name="rocket-launch" size={30} color={colors.success} />
            </View>
            <Text style={s.title}>Đã tải bản cập nhật</Text>
            {ota.notes ? <Text style={s.notes}>{ota.notes}</Text> : null}
            <Text style={s.hint}>Khởi động lại app để dùng bản mới (mất vài giây).</Text>
            <View style={s.row}>
              <Pressable style={[s.btn, s.btnGhost]} onPress={() => setOta(null)}>
                <Text style={s.btnGhostText}>Để sau</Text>
              </Pressable>
              <Pressable style={[s.btn, s.btnPrimary]} onPress={() => updater.restart()}>
                <Text style={s.btnPrimaryText}>Khởi động lại</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return null;
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 380, backgroundColor: colors.card, borderRadius: 20, padding: 22, alignItems: 'center' },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 19, fontWeight: '800', color: colors.text, textAlign: 'center' },
  version: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  notes: { fontSize: 14, color: colors.text, marginTop: 12, textAlign: 'center', lineHeight: 20 },
  hint: { fontSize: 13, color: colors.textMuted, marginTop: 12, textAlign: 'center', lineHeight: 19 },
  row: { flexDirection: 'row', gap: 10, marginTop: 20, width: '100%' },
  btn: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { fontSize: 15, fontWeight: '600', color: colors.text },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { fontSize: 15, fontWeight: '700', color: colors.primaryForeground },
  barTrack: { height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.primary },
  progressText: { fontSize: 13, color: colors.textMuted, marginTop: 6, textAlign: 'center' },
});
