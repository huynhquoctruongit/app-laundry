import { apiClient, unwrap } from './client';

export type AuditResult = 'VERIFIED' | 'ANOMALY';

export interface OrderAudit {
  id: string;
  date: string;
  result: AuditResult;
  auditedAt: string;
  auditedBy: { id: string; name: string };
  order: {
    id: string;
    code: string;
    status: string;
    totalAmount: number;
    customer: { id: string; name: string } | null;
  };
}

export interface AuditDaySummary {
  date: string;
  verified: number;
  anomaly: number;
  firstAt: string;
  lastAt: string;
  users: { name: string; count: number }[];
}

export const auditApi = {
  /** Đơn đã quét hôm nay (mọi máy) */
  today: () => unwrap<{ date: string; items: OrderAudit[] }>(apiClient.get('/audits')),
  /** Ghi nhận quét 1 bịch; duplicate=true nếu máy khác đã quét trước */
  mark: (orderId: string, result: AuditResult = 'VERIFIED') =>
    unwrap<{ duplicate: boolean; audit: OrderAudit }>(apiClient.post('/audits', { orderId, result })),
  /** Bắt đầu lại — xoá kết quả rà soát hôm nay của mọi máy */
  resetToday: () => unwrap<{ deleted: number }>(apiClient.delete('/audits/today')),
  /** ADMIN — lịch sử rà soát theo tháng "YYYY-MM" */
  summary: (month: string) =>
    unwrap<{ month: string; days: AuditDaySummary[] }>(apiClient.get('/audits/summary', { params: { month } })),
};
