import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { qrApi } from '@/api/order.api';
import { extractError } from '@/api/client';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';

export function ScannerScreen() {
  const navigation = useNavigation<any>();
  const [token, setToken] = useState('');

  const verifyMutation = useMutation({
    mutationFn: (t: string) => qrApi.verify(t),
    onSuccess: (order) => {
      Toast.show({ type: 'success', text1: `Đã tìm thấy đơn ${order.code}` });
      navigation.replace('OrderDetail', { id: order.id });
    },
    onError: (err) =>
      Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  function handleSubmit() {
    const t = token.trim();
    if (!t) {
      Toast.show({ type: 'error', text1: 'Vui lòng nhập mã QR / token' });
      return;
    }
    // Allow user to paste full URL — extract last segment as token
    const cleaned = extractTokenFromUrl(t);
    verifyMutation.mutate(cleaned);
  }

  function handleOpenCamera() {
    Toast.show({
      type: 'info',
      text1: 'Camera scan',
      text2: 'Camera scan coming soon — vui lòng nhập token thủ công',
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Card style={{ width: '100%', maxWidth: 600 }}>
          <CardHeader style={{ alignItems: 'center' }}>
            <View style={styles.iconCircle}>
              <Icon name="qrcode-scan" size={36} color={colors.primary} />
            </View>
            <CardTitle>Quét mã QR đơn hàng</CardTitle>
          </CardHeader>
          <CardContent style={{ gap: spacing.lg }}>
            <Text style={styles.help}>
              Đưa mã QR vào camera để mở đơn nhanh hoặc nhập token thủ công.
            </Text>

            <Button
              size="lg"
              onPress={handleOpenCamera}
              leftIcon={<Icon name="camera" size={22} color="#fff" />}
            >
              Mở camera
            </Button>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>HOẶC</Text>
              <View style={styles.divider} />
            </View>

            <Input
              label="Mã token / URL từ QR"
              value={token}
              onChangeText={setToken}
              placeholder="VD: abc123... hoặc dán URL"
              autoCapitalize="none"
              autoCorrect={false}
              leftIcon={<Icon name="link" size={18} color={colors.textMuted} />}
            />
            <Button
              size="lg"
              onPress={handleSubmit}
              loading={verifyMutation.isPending}
              leftIcon={<Icon name="magnify" size={22} color="#fff" />}
            >
              Tìm đơn
            </Button>

            <Button
              variant="ghost"
              onPress={() => navigation.goBack()}
              leftIcon={<Icon name="arrow-left" size={20} color={colors.text} />}
            >
              Quay lại
            </Button>
          </CardContent>
        </Card>
      </View>
    </View>
  );
}

function extractTokenFromUrl(input: string): string {
  try {
    if (input.startsWith('http')) {
      const url = new URL(input);
      const parts = url.pathname.split('/').filter(Boolean);
      return parts[parts.length - 1] || input;
    }
  } catch {
    // not a URL — return as-is
  }
  return input;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  help: { fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
});
