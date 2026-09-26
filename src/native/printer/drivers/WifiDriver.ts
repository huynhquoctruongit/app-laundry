/**
 * WifiDriver — máy in nhiệt ESC/POS qua WiFi (TCP RAW/JetDirect, cổng 9100),
 * dùng module native RNWifiPrinter (java.net.Socket). Cùng bộ lệnh ESC/POS
 * với BT/USB nên tái dùng chung logic build hoá đơn ở escposRender.ts.
 */
import { NativeModules } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import type { IPrinterDriver, WifiDevice } from '../types';
import type { Order, ShopSettings } from '@/types/api';
import { renderInvoice, renderLabel, renderTest } from './escposRender';

const { RNWifiPrinter } = NativeModules;

const DEFAULT_PORT = 9100;

// ─── Helpers (exported for UI) ────────────────────────────────────────────────
/** Quét dải mạng LAN /24 của thiết bị (dựa vào IP WiFi hiện tại) tìm máy in RAW/JetDirect. */
export async function scanWifiPrinters(): Promise<WifiDevice[]> {
  if (!RNWifiPrinter) return [];
  const ip = await DeviceInfo.getIpAddress().catch(() => '');
  if (!ip || ip === '0.0.0.0') {
    throw new Error('Chưa kết nối WiFi — kết nối WiFi rồi thử lại');
  }
  const prefix = ip.split('.').slice(0, 3).join('.') + '.';
  try {
    const devices: WifiDevice[] = await RNWifiPrinter.scanNetwork(prefix, DEFAULT_PORT);
    return devices ?? [];
  } catch {
    return [];
  }
}

// ─── Driver class ─────────────────────────────────────────────────────────────
export class WifiDriver implements IPrinterDriver {
  private device: WifiDevice;
  private _available = false;
  private _error: string | null = null;

  constructor(device: WifiDevice) {
    this.device = device;
  }

  async prepare(): Promise<boolean> {
    if (!RNWifiPrinter) {
      this._available = false;
      this._error = 'Module WiFi chưa được khởi tạo';
      return false;
    }
    try {
      const connected = await RNWifiPrinter.connect(this.device.ip, this.device.port);
      if (!connected) {
        this._available = false;
        this._error = 'Không kết nối được máy in WiFi';
        return false;
      }
      this._available = true;
      this._error = null;
      return true;
    } catch (e: unknown) {
      this._available = false;
      this._error = e instanceof Error ? e.message : 'Không kết nối được máy in WiFi';
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
    await renderInvoice(RNWifiPrinter, order, settings);
  }

  async printLabel(order: Order, settings: ShopSettings): Promise<void> {
    await renderLabel(RNWifiPrinter, order, settings);
  }

  async printTest(): Promise<void> {
    await renderTest(RNWifiPrinter, 'WiFi ESC/POS');
  }

  async printReceipt(fullB64: string): Promise<void> {
    await RNWifiPrinter.printPic(fullB64, { width: 0, left: 0 });
  }
}
