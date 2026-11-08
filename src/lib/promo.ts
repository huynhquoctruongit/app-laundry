import type { ShopSettings } from '@/types/api';

/**
 * Giảm giá toàn bộ dịch vụ theo khoảng ngày (ShopSettings.promo*), vd khai trương.
 * Khớp với helpers/utils/promo.ts ở backend: ngày so theo giờ VN (UTC+7), gồm cả
 * ngày bắt đầu và ngày kết thúc; BE tự trừ vào đơn khi tạo — app chỉ hiển thị.
 */
type PromoSettings = Pick<
  ShopSettings,
  'promoEnabled' | 'promoType' | 'promoValue' | 'promoStartDate' | 'promoEndDate'
>;

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Date → "YYYY-MM-DD" theo giờ VN */
export const vnDateStr = (d: Date = new Date()) =>
  new Date(d.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);

export function isPromoActive(
  s: Partial<PromoSettings> | null | undefined,
  date: Date = new Date(),
): boolean {
  if (!s?.promoEnabled || !(Number(s.promoValue ?? 0) > 0)) return false;
  if (isNaN(date.getTime())) return false;
  const day = vnDateStr(date);
  if (s.promoStartDate && day < s.promoStartDate) return false;
  if (s.promoEndDate && day > s.promoEndDate) return false;
  return true;
}

/** Số tiền giảm cho 1 đơn có tổng dịch vụ `subtotal` (0 nếu không trong đợt giảm). */
export function calcPromoDiscount(
  s: Partial<PromoSettings> | null | undefined,
  subtotal: number,
  date: Date = new Date(),
): number {
  if (!isPromoActive(s, date) || subtotal <= 0) return 0;
  const value = Number(s!.promoValue);
  const raw = s!.promoType === 'AMOUNT' ? value : (subtotal * Math.min(value, 100)) / 100;
  // Làm tròn xuống 1.000đ cho dễ thu tiền mặt, không vượt tổng đơn
  return Math.min(subtotal, Math.floor(raw / 1000) * 1000);
}

/** Nhãn dòng giảm giá trên bill: "Giảm giá Khai trương" nếu đơn tạo trong đợt giảm có nhãn */
export function promoDiscountLabel(
  s: (Partial<PromoSettings> & { promoLabel?: string | null }) | null | undefined,
  orderCreatedAt?: string | Date | null,
  base = 'Giảm giá',
): string {
  const label = s?.promoLabel?.trim();
  if (!label) return base;
  const at = orderCreatedAt ? new Date(orderCreatedAt) : new Date();
  return isPromoActive(s, at) ? `${base} ${label}` : base;
}
