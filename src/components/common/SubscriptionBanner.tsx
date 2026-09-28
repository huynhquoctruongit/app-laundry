import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useQuery } from '@tanstack/react-query';
import { settingsApi } from '@/api/settings.api';
import { formatDate } from '@/lib/utils';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

/** Bắt đầu nhắc khi còn <= số ngày này. */
const WARN_DAYS = 7;
const DISMISS_KEY = 'laundry.subscriptionBannerDismissedAt';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Nhắc hạn gói dịch vụ của tiệm.
 * - Còn <= WARN_DAYS ngày: banner vàng, ẩn được trong ngày.
 * - Đã hết hạn: banner đỏ, không ẩn được (backend đã chặn tạo đơn mới).
 */
export function SubscriptionBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    AsyncStorage.getItem(DISMISS_KEY)
      .then((v) => setDismissed(v === todayKey()))
      .catch(() => {});
  }, []);

  if (!data?.subscriptionEndsAt) {
    return null;
  }

  const days = data.subscriptionDaysRemaining;
  const expired = days <= 0;
  if (!expired && (days > WARN_DAYS || dismissed)) {
    return null;
  }

  const subject = data.currentPlan === 'TRIAL' ? 'Thời gian dùng thử' : 'Gói dịch vụ';
  const endDate = formatDate(data.subscriptionEndsAt);
  const message = expired
    ? `${subject} của tiệm đã hết hạn từ ${endDate}. Vẫn xem được dữ liệu cũ nhưng không thể tạo đơn mới. Liên hệ để gia hạn.`
    : `${subject} của tiệm còn ${days} ngày (hết hạn ${endDate}). Liên hệ gia hạn sớm để không bị gián đoạn.`;

  const dismiss = () => {
    setDismissed(true);
    AsyncStorage.setItem(DISMISS_KEY, todayKey()).catch(() => {});
  };

  const tone = expired ? TONES.danger : TONES.warning;

  return (
    <View style={[styles.container, { backgroundColor: tone.bg, borderBottomColor: tone.accent }]}>
      <Icon
        name={expired ? 'alert-circle-outline' : 'calendar-clock'}
        size={18}
        color={tone.accent}
      />
      <Text style={[styles.text, { color: tone.text }]}>{message}</Text>
      {!expired && (
        <Pressable onPress={dismiss} hitSlop={10} accessibilityLabel="Ẩn thông báo">
          <Icon name="close" size={18} color={tone.accent} />
        </Pressable>
      )}
    </View>
  );
}

const TONES = {
  warning: { bg: colors.warningLight, accent: colors.warning, text: '#78350f' },
  danger: { bg: colors.dangerLight, accent: colors.danger, text: '#991b1b' },
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
});
