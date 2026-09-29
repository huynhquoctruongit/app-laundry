import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';

const pad2 = (n: number) => n.toString().padStart(2, '0');

interface Props {
  label: string;
  value: Date | null;
  onChange: (d: Date | null) => void;
  /** Cho phép xoá về trống (hiện nút ×) */
  clearable?: boolean;
  disabled?: boolean;
}

/** Chọn ngày + giờ bằng 2 nút (Android không có picker gộp ngày-giờ). */
export function DateTimeField({ label, value, onChange, clearable, disabled }: Props) {
  const [mode, setMode] = useState<'date' | 'time' | null>(null);

  const base = value ?? new Date();
  const dateText = value ? `${pad2(value.getDate())}/${pad2(value.getMonth() + 1)}/${value.getFullYear()}` : 'Chọn ngày';
  const timeText = value ? `${pad2(value.getHours())}:${pad2(value.getMinutes())}` : '--:--';

  return (
    <View style={{ gap: 6, opacity: disabled ? 0.5 : 1 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable style={[styles.btn, { flex: 1 }]} onPress={() => setMode('date')} disabled={disabled}>
          <Icon name="calendar" size={18} color={colors.textMuted} />
          <Text style={styles.btnText}>{dateText}</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => setMode('time')} disabled={disabled}>
          <Icon name="clock-outline" size={18} color={colors.textMuted} />
          <Text style={styles.btnText}>{timeText}</Text>
        </Pressable>
        {clearable && value && !disabled ? (
          <Pressable style={styles.clear} onPress={() => onChange(null)} hitSlop={8}>
            <Icon name="close" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {mode && (
        <DateTimePicker
          value={base}
          mode={mode}
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, d) => {
            setMode(null);
            if (event.type !== 'set' || !d) {
              return;
            }
            const next = new Date(base);
            if (mode === 'date') {
              next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
            } else {
              next.setHours(d.getHours(), d.getMinutes(), 0, 0);
            }
            onChange(next);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
  },
  btnText: { fontSize: 15, color: colors.text },
  clear: { padding: 6 },
});
