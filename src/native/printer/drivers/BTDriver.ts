/**
 * BTDriver — Bluetooth ESC/POS cho máy in nhiệt ngoài (Xprinter, HOIN, EPPOS…).
 * Hoạt động trên bất kỳ Android POS nào, không cần SDK riêng.
 */
import { NativeModules } from 'react-native';
import type { IPrinterDriver, BluetoothDevice } from '../types';
import type { Order, ShopSettings } from '@/types/api';
import { renderInvoice, renderLabel, renderTest } from './escposRender';

const { BluetoothManager, BluetoothEscposPrinter } = NativeModules;

// ─── Helper: parse the JSON string returned by Java BT methods ───────────────
function parseBTResult(raw: unknown): { paired: BluetoothDevice[]; found: BluetoothDevice[] } {
  let result: { paired?: unknown; found?: unknown } = {};
  if (typeof raw === 'string') {
    try { result = JSON.parse(raw); } catch { /* ignore */ }
  } else if (raw && typeof raw === 'object') {
    result = raw as { paired?: unknown; found?: unknown };
  }
  const toDevices = (v: unknown): BluetoothDevice[] => {
    if (Array.isArray(v)) return v as BluetoothDevice[];
    if (typeof v === 'string') {
      try { return JSON.parse(v) as BluetoothDevice[]; } catch { return []; }
    }
    return [];
  };
  return { paired: toDevices(result.paired), found: toDevices(result.found) };
}

// ─── Scan helpers (exported for UI and auto-detect) ─────────────────────────

/**
 * Fast: returns only ALREADY-PAIRED (bonded) devices, resolves in <100ms.
 * Use for auto-detect on app startup — no active BT discovery needed.
 */
export async function getPairedBluetoothDevices(): Promise<BluetoothDevice[]> {
  if (!BluetoothManager) return [];
  try {
    const raw: unknown = await BluetoothManager.getPairedDevices();
    return parseBTResult(raw).paired;
  } catch {
    return [];
  }
}

/**
 * Full scan: paired devices + active BT discovery (~12s). Use in Settings UI.
 * Java resolves when discovery finishes; may be slower than 5s timeout.
 */
export async function scanBluetoothDevices(): Promise<{
  paired: BluetoothDevice[];
  found: BluetoothDevice[];
}> {
  if (!BluetoothManager) {
    return { paired: [], found: [] };
  }
  // Java side resolves with a JSON *string* like '{"paired":[...],"found":[...]}'
  const raw: unknown = await BluetoothManager.scanDevices();
  return parseBTResult(raw);
}

export async function connectBluetooth(address: string): Promise<void> {
  if (!BluetoothManager) throw new Error('BluetoothManager not available');
  await BluetoothManager.connect(address);
}

export async function isBluetoothEnabled(): Promise<boolean> {
  if (!BluetoothManager) return false;
  try {
    return await BluetoothManager.isBluetoothEnabled();
  } catch {
    return false;
  }
}

// ─── Driver class ─────────────────────────────────────────────────────────────
export class BTDriver implements IPrinterDriver {
  private device: BluetoothDevice;
  private _available = false;
  private _error: string | null = null;

  constructor(device: BluetoothDevice) {
    this.device = device;
  }

  async prepare(): Promise<boolean> {
    if (!BluetoothManager) {
      this._available = false;
      this._error = 'Module Bluetooth chưa được khởi tạo';
      return false;
    }
    try {
      await BluetoothManager.connect(this.device.address);
      this._available = true;
      this._error = null;
      return true;
    } catch (e: unknown) {
      this._available = false;
      this._error = e instanceof Error ? e.message : 'Không kết nối được máy in BT';
      return false;
    }
  }

  isAvailable(): boolean {
    return this._available;
  }

  getError(): string | null {
    return this._error;
  }

  reset(): void {
    this._available = false;
    this._error = null;
  }

  async printInvoice(order: Order, settings: ShopSettings): Promise<void> {
    await renderInvoice(BluetoothEscposPrinter, order, settings);
  }

  async printLabel(order: Order, settings: ShopSettings): Promise<void> {
    await renderLabel(BluetoothEscposPrinter, order, settings);
  }

  async printTest(): Promise<void> {
    await renderTest(BluetoothEscposPrinter, 'Bluetooth ESC/POS');
  }

  async printReceipt(fullB64: string): Promise<void> {
    // CHỈ 1 lệnh in ảnh (đã gồm barcode) → 1 tờ liền, không thể bị tách.
    // printPic tự ESC_Init nên KHÔNG gọi printerInit/align thừa (đỡ dư lề trên).
    await BluetoothEscposPrinter.printPic(fullB64, { width: 0, left: 0 });
  }
}
