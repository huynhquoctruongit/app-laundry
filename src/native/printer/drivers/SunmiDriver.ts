/**
 * SunmiDriver — dùng cho thiết bị Sunmi có máy in nhiệt tích hợp.
 * Giao tiếp qua AIDL service của Sunmi SDK.
 */
import type { IPrinterDriver } from '../types';
import {
  preparePrinter,
  isPrinterAvailable,
  getPrinterError,
  resetPrinterState,
  printInvoice,
  printLabel,
  printTest,
  printReceiptSunmi,
} from '../../SunmiPrinter';
import type { Order, ShopSettings } from '@/types/api';

export class SunmiDriver implements IPrinterDriver {
  async prepare(): Promise<boolean> {
    return preparePrinter();
  }

  isAvailable(): boolean {
    return isPrinterAvailable();
  }

  getError(): string | null {
    return getPrinterError();
  }

  reset(): void {
    resetPrinterState();
  }

  async printInvoice(order: Order, settings: ShopSettings): Promise<void> {
    return printInvoice(order, settings);
  }

  async printLabel(order: Order, settings: ShopSettings): Promise<void> {
    return printLabel(order, settings);
  }

  async printTest(): Promise<void> {
    return printTest();
  }

  async printReceipt(fullB64: string): Promise<void> {
    return printReceiptSunmi(fullB64);
  }
}
