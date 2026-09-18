import { apiClient, unwrap } from './client';

export interface BankTxn {
  id: string;
  amount: number;
  content: string | null;
  counterName: string | null;
  gateway: string | null;
  transactionAt: string;
}

export interface TodayTransfers {
  /** Tổng tiền chuyển VÀO trong ngày (VN) */
  total: number;
  count: number;
  items: BankTxn[];
}

export const bankApi = {
  today: (params: { date?: string } = {}) =>
    unwrap<TodayTransfers>(apiClient.get('/bank/today', { params })),
};
