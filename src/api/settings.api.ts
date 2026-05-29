import { apiClient, unwrap } from './client';
import type { ShopSettings } from '@/types/api';

export type SettingsPayload = Partial<Omit<ShopSettings, 'id'>>;

export const settingsApi = {
  get: () => unwrap<ShopSettings>(apiClient.get('/settings')),
  update: (payload: SettingsPayload) =>
    unwrap<ShopSettings>(apiClient.patch('/settings', payload)),
};
