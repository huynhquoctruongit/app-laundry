export function formatCurrency(value: number | string | null | undefined): string {
  if (value == null) return '0đ';
  const n = typeof value === 'string' ? Number(value) : value;
  if (isNaN(n)) return '0đ';
  return n.toLocaleString('vi-VN') + 'đ';
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm} ${formatDate(d)}`;
}

export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '-';
  if (phone.length <= 4) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(-3);
}

// Tính thành tiền 1 dòng dịch vụ:
// - Có cân (kg) > 0 → cân × đơn giá × SL (giặt sấy tính theo kg)
// - Không có cân → SL × đơn giá (giặt khô tính theo cái)
// Khớp với lineTotal() ở backend (order.service.ts)
export function calcLineTotal(item: {
  quantity: number | string | null | undefined;
  unitPrice: number | string | null | undefined;
  weight?: number | string | null;
}): number {
  const qty = Number(item.quantity || 0);
  const price = Number(item.unitPrice || 0);
  const weight = Number(item.weight || 0);
  if (weight > 0) return weight * price * (qty || 1);
  return qty * price;
}

/**
 * Tính giá hiệu dụng dựa vào số lượng và cấu hình giá sỉ.
 * - Nếu sản phẩm không bật giá sỉ → trả về price (giá lẻ).
 * - Nếu bật → tìm tier có minQty cao nhất mà quantity >= minQty.
 * - Không khớp tier nào → trả về price (giá lẻ).
 */
export function getEffectivePrice(
  product: { price: number; wholesaleEnabled?: boolean; wholesaleTiers?: Array<{ minQty: number; price: number }> | null },
  quantity: number,
): number {
  if (!product.wholesaleEnabled || !product.wholesaleTiers?.length) return product.price;
  const sorted = [...product.wholesaleTiers].sort((a, b) => b.minQty - a.minQty);
  const match = sorted.find(t => quantity >= t.minQty);
  return match ? match.price : product.price;
}

export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Đuôi mã đơn (phần sau dấu '-' cuối). VD "LD-20260531-FSRNX" → "FSRNX". */
export function orderCodeSuffix(code: string): string {
  const parts = code.split('-');
  return parts[parts.length - 1] || code;
}

/**
 * Tìm đơn theo giá trị quét được — tương thích cả barcode mã đầy đủ (bag cũ)
 * lẫn barcode chỉ chứa đuôi mã (bag mới, ngắn để dễ quét).
 */
export function matchScannedOrder<T extends { code: string }>(
  items: T[],
  scanned: string,
): T | null {
  const v = scanned.trim().toUpperCase();
  if (!v) return null;
  const exact = items.find((o) => o.code.toUpperCase() === v);
  if (exact) return exact;
  return items.find((o) => orderCodeSuffix(o.code).toUpperCase() === v) ?? null;
}
