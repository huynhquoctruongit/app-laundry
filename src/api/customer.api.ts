import { apiClient, unwrap } from './client';
import type { Customer, Paginated } from '@/types/api';

export interface CustomerListQuery {
  search?: string;
  sort?: 'recent' | 'orders';
  page?: number;
  pageSize?: number;
}

export interface CustomerPayload {
  name: string;
  phone: string;
  address?: string;
  note?: string;
}

export interface CustomerStatsRecentOrder {
  id: string;
  code: string;
  totalAmount: number;
  discountAmount: number;
  status: string;
  createdAt: string;
  deliveredAt: string | null;
}

export interface CustomerStats {
  customer: {
    id: string;
    name: string;
    phone: string;
    address: string | null;
  };
  orderCount: number;
  totalSpent: number;
  avgOrderValue: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  daysSinceLastOrder: number | null;
  averageIntervalDays: number | null;
  frequencyLabel: string;
  frequencyTone: 'new' | 'frequent' | 'regular' | 'rare';
  recentOrders: CustomerStatsRecentOrder[];
}

export interface TopCustomerEntry {
  customer: {
    id: string;
    name: string;
    phone: string;
    address: string | null;
  };
  orderCount: number;
  totalSpent: number;
  avgOrderValue: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  daysSinceLastOrder: number | null;
  averageIntervalDays: number | null;
  frequencyLabel: string;
}

export const customerApi = {
  list: (query: CustomerListQuery = {}) =>
    unwrap<Paginated<Customer>>(apiClient.get('/customers', { params: query })),
  detail: (id: string) => unwrap<Customer>(apiClient.get(`/customers/${id}`)),
  create: (payload: CustomerPayload) =>
    unwrap<Customer>(apiClient.post('/customers', payload)),
  update: (id: string, payload: Partial<CustomerPayload>) =>
    unwrap<Customer>(apiClient.patch(`/customers/${id}`, payload)),
  remove: (id: string) => apiClient.delete(`/customers/${id}`),

  stats: (id: string) =>
    unwrap<CustomerStats>(apiClient.get(`/customers/${id}/stats`)),
  top: (params: { from?: string; to?: string; limit?: number } = {}) =>
    unwrap<TopCustomerEntry[]>(apiClient.get('/customers/top', { params })),
};
