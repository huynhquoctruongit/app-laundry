import { apiClient, unwrap } from './client';
import type { CustomerDebt, Paginated, SupplierDebt } from '@/types/api';

export type DebtType = 'MONEY' | 'GOODS';

export interface DebtSummary {
  customerDebtTotal: number;
  supplierDebtTotal: number;
  customerPaidTotal: number;
  supplierPaidTotal: number;
}

export interface CustomerDebtListQuery {
  customerId?: string;
  isPaid?: boolean;
  page?: number;
  pageSize?: number;
}

export interface SupplierDebtListQuery {
  supplierId?: string;
  isPaid?: boolean;
  page?: number;
  pageSize?: number;
}

export interface CustomerDebtPayload {
  customerId: string;
  amount: number;
  type: DebtType;
  description?: string;
  dueDate?: string;
}

export interface SupplierDebtPayload {
  supplierId: string;
  amount: number;
  type: DebtType;
  description?: string;
  dueDate?: string;
}

export const debtApi = {
  customers: {
    list: (query: CustomerDebtListQuery = {}) =>
      unwrap<Paginated<CustomerDebt>>(
        apiClient.get('/debt/customers', { params: query }),
      ),
    detail: (id: string) =>
      unwrap<CustomerDebt>(apiClient.get(`/debt/customers/${id}`)),
    create: (payload: CustomerDebtPayload) =>
      unwrap<CustomerDebt>(apiClient.post('/debt/customers', payload)),
    update: (id: string, payload: Partial<CustomerDebtPayload>) =>
      unwrap<CustomerDebt>(apiClient.patch(`/debt/customers/${id}`, payload)),
    remove: (id: string) => apiClient.delete(`/debt/customers/${id}`),
    pay: (id: string, paidAmount: number) =>
      unwrap<CustomerDebt>(
        apiClient.patch(`/debt/customers/${id}/pay`, { paidAmount }),
      ),
  },
  suppliers: {
    list: (query: SupplierDebtListQuery = {}) =>
      unwrap<Paginated<SupplierDebt>>(
        apiClient.get('/debt/suppliers', { params: query }),
      ),
    detail: (id: string) =>
      unwrap<SupplierDebt>(apiClient.get(`/debt/suppliers/${id}`)),
    create: (payload: SupplierDebtPayload) =>
      unwrap<SupplierDebt>(apiClient.post('/debt/suppliers', payload)),
    update: (id: string, payload: Partial<SupplierDebtPayload>) =>
      unwrap<SupplierDebt>(apiClient.patch(`/debt/suppliers/${id}`, payload)),
    remove: (id: string) => apiClient.delete(`/debt/suppliers/${id}`),
    pay: (id: string, paidAmount: number) =>
      unwrap<SupplierDebt>(
        apiClient.patch(`/debt/suppliers/${id}/pay`, { paidAmount }),
      ),
  },
  summary: () => unwrap<DebtSummary>(apiClient.get('/debt/summary')),
};
