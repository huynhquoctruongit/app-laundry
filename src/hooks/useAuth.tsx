import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/auth.api';
import type { User } from '@/types/api';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchShop: (shopId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (storedToken) {
          setToken(storedToken);
          if (storedUser) setUser(JSON.parse(storedUser));
          // Verify with server in background
          try {
            const fresh = await authApi.me();
            setUser(fresh);
            await AsyncStorage.setItem(USER_KEY, JSON.stringify(fresh));
          } catch {
            // token invalid → clear
            await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
            setToken(null);
            setUser(null);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(email: string, password: string) {
    const res = await authApi.login({ email, password });
    await AsyncStorage.setItem(TOKEN_KEY, res.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(res.user));
    setToken(res.token);
    setUser(res.user);
  }

  // Chủ quản lý nhiều tiệm: lấy token tiệm khác. Bật loading để RootNavigator
  // unmount NavigationContainer → điều hướng reset về Tổng quan, đồng thời xoá
  // cache react-query để không lẫn dữ liệu tiệm cũ.
  async function switchShop(shopId: string) {
    const res = await authApi.switchShop(shopId);
    setLoading(true);
    try {
      await AsyncStorage.setItem(TOKEN_KEY, res.token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(res.user));
      queryClient.clear();
      setToken(res.token);
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    // Máy này thôi nhận thông báo của tài khoản vừa đăng xuất (lỗi mạng thì bỏ qua)
    await authApi.clearFcmToken().catch(() => {});
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    queryClient.clear();
    setToken(null);
    setUser(null);
  }

  async function refresh() {
    try {
      const fresh = await authApi.me();
      setUser(fresh);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(fresh));
    } catch {
      // ignore
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, switchShop, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
