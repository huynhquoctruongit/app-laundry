import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import { extractError } from '@/api/client';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { BRAND_NAME } from '@/helpers/constants/brand';

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@laundry.local');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!email || !password) {
      setError('Vui lòng nhập email và mật khẩu');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      Toast.show({ type: 'success', text1: 'Đăng nhập thành công' });
    } catch (err) {
      setError(extractError(err).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.inner}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Icon name="washing-machine" size={36} color="#fff" />
          </View>
          <Text style={styles.brandName}>{BRAND_NAME}</Text>
          <Text style={styles.brandSub}>Quản lý tiệm giặt sấy</Text>
        </View>

        <Card style={styles.card}>
          <CardContent style={{ gap: spacing.lg, padding: spacing['2xl'] }}>
            <Text style={styles.title}>Đăng nhập</Text>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <Input
              label="Mật khẩu"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <Button onPress={handleLogin} loading={loading} fullWidth size="lg">
              Đăng nhập
            </Button>
          </CardContent>
        </Card>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  brand: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing['3xl'] },
  logo: {
    width: 72, height: 72, borderRadius: 18,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  brandName: { fontSize: 28, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
  brandSub: { fontSize: 14, color: colors.textMuted },
  card: { width: 480, maxWidth: '100%' },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center' },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center' },
});
