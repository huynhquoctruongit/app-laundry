/**
 * BTDriver — Bluetooth ESC/POS cho máy in nhiệt ngoài (Xprinter, HOIN, EPPOS…).
 * Hoạt động trên bất kỳ Android POS nào, không cần SDK riêng.
 */
import { NativeModules } from 'react-native';
import type { IPrinterDriver, BluetoothDevice } from '../types';
import type { Order, ShopSettings } from '@/types/api';
import { calcInvoiceTotals } from '@/lib/invoice-totals';
import { calcLineTotal, formatCurrency } from '@/lib/utils';
import { BRAND_NAME } from '@/helpers/constants/brand';

const { BluetoothManager, BluetoothEscposPrinter } = NativeModules;

// ─── Align constants ─────────────────────────────────────────────────────────
const ALIGN = { LEFT: 0, CENTER: 1, RIGHT: 2 } as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const LINE_WIDTH = 32;

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function twoCol(left: string, right: string, width = LINE_WIDTH): string {
  const pad = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(pad) + right;
}

/**
 * Chuyển chuỗi tiếng Việt về ASCII thuần để máy in ESC/POS không bị lỗi.
 * VD: "Nguyễn Văn A" → "Nguyen Van A", "25.000đ" → "25.000d"
 */
function toAscii(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ᷀-᷿⃐-⃿]/g, '') // remove combining diacritics
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^\x20-\x7E]/g, '?'); // any remaining non-printable-ASCII → ?
}

/** Currency không có ký tự đ (máy in không in được) */
function fmtPrice(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'd';
}

/** Map font-size number → ESC/POS size multiplier {w, h} */
function sizeOf(fontSize: number): { widthtimes: number; heigthtimes: number } {
  if (fontSize >= 30) return { widthtimes: 1, heigthtimes: 1 }; // 2×
  if (fontSize >= 26) return { widthtimes: 0, heigthtimes: 1 }; // tall
  return { widthtimes: 0, heigthtimes: 0 };                      // normal
}

async function align(a: number) {
  await BluetoothEscposPrinter.printerAlign(a);
}

async function text(
  str: string,
  opts: { bold?: boolean; fontSize?: number } = {},
) {
  const { widthtimes, heigthtimes } = sizeOf(opts.fontSize ?? 22);
  // codepage=1 → gửi FS . (ASCII single-byte mode)
  // codepage=0 → gửi FS & (Chinese mode) → máy in bỏ qua ký tự 1-byte → trắng trơn
  if (opts.bold) { await BluetoothEscposPrinter.setBlob(1); }
  await BluetoothEscposPrinter.printText(toAscii(str) + '\n', {
    encoding: 'GBK',
    codepage: 1,
    widthtimes,
    heigthtimes,
    fonttype: 0,
  });
  if (opts.bold) { await BluetoothEscposPrinter.setBlob(0); }
}

