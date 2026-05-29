import { apiClient, unwrap } from './client';
import type { DashboardReport } from '@/types/api';

export interface FinancialReport {
  revenue: number;
  expenses: number;
  profit: number;
  incomeByCategory: Record<string, number>;
  expenseByCategory: Record<string, number>;
  dailyRevenue: { date: string; revenue: number }[];
}

export interface SalesReport {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  topProducts: { name: string; quantity: number; revenue: number }[];
  ordersByStatus: Record<string, number>;
}

export interface InventoryReport {
  totalItems: number;
  lowStockItems: number;
  recentImports: { date: string; itemName: string; quantity: number }[];
  recentExports: { date: string; itemName: string; quantity: number }[];
}

export const reportApi = {
  dashboard: (params: { date?: string } = {}) =>
    unwrap<DashboardReport>(apiClient.get('/report/dashboard', { params })),
  financial: (params: { from?: string; to?: string } = {}) =>
    unwrap<FinancialReport>(apiClient.get('/report/financial', { params })),
  sales: (params: { from?: string; to?: string } = {}) =>
    unwrap<SalesReport>(apiClient.get('/report/sales', { params })),
  inventory: () =>
    unwrap<InventoryReport>(apiClient.get('/report/inventory')),
};
