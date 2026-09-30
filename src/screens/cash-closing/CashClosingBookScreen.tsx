import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ClosingBook } from '@/components/common/CashClosingButton';
import { useResponsive } from '@/hooks/useResponsive';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

/** Menu "Chốt két": sổ chốt két theo tháng + tổng lệch của tháng (chốt két làm ở nút nổi / header). */
export function CashClosingBookScreen() {
  const { isPhone } = useResponsive();
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: isPhone ? spacing.md : spacing.lg, paddingBottom: 220 }}>
        <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center' }}>
          <ClosingBook showSummary />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});
