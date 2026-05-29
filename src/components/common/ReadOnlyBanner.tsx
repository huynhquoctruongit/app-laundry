import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';

interface Props {
  message?: string;
}

export function ReadOnlyBanner({
  message = 'Bạn đang ở chế độ chỉ xem. Chỉ quản lý mới có quyền chỉnh sửa.',
}: Props) {
  return (
    <View style={styles.container}>
      <Icon name="eye-outline" size={18} color={colors.warning} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  text: {
    flex: 1,
    fontSize: 13,
    color: '#78350f',
    fontWeight: '600',
  },
});
