import { apiClient, unwrap } from './client';
import type { Paginated, Transaction } from '@/types/api';

export type TransactionType = 'INCOME' | 'EXPENSE';

export interface FinanceSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  byCategory: Record<string, number>;
}

export interface FinanceListQuery {
  type?: TransactionType;
  category?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface TransactionPayload {
  type: TransactionType;
  category: string;
  amount: number;
  description?: string;
  date?: string;
}

export const financeApi = {
  list: (query: FinanceListQuery = {}) =>
    unwrap<Paginated<Transaction>>(apiClient.get('/finance', { params: query })),
  detail: (id: string) =>
    unwrap<Transaction>(apiClient.get(`/finance/${id}`)),
  create: (payload: TransactionPayload) =>
    unwrap<Transaction>(apiClient.post('/finance', payload)),
  update: (id: string, payload: Partial<TransactionPayload>) =>
    unwrap<Transaction>(apiClient.patch(`/finance/${id}`, payload)),
  remove: (id: string) => apiClient.delete(`/finance/${id}`),
  summary: (params: { from?: string; to?: string } = {}) =>
    unwrap<FinanceSummary>(apiClient.get('/finance/summary', { params })),
};
