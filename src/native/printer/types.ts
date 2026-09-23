import type { Order, ShopSettings } from '@/types/api';

export type PrinterType = 'sunmi' | 'bluetooth' | 'usb' | 'none';

export interface BluetoothDevice {
  name: string;
  address: string;
}

export interface UsbDevice {
  deviceId: number;
  name: string;
  vendorId: number;
  productId: number;
}

export interface PrinterLocalConfig {
  type: PrinterType;
  bt?: BluetoothDevice;
  usb?: UsbDevice;
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
