import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

/**
 * Tự cập nhật app (Android) — file mô tả bản mới nhất nằm ở GitHub Release "updates"
 * của repo app-laundry, do `node scripts/release.js apk|ota` phát hành.
 */
export const UPDATE_MANIFEST_URL =
  'https://github.com/huynhquoctruongit/app-laundry/releases/download/updates/update.json';

export interface UpdateManifest {
  apk?: { versionCode: number; versionName: string; url: string; notes?: string } | null;
  ota?: { nativeVersion: number; bundleVersion: number; url: string; notes?: string } | null;
}

export interface AppVersionInfo {
  versionCode: number;
  versionName: string;
  /** Gói JS đang chạy (0 = gói gốc trong APK) */
  bundleVersion: number;
  /** Gói OTA đã tải, chờ mở lại app để áp dụng (0 = không có) */
  pendingBundleVersion: number;
  /** Gói OTA bị bỏ vì crash khi chạy thử — không tải lại */
  rolledBackVersion: number;
}

interface AppUpdaterNative {
  getInfo(): Promise<AppVersionInfo>;
  markSuccess(): Promise<void>;
  downloadBundle(url: string, version: number): Promise<void>;
  downloadApk(url: string): Promise<string>;
  installApk(path: string): Promise<void>;
  restart(): void;
}

const Native: AppUpdaterNative | undefined =
  Platform.OS === 'android' ? NativeModules.AppUpdater : undefined;

export const updaterAvailable = !!Native;

export const updater = {
  async getInfo(): Promise<AppVersionInfo | null> {
    return Native ? Native.getInfo() : null;
  },
  markSuccess: () => Native?.markSuccess().catch(() => {}),
  downloadBundle: (url: string, version: number) => Native!.downloadBundle(url, version),
  downloadApk: (url: string) => Native!.downloadApk(url),
  installApk: (path: string) => Native!.installApk(path),
  restart: () => Native?.restart(),
  onProgress(cb: (received: number, total: number) => void) {
    if (!Native) return () => {};
    const sub = new NativeEventEmitter(NativeModules.AppUpdater).addListener(
      'AppUpdaterProgress',
      (e: { received: number; total: number }) => cb(e.received, e.total),
    );
    return () => sub.remove();
  },
};

export async function fetchManifest(): Promise<UpdateManifest> {
  const res = await fetch(`${UPDATE_MANIFEST_URL}?t=${Date.now()}`, {
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export type UpdateCheck =
  | { kind: 'apk'; apk: NonNullable<UpdateManifest['apk']> }
  | { kind: 'ota'; ota: NonNullable<UpdateManifest['ota']> }
  | { kind: 'none' };

/** So sánh bản đang cài với manifest: APK mới ưu tiên hơn gói OTA. */
export function compareUpdate(info: AppVersionInfo, m: UpdateManifest): UpdateCheck {
  if (m.apk && m.apk.versionCode > info.versionCode) return { kind: 'apk', apk: m.apk };
  const ota = m.ota;
  if (
    ota &&
    ota.nativeVersion === info.versionCode &&
    ota.bundleVersion > info.bundleVersion &&
    ota.bundleVersion > info.pendingBundleVersion &&
    ota.bundleVersion !== info.rolledBackVersion
  ) {
    return { kind: 'ota', ota };
  }
  return { kind: 'none' };
}

export function formatVersion(info: AppVersionInfo | null): string {
  if (!info) return '';
  return `v${info.versionName} (${info.versionCode})${info.bundleVersion ? ` · bản ${info.bundleVersion}` : ''}`;
}
