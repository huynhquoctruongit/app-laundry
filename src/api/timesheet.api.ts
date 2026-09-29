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

export interface MonthlyTimesheet {
  month: string;
  rates: { weekday: number; sunday: number };
  totalHours: number;
  totalAmount: number;
  users: TimesheetUser[];
}

export const timesheetApi = {
  current: () => unwrap<TimeEntry | null>(apiClient.get('/timesheet/current')),
  checkIn: () => unwrap<TimeEntry>(apiClient.post('/timesheet/check-in')),
  checkOut: () => unwrap<TimeEntry>(apiClient.post('/timesheet/check-out')),
  /** month: "YYYY-MM" */
  monthly: (month: string) =>
    unwrap<MonthlyTimesheet>(apiClient.get('/timesheet/monthly', { params: { month } })),
};
