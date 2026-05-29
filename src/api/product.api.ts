import { apiClient, unwrap } from './client';
import type { Paginated, Product, WholesaleTier } from '@/types/api';

export interface ProductListQuery {
  search?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ProductPayload {
  name: string;
  unit?: string;
  price: number;
  importPrice?: number;
  costPrice?: number;
  wholesaleEnabled?: boolean;
  wholesaleTiers?: WholesaleTier[] | null;
  isActive?: boolean;
  note?: string;
}

export const productApi = {
  list: (query: ProductListQuery = {}) =>
    unwrap<Paginated<Product>>(apiClient.get('/products', { params: query })),
  detail: (id: string) => unwrap<Product>(apiClient.get(`/products/${id}`)),
  create: (payload: ProductPayload) =>
    unwrap<Product>(apiClient.post('/products', payload)),
  update: (id: string, payload: Partial<ProductPayload>) =>
    unwrap<Product>(apiClient.patch(`/products/${id}`, payload)),
  remove: (id: string) => apiClient.delete(`/products/${id}`),
};
