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

export interface BankHistoryItem extends BankTxn {
  counterAccount: string | null;
  /** Đơn đã khớp với giao dịch (null = chưa khớp) */
  order: { id: string; code: string; customerName: string | null } | null;
}

export interface BankHistoryParams {
  /** YYYY-MM-DD (giờ VN) — mặc định hôm nay */
  from?: string;
  to?: string;
  /** Tìm theo nội dung CK / tên người chuyển / mã đơn */
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface BankHistory {
  from: string;
  to: string;
  /** Tổng tiền nhận của toàn bộ bộ lọc (không chỉ trang hiện tại) */
  total: number;
  count: number;
  page: number;
  pageSize: number;
  items: BankHistoryItem[];
}

export const bankApi = {
  /** Máy POS quầy đăng ký / huỷ nhận báo "đã nhận chuyển khoản" theo đơn */
  setPosDevice: (token: string, enabled = true) =>
    unwrap<{ enabled: boolean }>(apiClient.put('/bank/pos-device', { token, enabled })),
  today: (params: { date?: string } = {}) =>
    unwrap<TodayTransfers>(apiClient.get('/bank/today', { params })),
  /** Lịch sử chuyển khoản theo khoảng ngày (có phân trang) */
  history: (params: BankHistoryParams = {}) =>
    unwrap<BankHistory>(apiClient.get('/bank/transactions', { params })),
};
