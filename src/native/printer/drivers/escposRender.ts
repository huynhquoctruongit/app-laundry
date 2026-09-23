/**
 * Logic build nội dung hoá đơn ESC/POS dạng text (ASCII), dùng chung cho mọi
 * transport (Bluetooth, USB...) miễn là backend cung cấp đúng bộ API của
 * NativeModules.BluetoothEscposPrinter (printerInit/printerAlign/setBlob/
 * printText/printColumn/printBarCode/cutOnePoint).
 */
import type { Order, ShopSettings } from '@/types/api';
import { calcInvoiceTotals } from '@/lib/invoice-totals';
import { calcLineTotal } from '@/lib/utils';
import { BRAND_NAME } from '@/helpers/constants/brand';

export interface EscPosBackend {
  printerInit(): Promise<void>;
  printerAlign(align: number): Promise<void>;
  setBlob(weight: number): Promise<void>;
  printText(text: string, options: Record<string, unknown>): Promise<void>;
  printColumn(
    widths: number[],
    aligns: number[],
    texts: string[],
    options: Record<string, unknown>,
  ): Promise<void>;
  printBarCode(
    str: string,
    nType: number,
    nWidthX: number,
    nHeight: number,
    nHriFontType: number,
    nHriFontPosition: number,
  ): Promise<void>;
  cutOnePoint(): Promise<void>;
}

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

async function align(backend: EscPosBackend, a: number) {
  await backend.printerAlign(a);
}

async function text(
  backend: EscPosBackend,
  str: string,
  opts: { bold?: boolean; fontSize?: number } = {},
) {
  const { widthtimes, heigthtimes } = sizeOf(opts.fontSize ?? 22);
  if (opts.bold) { await backend.setBlob(1); }
  await backend.printText(toAscii(str) + '\n', {
    encoding: 'GBK',
    codepage: 1,
    widthtimes,
    heigthtimes,
    fonttype: 0,
  });
  if (opts.bold) { await backend.setBlob(0); }
}

async function divider(backend: EscPosBackend) {
  await backend.printText('-'.repeat(LINE_WIDTH) + '\n', {
    encoding: 'GBK', codepage: 1, widthtimes: 0, heigthtimes: 0, fonttype: 0,
  });
}

