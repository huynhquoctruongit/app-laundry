import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { formatCurrency } from '@/lib/utils';
import { playCoinSound } from '@/lib/sound';
import type { Order } from '@/types/api';

interface Props {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
  autoCloseMs?: number;
}

export function BarcodeSuccessModal({
  visible,
  order,
  onClose,
  autoCloseMs = 3000,
}: Props) {
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkRotate = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslate = useRef(new Animated.Value(20)).current;
  const progress = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible && order) {
      // Âm thanh "đồng xu rơi" khi popup hoàn thành hiện lên
      playCoinSound();
      // Reset
      checkScale.setValue(0);
      checkRotate.setValue(0);
      cardOpacity.setValue(0);
      cardTranslate.setValue(20);
      progress.setValue(1);

      // Card slide-up + fade-in
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslate, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      // Checkmark spring + rotation
      Animated.sequence([
        Animated.delay(120),
        Animated.parallel([
          Animated.spring(checkScale, {
            toValue: 1,
            damping: 9,
            stiffness: 140,
            useNativeDriver: true,
          }),
          Animated.timing(checkRotate, {
            toValue: 1,
            duration: 600,
            easing: Easing.out(Easing.back(2)),
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      // Progress bar countdown
      Animated.timing(progress, {
        toValue: 0,
        duration: autoCloseMs,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();

      // Auto-dismiss
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(onClose, autoCloseMs);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, order?.id]);

  if (!order) return null;

  const remaining =
    Number(order.totalAmount) - Number(order.discountAmount ?? 0);
  const itemNames = order.items
    .map((i) => i.name)
    .filter(Boolean)
    .join(', ');

  const rotateInterpolate = checkRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-30deg', '0deg'],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: cardOpacity,
              transform: [{ translateY: cardTranslate }],
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          {/* Checkmark — vòng tròn xanh có shadow + glow */}
          <View style={styles.checkOuter}>
            <Animated.View
              style={[
                styles.checkCircle,
                {
                  transform: [
                    { scale: checkScale },
                    { rotate: rotateInterpolate },
                  ],
                },
              ]}
            >
              <Icon name="check-bold" size={56} color="#fff" />
            </Animated.View>
          </View>

          <Text style={styles.subtitle}>Đã giao thành công</Text>

          <Text style={styles.customerName} numberOfLines={1}>
            {order.customer?.name ?? '—'}
          </Text>
          {order.customer?.phone ? (
            <Text style={styles.phone}>{order.customer.phone}</Text>
          ) : null}

          {/* Tiền nổi bật */}
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Tiền đã thu</Text>
            <Text style={styles.amount}>{formatCurrency(remaining)}</Text>
          </View>

          {/* Code + items */}
          <View style={styles.metaBlock}>
            <Text style={styles.code}>{order.code}</Text>
            {itemNames ? (
              <Text style={styles.items} numberOfLines={2}>
                {itemNames}
              </Text>
            ) : null}
          </View>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
          <Text style={styles.tapHint}>Chạm để đóng</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  checkOuter: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.successLight,
    marginBottom: spacing.md,
  },
  checkCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.success,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  customerName: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  phone: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  amountBox: {
    width: '100%',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  amountLabel: {
    fontSize: 12,
    color: '#065f46',
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  amount: {
    fontSize: 34,
    fontWeight: '800',
    color: '#065f46',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  metaBlock: {
    width: '100%',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: 4,
  },
  code: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  items: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  progressTrack: {
    width: '100%',
    height: 3,
    borderRadius: 999,
    backgroundColor: colors.background,
    marginTop: spacing.lg,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 999,
  },
  tapHint: {
    fontSize: 11,
    color: colors.textSubtle,
    marginTop: 6,
    letterSpacing: 0.3,
  },
});
