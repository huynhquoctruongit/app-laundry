import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/hooks/useAuth';
import { colors } from '@/theme/colors';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { AppDrawer } from './AppDrawer';
import { OrderDetailScreen } from '@/screens/orders/OrderDetailScreen';
import { OrderCreateScreen } from '@/screens/orders/OrderCreateScreen';
import { BookingDetailScreen } from '@/screens/bookings/BookingDetailScreen';
import { ScannerScreen } from '@/screens/scanner/ScannerScreen';

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  OrderDetail: { id: string; autoPrint?: boolean };
  OrderCreate: { editId?: string } | undefined;
  BookingDetail: { id: string };
  Scanner: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

interface Props {
  navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList>>;
}

export function RootNavigator({ navigationRef }: Props) {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <>
            <Stack.Screen name="Main" component={AppDrawer} />
            <Stack.Screen
              name="OrderDetail"
              component={OrderDetailScreen}
              options={{ headerShown: true, title: 'Chi tiết đơn' }}
            />
            <Stack.Screen
              name="OrderCreate"
              component={OrderCreateScreen}
              options={({ route }) => ({
                headerShown: true,
                title: (route.params as any)?.editId ? 'Sửa đơn' : 'Tạo đơn mới',
              })}
            />
            <Stack.Screen
              name="BookingDetail"
              component={BookingDetailScreen}
              options={{ headerShown: true, title: 'Chi tiết đặt lịch' }}
            />
            <Stack.Screen
              name="Scanner"
              component={ScannerScreen}
              options={{ headerShown: true, title: 'Quét QR' }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
