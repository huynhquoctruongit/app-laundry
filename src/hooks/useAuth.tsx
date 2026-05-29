import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '@/api/auth.api';
import type { User } from '@/types/api';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  async function logout() {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
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
    <AuthContext.Provider value={{ user, token, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
