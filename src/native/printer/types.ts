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
  /** In ảnh bitmap (base64 PNG) ở full width của giấy — dùng để in tiếng Việt có dấu */
  printImageBase64(base64: string): Promise<void>;
}
