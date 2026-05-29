import React, { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { colors } from '@/theme/colors';
import { radius, spacing, touch } from '@/theme/spacing';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  containerStyle?: ViewStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, hint, required, containerStyle, leftIcon, rightIcon, style, ...rest },
  ref,
) {
  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={{ color: colors.danger }}> *</Text>}
        </Text>
      )}
      <View
        style={[
          styles.inputWrapper,
          {
            borderColor: error ? colors.danger : colors.border,
          },
        ]}
      >
        {leftIcon && <View style={styles.icon}>{leftIcon}</View>}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textSubtle}
          style={[styles.input, style]}
          {...rest}
        />
        {rightIcon && <View style={styles.icon}>{rightIcon}</View>}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderRadius: radius.md,
    minHeight: touch.inputHeight,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 0,
  },
  icon: { paddingHorizontal: spacing.xs },
  error: { fontSize: 12, color: colors.danger },
  hint: { fontSize: 12, color: colors.textMuted },
});
