/**
 * PrinterService — singleton dùng chung cho toàn app.
 *
 * Thứ tự auto-detect:
 *   1. Thử Sunmi AIDL (2s timeout) — thành công trên Sunmi device
 *   2. Nếu có BT printer đã lưu → auto reconnect
 *   3. Nếu không có gì → status 'none', chờ user thiết lập
 */
import DeviceInfo from 'react-native-device-info';
import type { IPrinterDriver, PrinterType, BluetoothDevice } from './types';
import { SunmiDriver } from './drivers/SunmiDriver';
import { BTDriver, scanBluetoothDevices, getPairedBluetoothDevices } from './drivers/BTDriver';
import { loadPrinterConfig, savePrinterConfig, clearPrinterConfig } from './localConfig';

// Từ khoá nhận diện tên máy in Bluetooth (case-insensitive)
const PRINTER_NAME_HINTS = [
  'innerprinter', 'printer', 'print', 'thermal',
  'receipt', 'pos', 'xprinter', 'hoin', 'eppos',
  'zjiang', 'goojprt', 'sewoo', 'star', 'epson',
];

function looksLikePrinter(name: string): boolean {
  const lower = name.toLowerCase();
  return PRINTER_NAME_HINTS.some((hint) => lower.includes(hint));
}

type DetectStatus = 'idle' | 'detecting' | 'ready' | 'none';

// ─── Internal state ───────────────────────────────────────────────────────────
let driver: IPrinterDriver | null = null;
let printerType: PrinterType = 'none';
let detectStatus: DetectStatus = 'idle';
let detectError: string | null = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms),
    ),
  ]);
}

// ─── Auto-detect ─────────────────────────────────────────────────────────────
async function tryAutoDetect(): Promise<void> {
  detectStatus = 'detecting';
  detectError = null;

  // Step 1: nếu là Sunmi device → ưu tiên Sunmi driver
  let manufacturer = '';
  try {
    manufacturer = (await DeviceInfo.getManufacturer()).toLowerCase();
  } catch { /* ignore */ }

  const isSunmi = manufacturer.includes('sunmi');

  if (isSunmi) {
    const sunmi = new SunmiDriver();
    try {
      const ok = await timeout(sunmi.prepare(), 3000);
      if (ok) {
        driver = sunmi;
        printerType = 'sunmi';
        detectStatus = 'ready';
        return;
      }
    } catch { /* fall through */ }
  } else {
    // Thử Sunmi nhanh dù không phải Sunmi brand (một số máy clone dùng cùng SDK)
    const sunmi = new SunmiDriver();
    try {
      const ok = await timeout(sunmi.prepare(), 2000);
      if (ok) {
        driver = sunmi;
        printerType = 'sunmi';
        detectStatus = 'ready';
        return;
      }
    } catch { /* fall through */ }
  }

  // Step 2: BT printer đã lưu từ lần trước → reconnect (retry tối đa 3 lần)
  const saved = await loadPrinterConfig();
  if (saved?.type === 'bluetooth' && saved.bt) {
    let connected = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      // Lần 2+ chờ BT stack Android khởi động xong
      if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
      const bt = new BTDriver(saved.bt);
      const ok = await bt.prepare();
      if (ok) {
        driver = bt;
        printerType = 'bluetooth';
        detectStatus = 'ready';
        connected = true;
        break;
      }
      detectError = bt.getError();
    }
    if (connected) return;
  }

  // Step 3: Lấy danh sách thiết bị BT đã ghép đôi (fast, không cần discovery).
  // Tìm thiết bị có tên giống máy in (vd "InnerPrinter", "Xprinter"…).
  try {
    const paired = await getPairedBluetoothDevices();
    const printerDevice = paired.find((d) => looksLikePrinter(d.name ?? ''));
    if (printerDevice) {
      const bt = new BTDriver(printerDevice);
      const ok = await bt.prepare();
      if (ok) {
        driver = bt;
        printerType = 'bluetooth';
        detectStatus = 'ready';
        // Lưu lại để lần sau khỏi scan lại
        await savePrinterConfig({ type: 'bluetooth', bt: printerDevice });
        return;
      }
      detectError = bt.getError();
    }
  } catch { /* BT không khả dụng hoặc quyền bị từ chối */ }

  // Step 4: không tìm thấy gì
  driver = null;
  printerType = 'none';
  detectStatus = 'none';
}

// ─── Public API ───────────────────────────────────────────────────────────────
export const PrinterService = {
  /** Gọi 1 lần khi app start */
  async autoDetect(): Promise<void> {
    if (detectStatus === 'detecting') return;
    await tryAutoDetect();
  },

  /** Kết nối BT printer mới, lưu config */
  async connectBluetooth(device: BluetoothDevice): Promise<boolean> {
    const bt = new BTDriver(device);
    const ok = await bt.prepare();
    if (ok) {
      driver = bt;
      printerType = 'bluetooth';
      detectStatus = 'ready';
      detectError = null;
      await savePrinterConfig({ type: 'bluetooth', bt: device });
    } else {
      detectError = bt.getError();
    }
    return ok;
  },

  /** Reset về Sunmi và thử lại */
  async retryAsSunmi(): Promise<boolean> {
    const sunmi = new SunmiDriver();
    const ok = await sunmi.prepare();
    if (ok) {
      driver = sunmi;
      printerType = 'sunmi';
      detectStatus = 'ready';
      detectError = null;
      await savePrinterConfig({ type: 'sunmi' });
    } else {
      detectError = sunmi.getError();
    }
    return ok;
  },

  /** Xoá config BT và reset */
  async forgetBluetooth(): Promise<void> {
    await clearPrinterConfig();
    driver = null;
    printerType = 'none';
    detectStatus = 'none';
    detectError = null;
  },

  // ─── Status ───────────────────────────────────────────────────────────────
  getType(): PrinterType { return printerType; },
  getStatus(): DetectStatus { return detectStatus; },
  getError(): string | null { return driver?.getError() ?? detectError; },
  isReady(): boolean { return detectStatus === 'ready' && driver !== null; },
  isDetecting(): boolean { return detectStatus === 'detecting'; },

  // ─── Print ────────────────────────────────────────────────────────────────
  async prepare(): Promise<boolean> {
    if (!driver) return false;
    if (driver.isAvailable()) return true;
    return driver.prepare();
  },

  async printInvoice(
    order: Parameters<IPrinterDriver['printInvoice']>[0],
    settings: Parameters<IPrinterDriver['printInvoice']>[1],
  ): Promise<void> {
    if (!driver) throw new Error('Chưa kết nối máy in');
    if (!driver.isAvailable()) {
      const ok = await driver.prepare();
      if (!ok) throw new Error(driver.getError() ?? 'Không kết nối được máy in');
    }
    return driver.printInvoice(order, settings);
  },

  async printLabel(
    order: Parameters<IPrinterDriver['printLabel']>[0],
    settings: Parameters<IPrinterDriver['printLabel']>[1],
  ): Promise<void> {
    if (!driver) throw new Error('Chưa kết nối máy in');
    if (!driver.isAvailable()) {
      const ok = await driver.prepare();
      if (!ok) throw new Error(driver.getError() ?? 'Không kết nối được máy in');
    }
    return driver.printLabel(order, settings);
  },

  async printTest(): Promise<void> {
    if (!driver) throw new Error('Chưa kết nối máy in');
    if (!driver.isAvailable()) {
      const ok = await driver.prepare();
      if (!ok) throw new Error(driver.getError() ?? 'Không kết nối được máy in');
    }
    return driver.printTest();
  },
};
