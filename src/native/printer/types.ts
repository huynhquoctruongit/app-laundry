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
   * In hoá đơn dạng 2 ảnh bitmap (tiếng Việt có dấu) + barcode GỐC xen giữa (sắc nét).
   *  - topB64: ảnh phần đầu (shop + tiêu đề + mã/ngày)
   *  - barcodeValue: mã để in barcode gốc (null = không in)
   *  - bottomB64: ảnh phần còn lại (khách → footer)
   */
  printReceiptParts(
    topB64: string,
    barcodeValue: string | null,
    bottomB64: string,
  ): Promise<void>;
}
