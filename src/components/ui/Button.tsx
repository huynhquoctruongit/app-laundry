import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '@/theme/colors';
import { radius, spacing, touch } from '@/theme/spacing';

type Variant = 'default' | 'outline' | 'ghost' | 'destructive' | 'success';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  onPress?: () => void;
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function Button({
  onPress,
  children,
  variant = 'default',
  size = 'md',
  disabled,
  loading,
  leftIcon,
  rightIcon,
  style,
  fullWidth,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const variantStyle = (() => {
    switch (variant) {
      case 'outline':
        return { bg: 'transparent', fg: colors.text, border: colors.border };
      case 'ghost':
        return { bg: 'transparent', fg: colors.text, border: 'transparent' };
      case 'destructive':
        return { bg: colors.danger, fg: '#fff', border: colors.danger };
      case 'success':
        return { bg: colors.success, fg: '#fff', border: colors.success };
      default:
        return { bg: colors.primary, fg: colors.primaryForeground, border: colors.primary };
    }
  })();

  const sizeStyle = {
    sm: { height: 40, paddingH: spacing.md, fontSize: 14 },
    md: { height: touch.buttonHeight, paddingH: spacing.lg, fontSize: 16 },
    lg: { height: 60, paddingH: spacing.xl, fontSize: 18 },
  }[size];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: variantStyle.bg,
          borderColor: variantStyle.border,
          height: sizeStyle.height,
          paddingHorizontal: sizeStyle.paddingH,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          width: fullWidth ? '100%' : undefined,
        },
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={variantStyle.fg} size="small" />
        ) : (
          <>
            {leftIcon}
            <Text style={[styles.text, { color: variantStyle.fg, fontSize: sizeStyle.fontSize }]}>
              {children}
            </Text>
            {rightIcon}
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { fontWeight: '600' },
});
