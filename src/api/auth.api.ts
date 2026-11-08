import { apiClient, unwrap } from './client';
import type { LinkedShop, User } from '@/types/api';

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
  linkedShops: () => unwrap<LinkedShop[]>(apiClient.get('/auth/linked-shops')),
  linkShop: (payload: LoginPayload) =>
    unwrap<LinkedShop[]>(apiClient.post('/auth/linked-shops', payload)),
  unlinkShop: (shopId: string) =>
    unwrap<LinkedShop[]>(apiClient.delete(`/auth/linked-shops/${shopId}`)),
  switchShop: (shopId: string) =>
    unwrap<LoginResponse>(apiClient.post('/auth/switch-shop', { shopId })),
  clearFcmToken: () => apiClient.delete('/auth/fcm-token', { timeout: 5000 }),
  updateFcmToken: (token: string) =>
    apiClient.patch('/auth/fcm-token', { token }),
};
