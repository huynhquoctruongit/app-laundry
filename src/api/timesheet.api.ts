import { apiClient, unwrap } from './client';

export interface TimeEntry {
  id: string;
  userId: string;
  checkIn: string;
  checkOut: string | null;
}

export interface TimesheetEntry {
  id: string;
  checkIn: string;
  checkOut: string | null;
  roundedIn: string;
  roundedOut: string | null;
  hours: number;
  isSunday: boolean;
  rate: number;
  amount: number;
}

export interface TimesheetUser {
  userId: string;
  name: string;
  totalHours: number;
  totalAmount: number;
  entries: TimesheetEntry[];
}

export interface TimesheetWeek {
  /** Thứ 2 "YYYY-MM-DD" */
  start: string;
  /** Chủ nhật "YYYY-MM-DD" (ngày trả lương) */
  end: string;
  totalHours: number;
  totalAmount: number;
  users: TimesheetUser[];
}

export interface MonthlyTimesheet {
  month: string;
  /** Thứ 2 tuần đầu → CN tuần cuối của tháng lương */
  from: string;
  to: string;
  rates: { weekday: number; sunday: number };
  totalHours: number;
  totalAmount: number;
  /** Tổng cả tháng theo nhân viên */
  users: TimesheetUser[];
  /** Từng tuần lương, mới nhất trước */
  weeks: TimesheetWeek[];
}

export const timesheetApi = {
  current: () => unwrap<TimeEntry | null>(apiClient.get('/timesheet/current')),
  checkIn: () => unwrap<TimeEntry>(apiClient.post('/timesheet/check-in')),
  checkOut: () => unwrap<TimeEntry>(apiClient.post('/timesheet/check-out')),
  /** ADMIN: sửa giờ vào/ra (checkOut null = đang làm) */
  update: (id: string, payload: { checkIn: string; checkOut: string | null }) =>
    unwrap<TimeEntry>(apiClient.patch(`/timesheet/${id}`, payload)),
  /** ADMIN: xoá ca chấm công */
  remove: (id: string) => apiClient.delete(`/timesheet/${id}`),
  /** month: "YYYY-MM" */
  monthly: (month: string) =>
    unwrap<MonthlyTimesheet>(apiClient.get('/timesheet/monthly', { params: { month } })),
};
