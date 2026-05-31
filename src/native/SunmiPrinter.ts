import { Platform } from 'react-native';
import { Buffer } from 'buffer';
import * as SunmiPrinterLibrary from '@mitsuharu/react-native-sunmi-printer-library';
import type { Order, ShopSettings } from '@/types/api';
import { calcInvoiceTotals } from '@/lib/invoice-totals';
import { calcLineTotal, formatCurrency } from '@/lib/utils';
import { BRAND_NAME } from '@/helpers/constants/brand';

// ─── Init ─────────────────────────────────────────────────────────────────────
let prepared = false;
let lastError: string | null = null;
let preparingPromise: Promise<boolean> | null = null;

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Máy in không phản hồi sau ${ms / 1000}s`)), ms),
    ),
  ]);
}

/**
 * Kết nối/khởi tạo máy in Sunmi. Luôn cho phép retry (không cache failure)
 * để khắc phục trường hợp service chưa sẵn sàng lúc app cold start.
 */
export async function preparePrinter(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    lastError = 'Chỉ hỗ trợ Android';
    return false;
  }
  if (prepared) return true;

  // Tránh gọi song song nhiều lần
  if (preparingPromise) return preparingPromise;

  preparingPromise = (async () => {
    try {
      await withTimeout(SunmiPrinterLibrary.prepare(), 6000);
      prepared = true;
      lastError = null;
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      lastError = msg || 'Không kết nối được máy in';
      // eslint-disable-next-line no-console
      console.warn('[Sunmi] preparePrinter failed:', msg);
      return false;
    } finally {
      preparingPromise = null;
    }
  })();

  return preparingPromise;
}

export function isPrinterAvailable(): boolean {
  return prepared;
}

export function getPrinterError(): string | null {
  return lastError;
}

/** Force reset: cho phép gọi từ Settings để bấm "Kết nối lại máy in" */
export function resetPrinterState(): void {
  prepared = false;
  lastError = null;
}

// ─── ESC/POS raw helpers (base64-encoded for sendRAWData) ────────────────────
function rawBase64(bytes: number[]): string {
  return Buffer.from(new Uint8Array(bytes)).toString('base64');
}

async function sendRaw(bytes: number[]) {
  await SunmiPrinterLibrary.sendRAWData(rawBase64(bytes));
}

// GS V — paper cut (0=full, 1=partial)
async function cutPaper(partial = false) {
  await sendRaw([0x1d, 0x56, partial ? 0x01 : 0x00]);
}

// ESC p m t1 t2 — open cash drawer (pin 2 of RJ12)
async function pulseDrawer() {
  await sendRaw([0x1b, 0x70, 0x00, 0x19, 0xfa]);
}

async function printCode128(text: string) {
  // width=2: với mã 17 ký tự (vd "LD-20260518-LGL9B") cần ~444 dots,
  // vừa khít giấy 80mm (576 dots). Width=3 sẽ tràn → in lỗi không quét được.
  // height=110: vạch cao thêm so với default 80 để scanner dễ đọc.
  await withTimeout(SunmiPrinterLibrary.printBarcode(text, 'CODE128', 110, 2, 'textUnderBarcode'), 6000);
}

// ─── Line formatting helpers ──────────────────────────────────────────────────
// Máy in nhiệt 58mm ở font size 22 ≈ 32 ký tự/dòng
// LINE_WIDTH phải khớp với số char thực tế để căn cột đúng
const LINE_WIDTH = 32;

/**
 * Bỏ dấu tiếng Việt → ASCII thuần để đảm bảo 1 char = 1 byte = 1 cột in.
 * Máy in nhiệt không hỗ trợ UTF-8 multi-byte → bắt buộc dùng ASCII.
 */
function removeAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/** In text — tự bỏ dấu để alignment cột luôn chính xác */
async function printVN(text: string) {
  await SunmiPrinterLibrary.printText(removeAccents(text));
}

function twoCol(left: string, right: string, width = LINE_WIDTH): string {
  const l = removeAccents(String(left));
  const r = removeAccents(String(right));
  const pad = Math.max(1, width - l.length - r.length);
  return l + ' '.repeat(pad) + r;
}

function threeCol(a: string, b: string, c: string, widths: [number, number, number] = [16, 6, 10]): string {
  const ra = removeAccents(a);
  const rb = removeAccents(b);
  const rc = removeAccents(c);
  const padR = (s: string, w: number) => (s.length >= w ? s.slice(0, w) : s + ' '.repeat(w - s.length));
  const padL = (s: string, w: number) => (s.length >= w ? s.slice(0, w) : ' '.repeat(w - s.length) + s);
  return padR(ra, widths[0]) + padL(rb, widths[1]) + padL(rc, widths[2]);
}

// Số tiền cho in nhiệt
function printMoney(value: number): string {
  return value.toLocaleString('vi-VN') + 'd';
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

async function divider(char = '-') {
  await SunmiPrinterLibrary.printText(char.repeat(LINE_WIDTH) + '\n');
}

/** Tag trên hoá đơn: đơn chuyển từ booking (đặt giao nhận qua QR) */
async function printDeliveryBookingTag(order: Order) {
  if (!order.fromBooking) return;

  const boxLine = '+' + '-'.repeat(LINE_WIDTH - 2) + '+';
  await SunmiPrinterLibrary.setAlignment('center');
  await SunmiPrinterLibrary.printText(boxLine + '\n');
  await SunmiPrinterLibrary.setTextStyle('bold', true);
  await SunmiPrinterLibrary.setFontSize(32);
  await SunmiPrinterLibrary.printText('* GIAO NHAN *\n');
  await SunmiPrinterLibrary.setTextStyle('bold', false);
  await SunmiPrinterLibrary.setFontSize(22);
  await SunmiPrinterLibrary.printText('Don dat qua ma QR\n');
  await SunmiPrinterLibrary.printText('Shipper di giao\n');
  if (order.booking?.code) {
    await SunmiPrinterLibrary.printText(order.booking.code + '\n');
  }
  if (order.pickupAt) {
    const d = new Date(order.pickupAt);
    const pickupStr =
      `Hen lay: ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ` +
      `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    await SunmiPrinterLibrary.printText(pickupStr + '\n');
  }
  await SunmiPrinterLibrary.printText(boxLine + '\n');
  await SunmiPrinterLibrary.lineWrap(1);
}

