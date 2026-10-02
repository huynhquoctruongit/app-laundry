import React, { forwardRef, useRef } from 'react';
import { triggerScan } from '@/native/scanner-bridge';
import { StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { colors } from '@/theme/colors';
import { radius, spacing, touch } from '@/theme/spacing';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  containerStyle?: ViewStyle;
  /** Style cho khung viền ô nhập (vd viền xanh nổi bật) */
  wrapperStyle?: ViewStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** false = không tự nhận mã từ máy quét gõ vào ô này (mặc định: có) */
  scanCapture?: boolean;
}

// Máy quét (bàn phím HID) gõ mỗi ký tự cách nhau vài ms; người gõ tay không nhanh vậy.
const SCAN_KEY_GAP_MS = 50;
const SCAN_IDLE_MS = 120;
const MIN_SCAN_CHARS = 4;

/**
 * Khi đang đứng trong ô nhập (vd ô tìm kiếm màn Đơn hàng) mà quét mã, máy quét gõ thẳng
 * vào ô → trước đây chỉ lọc danh sách, không hoàn thành đơn. Hook này nhận ra loạt ký tự
 * gõ rất nhanh, trả ô về giá trị cũ và đưa mã về flow quét toàn cục (App.tsx).
 */
function useScanCapture(onChangeText: ((t: string) => void) | undefined, enabled: boolean) {
  const burst = useRef<{ before: string; count: number; lastAt: number; latest: string } | null>(null);
  const prevValue = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  if (!onChangeText || !enabled) return onChangeText;

  return (text: string) => {
    const now = Date.now();
    const b = burst.current;
    if (b && now - b.lastAt < SCAN_KEY_GAP_MS) {
      b.count += 1;
      b.lastAt = now;
      b.latest = text;
    } else {
      burst.current = { before: prevValue.current, count: 1, lastAt: now, latest: text };
    }
    prevValue.current = text;
    onChangeText(text);

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const done = burst.current;
      burst.current = null;
      if (!done || done.count < MIN_SCAN_CHARS) return;
      const code = (done.latest.startsWith(done.before) ? done.latest.slice(done.before.length) : done.latest).trim();
      if (code.length < MIN_SCAN_CHARS) return;
      prevValue.current = done.before;
      onChangeText(done.before);
      triggerScan(code);
    }, SCAN_IDLE_MS);
  };
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, hint, required, containerStyle, wrapperStyle, leftIcon, rightIcon, style, scanCapture = true, ...rest },
  ref,
) {
  const onChangeText = useScanCapture(rest.onChangeText, scanCapture && !rest.multiline);
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
          wrapperStyle,
          error ? { borderColor: colors.danger } : null,
        ]}
      >
        {leftIcon && <View style={styles.icon}>{leftIcon}</View>}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textSubtle}
          style={[styles.input, style]}
          {...rest}
          onChangeText={onChangeText}
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
