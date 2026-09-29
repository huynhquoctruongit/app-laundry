import { apiClient, unwrap } from './client';

export interface CashClosing {
  id: string;
  date: string;
  openingCash: number | string;
  collected: number | string;
  transfers: number | string;
  expenses: number | string;
  expenseNote: string | null;
  expectedCash: number | string;
  countedCash: number | string;
  difference: number | string;
  denominations: Record<string, number> | null;
  note: string | null;
  createdAt: string;
  closedBy: { id: string; name: string };
}

export interface CashClosingPreview {
  date: string;
  openingCash: number;
  collected: number;
  orderCount: number;
  transfers: number;
  transferCount: number;
  cashFromOrders: number;
  /** đầu ngày + đã thu − chuyển khoản (chưa trừ chi phí) */
  expectedBeforeExpenses: number;
  /** Chi phí mặc định mỗi ngày (cài đặt tiệm, vd 25k đá + cf ông Địa) */
  defaultExpenses: number;
  closing: CashClosing | null;
}

export interface CashClosingMonth {
  month: string;
  items: CashClosing[];
  totals: {
    days: number;
    collected: number;
    transfers: number;
    expenses: number;
    difference: number;
    mismatchDays: number;
  };
}

export interface CreateCashClosingPayload {
  date?: string;
  /** Tiền mặt đếm được trong két */
  countedCash: number;
  expenses?: number;
  expenseNote?: string;
  note?: string;
}

export const cashClosingApi = {
  preview: (date?: string) =>
    unwrap<CashClosingPreview>(apiClient.get('/cash-closings/preview', { params: date ? { date } : {} })),
  create: (payload: CreateCashClosingPayload) =>
    unwrap<CashClosing>(apiClient.post('/cash-closings', payload)),
  /** month: "YYYY-MM" */
  list: (month: string) =>
    unwrap<CashClosingMonth>(apiClient.get('/cash-closings', { params: { month } })),
  /** ADMIN — xoá để nhân viên chốt lại */
  remove: (id: string) => apiClient.delete(`/cash-closings/${id}`),
};
