import { apiClient, unwrap } from './client';
import type { Order, Paginated } from '@/types/api';

export interface OrderListQuery {
  search?: string;
  status?: string;
  customerId?: string;
  assignedToId?: string;
  fromBooking?: boolean;
  debt?: boolean;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface OrderItemPayload {
  productId?: string;
  name: string;
  quantity: number;
  weight?: number;
  unitPrice: number;
}

export interface CreateOrderPayload {
  customerId: string;
  note?: string;
  pickupAt?: string;
  discountAmount?: number;
  items: OrderItemPayload[];
}

export interface ScanHistoryEntry {
  id: string;
  orderId: string;
  scannedAt: string;
  user?: { id: string; name: string } | null;
  action?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  note?: string | null;
  meta?: string | null;
}

export const orderApi = {
  statusCounts: (query: { dateFrom?: string; dateTo?: string } = {}) =>
    unwrap<Record<string, number>>(apiClient.get('/orders/status-counts', { params: query })),
  list: (query: OrderListQuery = {}) =>
    unwrap<Paginated<Order>>(apiClient.get('/orders', { params: query })),
  detail: (id: string) => unwrap<Order>(apiClient.get(`/orders/${id}`)),
  create: (payload: CreateOrderPayload) =>
    unwrap<Order>(apiClient.post('/orders', payload)),
  update: (id: string, payload: Partial<CreateOrderPayload>) =>
    unwrap<Order>(apiClient.patch(`/orders/${id}`, payload)),
  updateStatus: (id: string, status: string) =>
    unwrap<Order>(apiClient.patch(`/orders/${id}/status`, { status })),
  /** Đánh dấu thu tiền: paid=false → đơn nợ (treo); paid=true → đã thanh toán */
  setPayment: (id: string, paid: boolean) =>
    unwrap<Order>(apiClient.patch(`/orders/${id}/payment`, { paid })),
  assign: (id: string, assignedToId: string | null) =>
    unwrap<Order>(apiClient.patch(`/orders/${id}/assign`, { assignedToId })),
  remove: (id: string) => apiClient.delete(`/orders/${id}`),
  qrDataUrl: (id: string) =>
    unwrap<{ dataUrl: string; token: string; code: string }>(
      apiClient.get(`/orders/${id}/qr`),
    ),
  scanHistory: (id: string) =>
    unwrap<ScanHistoryEntry[]>(apiClient.get(`/orders/${id}/scan-history`)),
};

export const qrApi = {
  verify: (token: string) => unwrap<Order>(apiClient.get(`/qr/${token}`)),
  staffScan: (token: string) =>
    unwrap<Order>(apiClient.post(`/qr/${token}/scan`)),
};
