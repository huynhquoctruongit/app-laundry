import { apiClient, unwrap } from './client';
import type { Paginated, User } from '@/types/api';

export type UserRole = 'ADMIN' | 'STAFF';

export interface StaffListQuery {
  search?: string;
  role?: UserRole;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface CreateStaffPayload {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role: UserRole;
  permissions?: string[];
}

export interface UpdateStaffPayload {
  name?: string;
  phone?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface StaffPermissionsPayload {
  permissions: string[];
  orderViewTimeLimit?: number | null;
}

export const staffApi = {
  list: (query: StaffListQuery = {}) =>
    unwrap<Paginated<User>>(apiClient.get('/staff', { params: query })),
  detail: (id: string) => unwrap<User>(apiClient.get(`/staff/${id}`)),
  create: (payload: CreateStaffPayload) =>
    unwrap<User>(apiClient.post('/staff', payload)),
  update: (id: string, payload: UpdateStaffPayload) =>
    unwrap<User>(apiClient.patch(`/staff/${id}`, payload)),
  updatePermissions: (id: string, payload: StaffPermissionsPayload) =>
    unwrap<User>(apiClient.patch(`/staff/${id}/permissions`, payload)),
  resetPassword: (id: string, password: string) =>
    unwrap<{ success: boolean }>(
      apiClient.patch(`/staff/${id}/password`, { password }),
    ),
  remove: (id: string) => apiClient.delete(`/staff/${id}`),
};
