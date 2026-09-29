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
  /** Máy POS quầy đăng ký / huỷ nhận báo "đã nhận chuyển khoản" theo đơn */
  setPosDevice: (token: string, enabled = true) =>
    unwrap<{ enabled: boolean }>(apiClient.put('/bank/pos-device', { token, enabled })),
  today: (params: { date?: string } = {}) =>
    unwrap<TodayTransfers>(apiClient.get('/bank/today', { params })),
};
