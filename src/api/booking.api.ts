import { apiClient, unwrap } from './client';
import type { Booking, BookingStatusValue, Paginated } from '@/types/api';

export interface BookingListQuery {
  search?: string;
  status?: BookingStatusValue;
  customerId?: string;
  page?: number;
  pageSize?: number;
}

export interface BookingItemPayload {
  productId?: string;
  name: string;
  quantity: number;
  weight?: number;
  unitPrice: number;
}

export interface ConvertBookingPayload {
  items?: BookingItemPayload[];
  pickupAt?: string;
  note?: string;
  discountAmount?: number;
}

export interface UpdateBookingPayload {
  note?: string | null;
  phone?: string;
  address?: string;
  pickupAt?: string | null;
  deliveryAt?: string | null;
}

export const bookingApi = {
  list: (query: BookingListQuery = {}) =>
    unwrap<Paginated<Booking>>(apiClient.get('/bookings', { params: query })),
  detail: (id: string) => unwrap<Booking>(apiClient.get(`/bookings/${id}`)),
  updateStatus: (id: string, status: BookingStatusValue, reason?: string) =>
    unwrap<Booking>(apiClient.patch(`/bookings/${id}/status`, { status, reason })),
  convert: (id: string, payload: ConvertBookingPayload = {}) =>
    unwrap<Booking>(apiClient.post(`/bookings/${id}/convert`, payload)),
  update: (id: string, payload: UpdateBookingPayload) =>
    unwrap<Booking>(apiClient.patch(`/bookings/${id}`, payload)),
  remove: (id: string) => apiClient.delete(`/bookings/${id}`),
};