// ─── Print invoice ────────────────────────────────────────────────────────────
export async function printInvoice(order: Order, settings: ShopSettings): Promise<void> {
  if (!isPrinterAvailable()) {
    const ok = await preparePrinter();
    if (!ok) throw new Error('Máy in Sunmi không khả dụng');
  }

  await withTimeout(SunmiPrinterLibrary.enterPrinterBuffer(true), 5000);

  try {
    // ── 1. Shop name ──
    if (settings.invoiceShowShopName) {
      await SunmiPrinterLibrary.setAlignment('center');
      await SunmiPrinterLibrary.setTextStyle('bold', true);
      await SunmiPrinterLibrary.setFontSize(32);
      await SunmiPrinterLibrary.printText((settings.shopName || BRAND_NAME).toUpperCase() + '\n');
      await SunmiPrinterLibrary.setTextStyle('bold', false);
      await SunmiPrinterLibrary.setFontSize(24);
    }

    // ── 2. Address + phone ──
    if (settings.invoiceShowAddress && settings.address) {
      await SunmiPrinterLibrary.setAlignment('center');
      await SunmiPrinterLibrary.setFontSize(22);
      await SunmiPrinterLibrary.printText(settings.address + '\n');
    }
    if (settings.invoiceShowPhone && settings.phone) {
      await SunmiPrinterLibrary.setAlignment('center');
      await SunmiPrinterLibrary.setFontSize(22);
      await SunmiPrinterLibrary.setTextStyle('bold', true);
      await SunmiPrinterLibrary.printText(settings.phone + '\n');
      await SunmiPrinterLibrary.setTextStyle('bold', false);
    }
    if (settings.invoiceShowWebsite && settings.website) {
      await SunmiPrinterLibrary.setAlignment('center');
      await SunmiPrinterLibrary.setFontSize(20);
      await SunmiPrinterLibrary.printText(settings.website + '\n');
    }

    await SunmiPrinterLibrary.setFontSize(24);
    await divider('-');

    // ── 3. HÓA ĐƠN title ──
    await SunmiPrinterLibrary.setAlignment('center');
    await SunmiPrinterLibrary.setTextStyle('bold', true);
    await SunmiPrinterLibrary.setFontSize(30);
    await printVN('HÓA ĐƠN\n');
    await SunmiPrinterLibrary.setTextStyle('bold', false);
    await SunmiPrinterLibrary.setFontSize(22);
    const date = new Date(order.createdAt);
    const dateStr = `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
    await SunmiPrinterLibrary.printText(`${order.code}  ${dateStr}\n`);

    await printDeliveryBookingTag(order);

    // ── 4. Barcode ──
    if (settings.invoiceShowBarcode) {
      await SunmiPrinterLibrary.setAlignment('center');
      await SunmiPrinterLibrary.lineWrap(1);
      await printCode128(order.code);
      await SunmiPrinterLibrary.lineWrap(1);
    }

    await SunmiPrinterLibrary.setFontSize(24);
    await divider('-');

    // ── 5. Customer info ──
    await SunmiPrinterLibrary.setAlignment('center');
    await SunmiPrinterLibrary.setFontSize(20);
    await printVN('KHÁCH HÀNG\n');

    await SunmiPrinterLibrary.setTextStyle('bold', true);
    const customerFontSize = Math.max(28, (settings.customerNameFontSize ?? 22) + 6);
    await SunmiPrinterLibrary.setFontSize(customerFontSize);
    await printVN((order.customer?.name ?? '-') + '\n');
    await SunmiPrinterLibrary.setTextStyle('bold', false);
    await SunmiPrinterLibrary.setFontSize(22);

    if (order.note) {
      await SunmiPrinterLibrary.setAlignment('left');
      await printVN('Ghi chú: ' + order.note + '\n');
    }
    if (order.customer?.phone) {
      await SunmiPrinterLibrary.setAlignment('left');
      await SunmiPrinterLibrary.printText('SDT: ' + order.customer.phone + '\n');
    }
    if (order.customer?.address) {
      await SunmiPrinterLibrary.setAlignment('left');
      await SunmiPrinterLibrary.printText('DC: ' + order.customer.address + '\n');
    }

    await SunmiPrinterLibrary.setFontSize(24);
    await divider('-');

    // ── 6. Items table ──
    await SunmiPrinterLibrary.setAlignment('left');
    await SunmiPrinterLibrary.setTextStyle('bold', true);
    await SunmiPrinterLibrary.setFontSize(22);
    await printVN(threeCol('Dịch vụ', 'SL', 'Thành tiền') + '\n');
    await SunmiPrinterLibrary.setTextStyle('bold', false);
    await divider('-');

    await SunmiPrinterLibrary.setFontSize(22);
    await SunmiPrinterLibrary.setAlignment('left');
    for (let i = 0; i < order.items.length; i++) {
      const it = order.items[i];
      const sl = it.weight ? `${it.quantity}(${it.weight}kg)` : `${it.quantity}`;
      const subtotal = calcLineTotal(it);
      const nameLine = removeAccents(`${i + 1}.${it.name}`);
      if (nameLine.length <= 16) {
        await printVN(threeCol(nameLine, sl, printMoney(subtotal)) + '\n');
      } else {
        await printVN(nameLine + '\n');
        await printVN(threeCol('', sl, printMoney(subtotal)) + '\n');
      }
    }

    await SunmiPrinterLibrary.setFontSize(24);
    await divider('-');

    // ── 7. Totals ──
    const { subtotal, shippingFee, discount, grandTotal } = calcInvoiceTotals(order, settings);
    await SunmiPrinterLibrary.setAlignment('left');
    await SunmiPrinterLibrary.setFontSize(22);
    await printVN(twoCol(shippingFee > 0 ? 'Tạm tính' : 'TỔNG CỘNG', printMoney(subtotal)) + '\n');
    if (shippingFee > 0) {
      await printVN(twoCol('Phí ship', '+ ' + printMoney(shippingFee)) + '\n');
    }
    if (settings.invoiceShowDebt && discount > 0) {
      await printVN(twoCol('Giảm giá', '- ' + printMoney(discount)) + '\n');
    }
    if (shippingFee > 0 || (settings.invoiceShowDebt && discount > 0)) {
      await SunmiPrinterLibrary.setTextStyle('bold', true);
      await SunmiPrinterLibrary.setFontSize(26);
      await printVN(twoCol('TỔNG CỘNG', printMoney(grandTotal)) + '\n');
      await SunmiPrinterLibrary.setTextStyle('bold', false);
    } else {
      await SunmiPrinterLibrary.setTextStyle('bold', true);
      await SunmiPrinterLibrary.setFontSize(24);
      await printVN(twoCol('TỔNG CỘNG', printMoney(subtotal)) + '\n');
      await SunmiPrinterLibrary.setTextStyle('bold', false);
    }

    // ── 8. QR Code (viền chữ, không tô nền — in nhiệt trắng đen) ──
    if (settings.invoiceShowQR && order.qr?.url) {
      const boxLine = '+' + '-'.repeat(LINE_WIDTH - 2) + '+';
      await SunmiPrinterLibrary.setFontSize(24);
      await divider('-');
      await SunmiPrinterLibrary.setAlignment('center');
      await SunmiPrinterLibrary.printText(boxLine + '\n');
      await SunmiPrinterLibrary.setTextStyle('bold', true);
      await SunmiPrinterLibrary.setFontSize(28);
      await SunmiPrinterLibrary.printText('DICH VU GIAO NHAN\n');
      await SunmiPrinterLibrary.printText('DO TAI NHA\n');
      await SunmiPrinterLibrary.setTextStyle('bold', false);
      await SunmiPrinterLibrary.setFontSize(22);
      await SunmiPrinterLibrary.printText('Quet ma va dat don\n');
      await SunmiPrinterLibrary.printText('Khong can lam gi them\n');
      await SunmiPrinterLibrary.printText('Chi nhap 1 lan duy nhat\n');
      await SunmiPrinterLibrary.lineWrap(1);
      await withTimeout(SunmiPrinterLibrary.printQRCode(order.qr.url, 10, 'middle'), 8000);
      await SunmiPrinterLibrary.lineWrap(1);
      await SunmiPrinterLibrary.printText(boxLine + '\n');
      await divider('-');
    } else {
      await divider('-');
    }

    // ── 9. Footer ──
    await SunmiPrinterLibrary.setAlignment('center');
    await SunmiPrinterLibrary.setFontSize(22);
    if (settings.openingHours) {
      await SunmiPrinterLibrary.printText('Gio mo cua: ' + settings.openingHours + '\n');
    }
    await SunmiPrinterLibrary.printText('Cam on quy khach! Hen gap lai.\n');
    await SunmiPrinterLibrary.lineWrap(3);

    // Commit the buffer — thường là lệnh tốn thời gian nhất, cần timeout riêng
    await withTimeout(SunmiPrinterLibrary.commitPrinterBuffer(), 15000);
  } catch (e) {
    await SunmiPrinterLibrary.exitPrinterBuffer(false);
    throw e;
  }

  // cutPaper dùng sendRAWData — bypass buffer, chạy ngay sau khi buffer committed
  await withTimeout(cutPaper(false), 4000);
}

// ─── Print label (small sticker) ──────────────────────────────────────────────
export async function printLabel(order: Order, settings: ShopSettings): Promise<void> {
  if (!isPrinterAvailable()) {
    const ok = await preparePrinter();
    if (!ok) throw new Error('Máy in không khả dụng');
  }

  const template = settings.labelTemplate || '{{shopName}}\nMã: {{code}}\nKH: {{customerName}}\nSĐT: {{phone}}';
  const content = template
    .replace(/\{\{shopName\}\}/g, settings.shopName)
    .replace(/\{\{code\}\}/g, order.code)
    .replace(/\{\{customerName\}\}/g, order.customer?.name ?? '—')
    .replace(/\{\{phone\}\}/g, order.customer?.phone ?? '')
    .replace(/\{\{items\}\}/g, order.items.map((i) => `${i.name} x${i.quantity}`).join(', '));

  await withTimeout(SunmiPrinterLibrary.enterPrinterBuffer(true), 5000);
  try {
    await SunmiPrinterLibrary.setAlignment('left');
    await SunmiPrinterLibrary.setTextStyle('bold', true);
    await SunmiPrinterLibrary.setFontSize(Math.max(24, settings.labelFontSize + 8));
    await SunmiPrinterLibrary.printText(content + '\n');
    await SunmiPrinterLibrary.setTextStyle('bold', false);
    await SunmiPrinterLibrary.lineWrap(2);
    await withTimeout(SunmiPrinterLibrary.commitPrinterBuffer(), 15000);
  } catch (e) {
    await SunmiPrinterLibrary.exitPrinterBuffer(false);
    throw e;
  }

  await withTimeout(cutPaper(false), 4000);
}

// ─── Open cash drawer (RJ12) ──────────────────────────────────────────────────
export async function openCashDrawer(): Promise<void> {
  if (!isPrinterAvailable()) {
    const ok = await preparePrinter();
    if (!ok) return;
  }
  await pulseDrawer();
}

// ─── Built-in QR scan (Sunmi T2 doesn't have rear cam scanner — falls back) ──
export async function scanQRCode(): Promise<string | null> {
  if (!isPrinterAvailable()) {
    const ok = await preparePrinter();
    if (!ok) return null;
  }
  try {
    const result = await SunmiPrinterLibrary.scan();
    return result || null;
  } catch {
    return null;
  }
}

// ─── Print test page ──────────────────────────────────────────────────────────
export async function printTest(): Promise<void> {
  if (!isPrinterAvailable()) {
    const ok = await preparePrinter();
    if (!ok) throw new Error('Máy in không khả dụng');
  }

  await withTimeout(SunmiPrinterLibrary.enterPrinterBuffer(true), 5000);
  try {
    await SunmiPrinterLibrary.setAlignment('center');
    await SunmiPrinterLibrary.setTextStyle('bold', true);
    await SunmiPrinterLibrary.setFontSize(32);
    await SunmiPrinterLibrary.printText('TEST IN HÓA ĐƠN\n');
    await SunmiPrinterLibrary.setTextStyle('bold', false);
    await SunmiPrinterLibrary.setFontSize(24);
    await SunmiPrinterLibrary.printText('Sunmi T2 — 80mm thermal\n');
    await divider('-');
    await SunmiPrinterLibrary.printText('Nếu bạn đọc được dòng này,\n');
    await SunmiPrinterLibrary.printText('máy in đang hoạt động bình thường.\n');
    await SunmiPrinterLibrary.lineWrap(3);
    await withTimeout(SunmiPrinterLibrary.commitPrinterBuffer(), 15000);
  } catch (e) {
    await SunmiPrinterLibrary.exitPrinterBuffer(false);
    throw e;
  }

  await withTimeout(cutPaper(false), 4000);
}
