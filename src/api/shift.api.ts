import { apiClient, unwrap } from './client';
import type { Paginated, Shift, ShiftAttendance } from '@/types/api';

export interface ShiftListQuery {
  isOpen?: boolean;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface ShiftPayload {
  name: string;
  note?: string;
}

export interface CheckInPayload {
  userId: string;
  checkIn?: string;
  note?: string;
}

export const shiftApi = {
  list: (query: ShiftListQuery = {}) =>
    unwrap<Paginated<Shift>>(apiClient.get('/shifts', { params: query })),
  current: () => unwrap<Shift | null>(apiClient.get('/shifts/current')),
  detail: (id: string) => unwrap<Shift>(apiClient.get(`/shifts/${id}`)),
  create: (payload: ShiftPayload) =>
    unwrap<Shift>(apiClient.post('/shifts', payload)),
  update: (id: string, payload: Partial<ShiftPayload>) =>
    unwrap<Shift>(apiClient.patch(`/shifts/${id}`, payload)),
  close: (id: string, payload: { note?: string } = {}) =>
    unwrap<Shift>(apiClient.patch(`/shifts/${id}/close`, payload)),
  remove: (id: string) => apiClient.delete(`/shifts/${id}`),
  checkIn: (id: string, payload: CheckInPayload) =>
    unwrap<ShiftAttendance>(
      apiClient.post(`/shifts/${id}/attendance`, payload),
    ),
  checkOut: (id: string, attendanceId: string) =>
    unwrap<ShiftAttendance>(
      apiClient.patch(`/shifts/${id}/attendance/${attendanceId}/checkout`),
    ),
};
