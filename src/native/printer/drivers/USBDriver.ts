/**
 * USBDriver — máy in nhiệt ESC/POS cắm dây qua USB/OTG, dùng module native
 * RNUsbPrinter (android.hardware.usb.*). Cùng bộ lệnh ESC/POS với BTDriver
 * nên tái dùng chung logic build hoá đơn ở escposRender.ts.
 */
import { NativeModules } from 'react-native';
import type { IPrinterDriver, UsbDevice } from '../types';
import type { Order, ShopSettings } from '@/types/api';
import { renderInvoice, renderLabel, renderTest } from './escposRender';

const { RNUsbPrinter } = NativeModules;

// ─── Helpers (exported for UI) ────────────────────────────────────────────────
export async function listUsbDevices(): Promise<UsbDevice[]> {
  if (!RNUsbPrinter) return [];
  try {
    const devices: UsbDevice[] = await RNUsbPrinter.listDevices();
    return devices ?? [];
  } catch {
    return [];
  }
}

export async function requestUsbPermission(deviceId: number): Promise<boolean> {
  if (!RNUsbPrinter) return false;
  try {
    return await RNUsbPrinter.requestPermission(deviceId);
  } catch {
    return false;
  }
}

// ─── Driver class ─────────────────────────────────────────────────────────────
export class USBDriver implements IPrinterDriver {
  private device: UsbDevice;
  private _available = false;
  private _error: string | null = null;

  constructor(device: UsbDevice) {
    this.device = device;
  }

  async prepare(): Promise<boolean> {
    if (!RNUsbPrinter) {
      this._available = false;
      this._error = 'Module USB chưa được khởi tạo';
      return false;
    }
    try {
      const granted = await RNUsbPrinter.requestPermission(this.device.deviceId);
      if (!granted) {
        this._available = false;
        this._error = 'Không được cấp quyền truy cập máy in USB';
        return false;
      }
      const connected = await RNUsbPrinter.connect(this.device.deviceId);
      if (!connected) {
        this._available = false;
        this._error = 'Không kết nối được máy in USB';
        return false;
      }
      this._available = true;
      this._error = null;
      return true;
    } catch (e: unknown) {
      this._available = false;
      this._error = e instanceof Error ? e.message : 'Không kết nối được máy in USB';
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
    await renderInvoice(RNUsbPrinter, order, settings);
  }

  async printLabel(order: Order, settings: ShopSettings): Promise<void> {
    await renderLabel(RNUsbPrinter, order, settings);
  }

  async printTest(): Promise<void> {
    await renderTest(RNUsbPrinter, 'USB ESC/POS');
  }

  async printReceipt(fullB64: string): Promise<void> {
    await RNUsbPrinter.printPic(fullB64, { width: 0, left: 0 });
  }
}
