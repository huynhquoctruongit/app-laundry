import type { Order, ShopSettings } from '@/types/api';

export interface InvoiceTotals {
  subtotal: number;
  shippingFee: number;
  discount: number;
  grandTotal: number;
}

export function getBookingShippingFee(settings: ShopSettings): number {
  const fee = Number(settings.bookingShippingFee ?? 0);
  return fee > 0 ? fee : 0;
}

export function calcInvoiceTotals(order: Order, settings: ShopSettings): InvoiceTotals {
  const subtotal = Number(order.totalAmount);
  const discount = Number(order.discountAmount ?? 0);
  const shippingFee = order.fromBooking ? getBookingShippingFee(settings) : 0;
  const grandTotal = subtotal + shippingFee - discount;
  return { subtotal, shippingFee, discount, grandTotal };
}
