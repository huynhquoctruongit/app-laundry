import axios, { AxiosError, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Đổi IP này về địa chỉ backend thật khi chạy trên Sunmi (LAN)
// Sunmi T2 thường có IP cố định trong mạng nội bộ
const DEFAULT_API_URL = 'https://laundry-qr-backend.onrender.com/api';

let runtimeBaseUrl: string | null = null;

export async function getApiBaseUrl(): Promise<string> {
  if (runtimeBaseUrl) return runtimeBaseUrl;
  const stored = await AsyncStorage.getItem('api_base_url');
  runtimeBaseUrl = stored || DEFAULT_API_URL;
  return runtimeBaseUrl;
}

export async function setApiBaseUrl(url: string): Promise<void> {
  runtimeBaseUrl = url;
  await AsyncStorage.setItem('api_base_url', url);
  apiClient.defaults.baseURL = url;
}

export const apiClient = axios.create({
  baseURL: DEFAULT_API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Khởi tạo base URL từ storage (gọi 1 lần khi app khởi động)
getApiBaseUrl().then((url) => {
  apiClient.defaults.baseURL = url;
});

// Inject token
apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Log API errors to console so 4xx/5xx responses don't fail silently in dev
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { config, response } = error;
      // eslint-disable-next-line no-console
      console.warn(
        `[API ${response.status}] ${config?.method?.toUpperCase()} ${config?.url}`,
        response.data,
      );
    }
    return Promise.reject(error);
  },
);

// Unwrap response.data.data → T
export async function unwrap<T>(promise: Promise<AxiosResponse<{ data: T }>>): Promise<T> {
  const res = await promise;
  return res.data.data;
}

export interface ExtractedError {
  message: string;
  status?: number;
  code?: string;
}

export function extractError(err: unknown): ExtractedError {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { message?: string; code?: string } | undefined;
    return {
      message: data?.message || err.message || 'Lỗi không xác định',
      status: err.response?.status,
      code: data?.code,
    };
  }
  if (err instanceof Error) return { message: err.message };
  return { message: 'Lỗi không xác định' };
}
