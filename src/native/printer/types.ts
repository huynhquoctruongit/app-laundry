import type { Order, ShopSettings } from '@/types/api';

export type PrinterType = 'sunmi' | 'bluetooth' | 'none';

export interface BluetoothDevice {
  name: string;
  address: string;
}

export interface PrinterLocalConfig {
  type: PrinterType;
  bt?: BluetoothDevice;
}

export interface IPrinterDriver {
  prepare(): Promise<boolean>;
  isAvailable(): boolean;
  getError(): string | null;
  reset(): void;
  printInvoice(order: Order, settings: ShopSettings): Promise<void>;
  printLabel(order: Order, settings: ShopSettings): Promise<void>;
  printTest(): Promise<void>;
  /**
   * In hoá đơn dưới dạng 1 ảnh bitmap DUY NHẤT (gồm cả barcode) → 1 lệnh in,
   * 1 tờ liền, KHÔNG thể bị tách. fullB64 = ảnh toàn bộ hoá đơn.
   */
  printReceipt(fullB64: string): Promise<void>;
}