export async function renderInvoice(backend: EscPosBackend, order: Order, settings: ShopSettings): Promise<void> {
  await backend.printerInit();

  // ── 1. Shop header ──
  if (settings.invoiceShowShopName) {
    await align(backend, ALIGN.CENTER);
    await text(backend, (settings.shopName || BRAND_NAME).toUpperCase(), { bold: true, fontSize: 32 });
  }
  if (settings.invoiceShowAddress && settings.address) {
    await align(backend, ALIGN.CENTER);
    await text(backend, settings.address, { fontSize: 22 });
  }
  if (settings.invoiceShowPhone && settings.phone) {
    await align(backend, ALIGN.CENTER);
    await text(backend, settings.phone, { bold: true, fontSize: 22 });
  }
  if (settings.invoiceShowWebsite && settings.website) {
    await align(backend, ALIGN.CENTER);
    await text(backend, settings.website, { fontSize: 20 });
  }

  await divider(backend);

  // ── 2. HÓA ĐƠN title ──
  await align(backend, ALIGN.CENTER);
  await text(backend, 'HOA DON', { bold: true, fontSize: 30 });
  const d = new Date(order.createdAt);
  const dateStr = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  await text(backend, `${order.code}  ${dateStr}`, { fontSize: 20 });

  // ── 3. Ship tag ──
  if (order.fromBooking) {
    await align(backend, ALIGN.CENTER);
    await text(backend, '[ GIAO HANG TAN NOI ]', { bold: true, fontSize: 26 });
  }

  // ── 4. Barcode ──
  if (settings.invoiceShowBarcode) {
    await align(backend, ALIGN.CENTER);
    // CODE128 Format-2 (GS k 73 n d1..dk): data phải bắt đầu bằng {B (Code Set B)
    await backend.printBarCode(
      order.code,
      73,   // CODE128 = 73 (0x49)
      2,    // module width (2 dots)
      80,   // height (80 dots)
      0,    // HRI font
      2,    // HRI position: below barcode
    );
  }

  await divider(backend);

  // ── 5. Customer ──
  await align(backend, ALIGN.CENTER);
  await text(backend, 'KHACH HANG', { fontSize: 20 });
  const nameFontSize = Math.max(28, (settings.customerNameFontSize ?? 22) + 6);
  await text(backend, order.customer?.name ?? '-', { bold: true, fontSize: nameFontSize });

  if (order.note) {
    await align(backend, ALIGN.LEFT);
    await text(backend, 'Ghi chu: ' + order.note, { fontSize: 22 });
  }
  if (order.customer?.phone) {
    await align(backend, ALIGN.LEFT);
    await text(backend, 'SDT: ' + order.customer.phone, { fontSize: 22 });
  }
  if (order.customer?.address) {
    await align(backend, ALIGN.LEFT);
    await text(backend, 'DC: ' + order.customer.address, { fontSize: 22 });
  }

  await divider(backend);

  // ── 6. Items ──
  const { subtotal, shippingFee, discount, grandTotal } = calcInvoiceTotals(order, settings);

  await align(backend, ALIGN.LEFT);
  await backend.printColumn(
    [16, 6, 10],
    [ALIGN.LEFT, ALIGN.CENTER, ALIGN.RIGHT],
    ['Dich vu', 'SL', 'T.Tien'],
    { encoding: 'GBK', codepage: 1, widthtimes: 0, heigthtimes: 0, fonttype: 1 },
  );
  await divider(backend);

  for (let i = 0; i < order.items.length; i++) {
    const it = order.items[i];
    const sl = it.weight ? `${it.quantity}(${it.weight}kg)` : `${it.quantity}`;
    const price = fmtPrice(calcLineTotal(it));
    const name = toAscii(`${i + 1}.${it.name}`);
    if (name.length <= 16) {
      await backend.printColumn(
        [16, 6, 10],
        [ALIGN.LEFT, ALIGN.CENTER, ALIGN.RIGHT],
        [name, sl, price],
        { encoding: 'GBK', codepage: 1, widthtimes: 0, heigthtimes: 0, fonttype: 0 },
      );
    } else {
      await text(backend, name, { fontSize: 22 });
      await backend.printColumn(
        [16, 6, 10],
        [ALIGN.LEFT, ALIGN.CENTER, ALIGN.RIGHT],
        ['', sl, price],
        { encoding: 'GBK', codepage: 1, widthtimes: 0, heigthtimes: 0, fonttype: 0 },
      );
    }
  }

  // Đơn booking: thêm dòng "Phi giao hang" vào bảng items
  if (order.fromBooking && shippingFee > 0) {
    await backend.printColumn(
      [16, 6, 10],
      [ALIGN.LEFT, ALIGN.CENTER, ALIGN.RIGHT],
      ['Phi giao hang', '1', fmtPrice(shippingFee)],
      { encoding: 'GBK', codepage: 1, widthtimes: 0, heigthtimes: 0, fonttype: 0 },
    );
  }

  await divider(backend);

  // ── 7. Totals ──
  // Ship đã hiện trong items → totals chỉ cần: (Tam tinh nếu có discount) + Tong cong
  await align(backend, ALIGN.LEFT);
  const displaySubtotal = subtotal + shippingFee; // tổng trước giảm giá (gồm cả ship)
  if (settings.invoiceShowDebt && discount > 0) {
    await text(backend, twoCol('Tam tinh', fmtPrice(displaySubtotal)), { fontSize: 22 });
    await text(backend, twoCol('Giam gia', '- ' + fmtPrice(discount)), { fontSize: 22 });
    await text(backend, twoCol('TONG CONG', fmtPrice(grandTotal)), { bold: true, fontSize: 26 });
  } else {
    await text(backend, twoCol('TONG CONG', fmtPrice(grandTotal)), { bold: true, fontSize: 26 });
  }

  // ── 8. Footer ──
  await divider(backend);
  await align(backend, ALIGN.CENTER);
  if (settings.openingHours) {
    await text(backend, 'Gio mo cua: ' + settings.openingHours, { fontSize: 22 });
  }
  await text(backend, 'Cam on quy khach! Hen gap lai.', { fontSize: 22 });

  // ── 9. Promo banner (thay cho mã QR) — đặt cuối bill ──
  await divider(backend);
  await align(backend, ALIGN.CENTER);
  await text(backend, 'VE SINH GIAY SACH', { bold: true, fontSize: 30 });
  await text(backend, 'GIAT TOPPER', { bold: true, fontSize: 30 });
  await text(backend, 'MEN DAY BAO SACH VA THOM', { bold: true, fontSize: 30 });

  await backend.printText('\n\n\n', {
    encoding: 'GBK', codepage: 1, widthtimes: 0, heigthtimes: 0, fonttype: 0,
  });
  await backend.cutOnePoint();
}

export async function renderLabel(backend: EscPosBackend, order: Order, settings: ShopSettings): Promise<void> {
  await backend.printerInit();
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
    await text(backend, line, { bold: true, fontSize });
  }
  await backend.printText('\n\n\n', {
    encoding: 'GBK', codepage: 1, widthtimes: 0, heigthtimes: 0, fonttype: 0,
  });
  await backend.cutOnePoint();
}

export async function renderTest(backend: EscPosBackend, transportLabel: string): Promise<void> {
  await backend.printerInit();
  await align(backend, ALIGN.CENTER);
  await text(backend, 'TEST IN HOA DON', { bold: true, fontSize: 32 });
  await text(backend, transportLabel, { fontSize: 24 });
  await divider(backend);
  await text(backend, 'Neu ban doc duoc dong nay,', { fontSize: 24 });
  await text(backend, 'may in dang hoat dong tot.', { fontSize: 24 });
  await backend.printText('\n\n\n', {
    encoding: 'GBK', codepage: 1, widthtimes: 0, heigthtimes: 0, fonttype: 0,
  });
  await backend.cutOnePoint();
}
