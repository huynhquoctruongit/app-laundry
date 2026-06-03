import React from 'react';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '@/hooks/useAuth';
import { useResponsive } from '@/hooks/useResponsive';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { BRAND_NAME } from '@/helpers/constants/brand';

import { DashboardScreen } from '@/screens/dashboard/DashboardScreen';
import { OrdersScreen } from '@/screens/orders/OrdersScreen';
import { OrderAuditScreen } from '@/screens/orders/OrderAuditScreen';
import { BookingsScreen } from '@/screens/bookings/BookingsScreen';
import { CustomersScreen } from '@/screens/customers/CustomersScreen';
import { ProductsScreen } from '@/screens/products/ProductsScreen';
import { SuppliersScreen } from '@/screens/suppliers/SuppliersScreen';
import { InventoryScreen } from '@/screens/inventory/InventoryScreen';
import { FinanceScreen } from '@/screens/finance/FinanceScreen';
import { DebtsScreen } from '@/screens/debts/DebtsScreen';
import { DebtScreen } from '@/screens/debts/DebtScreen';
import { ShiftsScreen } from '@/screens/shifts/ShiftsScreen';
import { ReportsScreen } from '@/screens/reports/ReportsScreen';
import { StaffScreen } from '@/screens/staff/StaffScreen';
import { SettingsScreen } from '@/screens/settings/SettingsScreen';

const Drawer = createDrawerNavigator();

type IconName = string;

const NAV_ITEMS: { name: string; label: string; component: React.ComponentType<any>; icon: IconName; adminOnly?: boolean }[] = [
  { name: 'Dashboard', label: 'Tổng quan', component: DashboardScreen, icon: 'view-dashboard' },
  { name: 'Orders', label: 'Đơn hàng', component: OrdersScreen, icon: 'package-variant' },
  { name: 'Audit', label: 'Rà soát đơn', component: OrderAuditScreen, icon: 'magnify-scan' },
  { name: 'Bookings', label: 'Đặt lịch', component: BookingsScreen, icon: 'calendar-clock' },
  { name: 'OrderDebts', label: 'Đơn nợ', component: DebtScreen, icon: 'cash-clock' },
  { name: 'Customers', label: 'Khách hàng', component: CustomersScreen, icon: 'account-group' },
  { name: 'Suppliers', label: 'Nhà cung cấp', component: SuppliersScreen, icon: 'truck-delivery' },
  { name: 'Products', label: 'Dịch vụ', component: ProductsScreen, icon: 'tag-multiple' },
  { name: 'Inventory', label: 'Kho hàng', component: InventoryScreen, icon: 'warehouse' },
  { name: 'Finance', label: 'Thu chi', component: FinanceScreen, icon: 'wallet' },
  { name: 'Debts', label: 'Sổ nợ', component: DebtsScreen, icon: 'book-open-variant' },
  { name: 'Shifts', label: 'Ca làm việc', component: ShiftsScreen, icon: 'clock-outline' },
  { name: 'Reports', label: 'Báo cáo', component: ReportsScreen, icon: 'chart-bar' },
  { name: 'Staff', label: 'Nhân viên', component: StaffScreen, icon: 'account-cog', adminOnly: true },
  { name: 'Settings', label: 'Cài đặt', component: SettingsScreen, icon: 'cog', adminOnly: true },
];

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { user, logout } = useAuth();

  return (
    <View style={{ flex: 1 }}>
      {/* Scrollable area: brand + user + nav items */}
      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingBottom: 8 }}>
        {/* Brand header */}
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Icon name="washing-machine" size={24} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.brandName}>{BRAND_NAME}</Text>
            <Text style={styles.brandSub}>Quản lý giặt sấy</Text>
          </View>
        </View>

        {/* User chip */}
        <View style={styles.userChip}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() ?? 'U'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.userRole}>{user?.role}</Text>
          </View>
        </View>

        <DrawerItemList {...props} />
      </DrawerContentScrollView>

      {/* Logout — cố định ở đáy, không bị scroll che */}
      <Pressable style={styles.logout} onPress={logout}>
        <Icon name="logout" size={20} color={colors.danger} />
        <Text style={styles.logoutText}>Đăng xuất</Text>
      </Pressable>
    </View>
  );
}

export function AppDrawer() {
  const { user } = useAuth();
  const { isPhone } = useResponsive();
  const isAdmin = user?.role === 'ADMIN';
  const items = NAV_ITEMS.filter((i) => !i.adminOnly || isAdmin);

  return (
    <Drawer.Navigator
      initialRouteName="Dashboard"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        // Phone: drawer slide-in từ trái (mặc định ẩn, có hamburger để mở)
        // POS/tablet: drawer permanent luôn hiển thị
        drawerType: isPhone ? 'front' : 'permanent',
        drawerStyle: {
          width: isPhone ? 280 : 240,
          backgroundColor: colors.card,
          borderRightColor: colors.border,
          borderRightWidth: 1,
        },
        drawerActiveBackgroundColor: colors.primary,
        drawerActiveTintColor: '#fff',
        drawerInactiveTintColor: colors.textMuted,
        drawerLabelStyle: { fontSize: 15, fontWeight: '500', marginLeft: -16 },
        drawerItemStyle: { borderRadius: 8, marginHorizontal: 8, paddingHorizontal: 4 },
        headerStyle: { backgroundColor: colors.card, borderBottomColor: colors.border, borderBottomWidth: 1 },
        headerTitleStyle: { fontSize: 18, fontWeight: '700', color: colors.text },
        // Trên phone hiện hamburger để mở drawer
        headerShown: true,
      }}
    >
      {items.map((item) => (
        <Drawer.Screen
          key={item.name}
          name={item.name}
          component={item.component}
          options={{
            title: item.label,
            drawerIcon: ({ color, size }) => <Icon name={item.icon} color={color} size={size} />,
          }}
        />
      ))}
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logo: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  brandName: { fontSize: 15, fontWeight: '700', color: colors.text },
  brandSub: { fontSize: 11, color: colors.textMuted },
  userChip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, margin: spacing.md, borderRadius: 8, backgroundColor: colors.background,
  },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontWeight: '700', color: colors.primary },
  userName: { fontSize: 13, fontWeight: '600', color: colors.text },
  userRole: { fontSize: 11, color: colors.textMuted },
  logout: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border,
  },
  logoutText: { color: colors.danger, fontWeight: '600' },
});
