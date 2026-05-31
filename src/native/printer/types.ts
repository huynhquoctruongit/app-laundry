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
   * In hoá đơn: barcode GỐC (sắc nét) ở đầu + toàn bộ phần còn lại là 1 ảnh
   * bitmap tiếng Việt có dấu. Chỉ 1 lệnh in ảnh → 1 tờ liền (không bị cắt giữa).
   *  - fullB64: ảnh toàn bộ hoá đơn (KHÔNG gồm barcode)
   *  - barcodeValue: mã để in barcode gốc (null = không in)
   */
  printReceipt(fullB64: string, barcodeValue: string | null): Promise<void>;
}
