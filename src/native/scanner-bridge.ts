/**
 * Bridge giữa global barcode scanner (App.tsx) và các màn hình muốn
 * override hành vi quét (vd: OrderAuditScreen).
 *
 * Khi một screen mount, nó gọi `setScannerOverride(handler)` để chiếm
 * quyền xử lý input từ máy quét. Khi unmount, gọi `setScannerOverride(null)`
 * để trả về flow mặc định (auto-complete đơn READY → DELIVERED).
 *
 * Bridge cũng expose việc bật/tắt scanner toàn cục để audit screen có
 * thể tự bật khi mở và khôi phục khi đóng.
 */

type ScannerHandler = (code: string) => void;

let currentHandler: ScannerHandler | null = null;
let activeSetter: ((on: boolean) => void) | null = null;
let activeGetter: (() => boolean) | null = null;

export function setScannerOverride(handler: ScannerHandler | null): void {
  currentHandler = handler;
}

export function getScannerOverride(): ScannerHandler | null {
  return currentHandler;
}

export function registerScannerToggle(
  setter: (on: boolean) => void,
  getter: () => boolean,
): void {
  activeSetter = setter;
  activeGetter = getter;
}

export function setScannerActive(on: boolean): void {
  activeSetter?.(on);
}

export function isScannerActive(): boolean {
  return activeGetter?.() ?? false;
}