async function divider() {
  await BluetoothEscposPrinter.printText('-'.repeat(LINE_WIDTH) + '\n', {
    encoding: 'GBK', codepage: 1, widthtimes: 0, heigthtimes: 0, fonttype: 0,
  });
}

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
    await BluetoothEscposPrinter.printerInit();

    // ── 1. Shop header ──
    if (settings.invoiceShowShopName) {
      await align(ALIGN.CENTER);
      await text((settings.shopName || BRAND_NAME).toUpperCase(), { bold: true, fontSize: 32 });
    }
    if (settings.invoiceShowAddress && settings.address) {
      await align(ALIGN.CENTER);
      await text(settings.address, { fontSize: 22 });
    }
    if (settings.invoiceShowPhone && settings.phone) {
      await align(ALIGN.CENTER);
      await text(settings.phone, { bold: true, fontSize: 22 });
    }
    if (settings.invoiceShowWebsite && settings.website) {
      await align(ALIGN.CENTER);
      await text(settings.website, { fontSize: 20 });
    }

    await divider();

    // ── 2. HÓA ĐƠN title ──
    await align(ALIGN.CENTER);
    await text('HOA DON', { bold: true, fontSize: 30 });
    const d = new Date(order.createdAt);
    const dateStr = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    await text(`${order.code}  ${dateStr}`, { fontSize: 20 });

    // ── 3. Ship tag ──
    if (order.fromBooking) {
      await align(ALIGN.CENTER);
      await text('[ GIAO HANG TAN NOI ]', { bold: true, fontSize: 26 });
    }

    // ── 4. Barcode ──
    if (settings.invoiceShowBarcode) {
      await align(ALIGN.CENTER);
      // CODE128 Format-2 (GS k 73 n d1..dk): data phải bắt đầu bằng {B (Code Set B)
      await BluetoothEscposPrinter.printBarCode(
        order.code,
        73,   // CODE128 = 73 (0x49)
        2,    // module width (2 dots)
        80,   // height (80 dots)
        0,    // HRI font
        2,    // HRI position: below barcode
      );
    }

    await divider();

    // ── 5. Customer ──
    await align(ALIGN.CENTER);
    await text('KHACH HANG', { fontSize: 20 });
    const nameFontSize = Math.max(28, (settings.customerNameFontSize ?? 22) + 6);
    await text(order.customer?.name ?? '-', { bold: true, fontSize: nameFontSize });

    if (order.note) {
      await align(ALIGN.LEFT);
      await text('Ghi chu: ' + order.note, { fontSize: 22 });
    }
    if (order.customer?.phone) {
      await align(ALIGN.LEFT);
      await text('SDT: ' + order.customer.phone, { fontSize: 22 });
    }
    if (order.customer?.address) {
      await align(ALIGN.LEFT);
      await text('DC: ' + order.customer.address, { fontSize: 22 });
    }

    await divider();

    // ── 6. Items ──
    const { subtotal, shippingFee, discount, grandTotal } = calcInvoiceTotals(order, settings);

    await align(ALIGN.LEFT);
    await BluetoothEscposPrinter.printColumn(
      [16, 6, 10],
      [ALIGN.LEFT, ALIGN.CENTER, ALIGN.RIGHT],
      ['Dich vu', 'SL', 'T.Tien'],
      { encoding: 'GBK', codepage: 1, widthtimes: 0, heigthtimes: 0, fonttype: 1 },
    );
    await divider();

    for (let i = 0; i < order.items.length; i++) {
      const it = order.items[i];
      const sl = it.weight ? `${it.quantity}(${it.weight}kg)` : `${it.quantity}`;
      const price = fmtPrice(calcLineTotal(it));
      const name = toAscii(`${i + 1}.${it.name}`);
      if (name.length <= 16) {
        await BluetoothEscposPrinter.printColumn(
          [16, 6, 10],
          [ALIGN.LEFT, ALIGN.CENTER, ALIGN.RIGHT],
          [name, sl, price],
          { encoding: 'GBK', codepage: 1, widthtimes: 0, heigthtimes: 0, fonttype: 0 },
        );
      } else {
        await text(name, { fontSize: 22 });
        await BluetoothEscposPrinter.printColumn(
          [16, 6, 10],
          [ALIGN.LEFT, ALIGN.CENTER, ALIGN.RIGHT],
          ['', sl, price],
          { encoding: 'GBK', codepage: 1, widthtimes: 0, heigthtimes: 0, fonttype: 0 },
        );
      }
    }

    // Đơn booking: thêm dòng "Phi giao hang" vào bảng items
    if (order.fromBooking && shippingFee > 0) {
      await BluetoothEscposPrinter.printColumn(
        [16, 6, 10],
        [ALIGN.LEFT, ALIGN.CENTER, ALIGN.RIGHT],
        ['Phi giao hang', '1', fmtPrice(shippingFee)],
        { encoding: 'GBK', codepage: 1, widthtimes: 0, heigthtimes: 0, fonttype: 0 },
      );
    }

    await divider();

    // ── 7. Totals ──
    // Ship đã hiện trong items → totals chỉ cần: (Tam tinh nếu có discount) + Tong cong
    await align(ALIGN.LEFT);
    const displaySubtotal = subtotal + shippingFee; // tổng trước giảm giá (gồm cả ship)
    if (settings.invoiceShowDebt && discount > 0) {
      await text(twoCol('Tam tinh', fmtPrice(displaySubtotal)), { fontSize: 22 });
      await text(twoCol('Giam gia', '- ' + fmtPrice(discount)), { fontSize: 22 });
      await text(twoCol('TONG CONG', fmtPrice(grandTotal)), { bold: true, fontSize: 26 });
    } else {
      await text(twoCol('TONG CONG', fmtPrice(grandTotal)), { bold: true, fontSize: 26 });
    }

    // ── 8. QR (đặt lại đơn) ──
    if (settings.invoiceShowQR && order.qr?.url) {
      await divider();
      await align(ALIGN.CENTER);
      await text('GIAO NHAN DO TAI NHA', { bold: true, fontSize: 28 });
      await text('Quet ma QR de dat don', { fontSize: 22 });
      // size=200: tạo bitmap 200×200, đủ lớn để scan được trên giấy 58mm
      await BluetoothEscposPrinter.printQRCode(order.qr.url, 200, 0);
    }

    await divider();

    // ── 9. Footer ──
    await align(ALIGN.CENTER);
    if (settings.openingHours) {
      await text('Gio mo cua: ' + settings.openingHours, { fontSize: 22 });
    }
    await text('Cam on quy khach! Hen gap lai.', { fontSize: 22 });

    await BluetoothEscposPrinter.printText('\n\n\n', {
      encoding: 'GBK', codepage: 1, widthtimes: 0, heigthtimes: 0, fonttype: 0,
    });
    await BluetoothEscposPrinter.cutOnePoint();
  }

  async printLabel(order: Order, settings: ShopSettings): Promise<void> {
    await BluetoothEscposPrinter.printerInit();
    const template = settings.labelTemplate ||
      '{{shopName}}\nMa: {{code}}\nKH: {{customerName}}\nSDT: {{phone}}';
    const content = template
      .replace(/\{\{shopName\}\}/g, settings.shopName)
      .replace(/\{\{code\}\}/g, order.code)
      .replace(/\{\{customerName\}\}/g, order.customer?.name ?? '-')
      .replace(/\{\{phone\}\}/g, order.customer?.phone ?? '')
      .replace(/\{\{items\}\}/g, order.items.map((i) => `${i.name} x${i.quantity}`).join(', '));

    const fontSize = Math.max(24, (settings.labelFontSize ?? 22) + 8);
    for (const line of content.split('\n')) {
      await text(line, { bold: true, fontSize });
    }
    await BluetoothEscposPrinter.printText('\n\n\n', {
      encoding: 'GBK', codepage: 1, widthtimes: 0, heigthtimes: 0, fonttype: 0,
    });
    await BluetoothEscposPrinter.cutOnePoint();
  }

  async printTest(): Promise<void> {
    await BluetoothEscposPrinter.printerInit();
    await align(ALIGN.CENTER);
    await text('TEST IN HOA DON', { bold: true, fontSize: 32 });
    await text('Bluetooth ESC/POS', { fontSize: 24 });
    await divider();
    await text('Neu ban doc duoc dong nay,', { fontSize: 24 });
    await text('may in dang hoat dong tot.', { fontSize: 24 });
    await BluetoothEscposPrinter.printText('\n\n\n', {
      encoding: 'GBK', codepage: 1, widthtimes: 0, heigthtimes: 0, fonttype: 0,
    });
    await BluetoothEscposPrinter.cutOnePoint();
  }

  async printReceipt(fullB64: string, barcodeValue: string | null): Promise<void> {
    await BluetoothEscposPrinter.printerInit();
    await BluetoothEscposPrinter.printerAlign(ALIGN.CENTER);

    // Barcode GỐC (sắc nét) in TRƯỚC — KHÔNG cắt giữa chừng.
    if (barcodeValue) {
      await BluetoothEscposPrinter.printBarCode(
        barcodeValue,
        73,   // CODE128
        2,    // module width (2 dots)
        80,   // height
        0,    // HRI font
        2,    // HRI dưới mã vạch
      );
    }

    // Toàn bộ phần còn lại là 1 ảnh → chỉ 1 lệnh printPic → 1 tờ liền (printPic tự cắt 1 lần ở cuối)
    await BluetoothEscposPrinter.printPic(fullB64, { width: 0, left: 0 });
  }
}
