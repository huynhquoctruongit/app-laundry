import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-toast-message';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/api/auth.api';
import { extractError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import type { LinkedShop } from '@/types/api';

/** Đổi tiệm cho ADMIN quản lý nhiều tiệm — không cần đăng xuất/đăng nhập lại. */
export function ShopSwitcher() {
  const { user, switchShop } = useAuth();
  const [open, setOpen] = useState(false);
  const [linking, setLinking] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isAdmin = user?.role === 'ADMIN';
  const shopsQuery = useQuery({
    queryKey: ['linked-shops', user?.id],
    queryFn: authApi.linkedShops,
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
  });
  const shops = shopsQuery.data ?? [];

  const linkMutation = useMutation({
    mutationFn: authApi.linkShop,
    onSuccess: () => {
      shopsQuery.refetch();
      Toast.show({ type: 'success', text1: 'Đã liên kết tiệm' });
      setLinking(false);
      setEmail('');
      setPassword('');
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  const unlinkMutation = useMutation({
    mutationFn: authApi.unlinkShop,
    onSuccess: () => {
      shopsQuery.refetch();
      Toast.show({ type: 'success', text1: 'Đã huỷ liên kết' });
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  if (!isAdmin) return null;

  const current = shops.find((s) => s.isCurrent);
  const currentName = current?.shopName ?? user?.shopName ?? 'Tiệm hiện tại';

  const handleSwitch = async (shop: LinkedShop) => {
    if (shop.isCurrent || switching) return;
    setSwitching(shop.shopId);
    try {
      setOpen(false);
      await switchShop(shop.shopId);
      Toast.show({ type: 'success', text1: `Đã chuyển sang ${shop.shopName}` });
    } catch (err) {
      Toast.show({ type: 'error', text1: extractError(err).message });
    } finally {
      setSwitching(null);
    }
  };

  const confirmUnlink = (shop: LinkedShop) => {
    Alert.alert('Huỷ liên kết', `Huỷ liên kết với "${shop.shopName}"?`, [
      { text: 'Không', style: 'cancel' },
      { text: 'Huỷ liên kết', style: 'destructive', onPress: () => unlinkMutation.mutate(shop.shopId) },
    ]);
  };

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)}>
        <Icon name="storefront-outline" size={20} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.triggerHint}>Tiệm đang xem</Text>
          <Text style={styles.triggerName} numberOfLines={1}>
            {currentName}
          </Text>
        </View>
        {switching ? (
          <ActivityIndicator size="small" color={colors.textMuted} />
        ) : (
          <Icon name="swap-horizontal" size={20} color={colors.textMuted} />
        )}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{linking ? 'Liên kết tiệm khác' : 'Chuyển tiệm'}</Text>
              <Pressable hitSlop={10} onPress={() => (linking ? setLinking(false) : setOpen(false))}>
                <Icon name={linking ? 'arrow-left' : 'close'} size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            {linking ? (
              <View style={{ gap: spacing.md }}>
                <Text style={styles.hint}>
                  Nhập tài khoản ADMIN của tiệm kia (chỉ cần 1 lần). Sau đó đổi tiệm ngay tại đây, không
                  cần đăng xuất.
                </Text>
                <Input
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  scanCapture={false}
                />
                <Input
                  label="Mật khẩu"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  scanCapture={false}
                />
                <Button
                  loading={linkMutation.isPending}
                  disabled={!email || password.length < 6}
                  onPress={() => linkMutation.mutate({ email: email.trim(), password })}
                  fullWidth
                >
                  Liên kết
                </Button>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 360 }}>
                {shopsQuery.isLoading ? (
                  <ActivityIndicator style={{ margin: spacing.lg }} color={colors.primary} />
                ) : (
                  shops.map((s) => (
                    <Pressable
                      key={s.shopId}
                      style={[styles.shopRow, s.isCurrent && styles.shopRowActive]}
                      onPress={() => handleSwitch(s)}
                      onLongPress={() => !s.isCurrent && confirmUnlink(s)}
                    >
                      <Icon
                        name={s.isCurrent ? 'check-circle' : 'storefront-outline'}
                        size={22}
                        color={s.isCurrent ? colors.primary : colors.textMuted}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.shopName} numberOfLines={1}>
                          {s.shopName}
                        </Text>
                        <Text style={styles.shopEmail} numberOfLines={1}>
                          {s.email}
                        </Text>
                      </View>
                      {s.isCurrent ? <Text style={styles.currentTag}>Đang xem</Text> : null}
                    </Pressable>
                  ))
                )}
                <Pressable style={styles.linkRow} onPress={() => setLinking(true)}>
                  <Icon name="link-variant-plus" size={22} color={colors.primary} />
                  <Text style={styles.linkText}>Liên kết tiệm khác</Text>
                </Pressable>
                {shops.length > 1 ? (
                  <Text style={styles.footHint}>Nhấn giữ 1 tiệm để huỷ liên kết</Text>
                ) : null}
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  triggerHint: { fontSize: 11, color: colors.textMuted },
  triggerName: { fontSize: 14, fontWeight: '700', color: colors.text },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  hint: { fontSize: 13, color: colors.textMuted },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  shopRowActive: { backgroundColor: colors.primaryLight },
  shopName: { fontSize: 15, fontWeight: '600', color: colors.text },
  shopEmail: { fontSize: 12, color: colors.textMuted },
  currentTag: { fontSize: 12, fontWeight: '600', color: colors.primary },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  linkText: { fontSize: 15, fontWeight: '600', color: colors.primary },
  footHint: { fontSize: 12, color: colors.textSubtle, textAlign: 'center', marginTop: spacing.sm },
});
