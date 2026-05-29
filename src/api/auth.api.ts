import { apiClient, unwrap } from './client';
import type { User } from '@/types/api';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

export const authApi = {
  login: (payload: LoginPayload) =>
    unwrap<LoginResponse>(apiClient.post('/auth/login', payload)),
  me: () => unwrap<User>(apiClient.get('/auth/me')),
  register: (payload: RegisterPayload) =>
    unwrap<LoginResponse>(apiClient.post('/auth/register', payload)),
  updateFcmToken: (token: string) =>
    apiClient.patch('/auth/fcm-token', { token }),
};
