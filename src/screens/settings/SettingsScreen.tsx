import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { settingsApi } from '@/api/settings.api';
import { extractError, setApiBaseUrl, getApiBaseUrl } from '@/api/client';
import { PrinterService } from '@/native/printer/PrinterService';
import { scanBluetoothDevices, connectBluetooth, isBluetoothEnabled } from '@/native/printer/drivers/BTDriver';
import type { BluetoothDevice } from '@/native/printer/types';
import { Modal, FlatList, ActivityIndicator } from 'react-native';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import type { ShopSettings } from '@/types/api';

type SettingsTab = 'shop' | 'invoice' | 'features' | 'api';

export function SettingsScreen() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<SettingsTab>('shop');

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
  });

  // Shop info
  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [logo, setLogo] = useState('');

  // Invoice
  const [invoiceFontSize, setInvoiceFontSize] = useState(24);
  const [customerNameFontSize, setCustomerNameFontSize] = useState(28);
  const [invoiceShowLogo, setInvoiceShowLogo] = useState(true);
  const [invoiceShowShopName, setInvoiceShowShopName] = useState(true);
  const [invoiceShowPhone, setInvoiceShowPhone] = useState(true);
  const [invoiceShowAddress, setInvoiceShowAddress] = useState(true);
  const [invoiceShowWebsite, setInvoiceShowWebsite] = useState(false);
  const [invoiceShowBarcode, setInvoiceShowBarcode] = useState(true);
  const [invoiceShowQR, setInvoiceShowQR] = useState(true);
  const [invoiceShowDebt, setInvoiceShowDebt] = useState(false);
  const [openingHours, setOpeningHours] = useState('');
  const [bookingShippingFee, setBookingShippingFee] = useState('');

  // Features
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [loyaltyPointsRate, setLoyaltyPointsRate] = useState('');
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState('');
  const [allowNoShiftOrder, setAllowNoShiftOrder] = useState(false);

  // API & printer
  const [apiUrl, setApiUrl] = useState('');
  const [savingApi, setSavingApi] = useState(false);

  useEffect(() => {
    if (!settingsQuery.data) return;
    const s = settingsQuery.data;
    setShopName(s.shopName ?? '');
    setPhone(s.phone ?? '');
    setAddress(s.address ?? '');
    setWebsite(s.website ?? '');
    setTaxCode(s.taxCode ?? '');
    setLogo(s.logo ?? '');

    setInvoiceFontSize(s.invoiceFontSize ?? 24);
    setCustomerNameFontSize(s.customerNameFontSize ?? 28);
    setInvoiceShowLogo(!!s.invoiceShowLogo);
    setInvoiceShowShopName(!!s.invoiceShowShopName);
    setInvoiceShowPhone(!!s.invoiceShowPhone);
    setInvoiceShowAddress(!!s.invoiceShowAddress);
    setInvoiceShowWebsite(!!s.invoiceShowWebsite);
    setInvoiceShowBarcode(!!s.invoiceShowBarcode);
    setInvoiceShowQR(!!s.invoiceShowQR);
    setInvoiceShowDebt(!!s.invoiceShowDebt);
    setOpeningHours(s.openingHours ?? '');
    setBookingShippingFee(
      s.bookingShippingFee != null ? String(s.bookingShippingFee) : '',
    );

    setLoyaltyEnabled(!!s.loyaltyEnabled);
    setLoyaltyPointsRate(s.loyaltyPointsRate != null ? String(s.loyaltyPointsRate) : '');
    setDeliveryEnabled(!!s.deliveryEnabled);
    setDeliveryFee(s.deliveryFee != null ? String(s.deliveryFee) : '');
    setAllowNoShiftOrder(!!s.allowNoShiftOrder);
  }, [settingsQuery.data]);

  useEffect(() => {
    (async () => {
      const url = await getApiBaseUrl();
      setApiUrl(url);
    })();
  }, []);

  const saveMutation = useMutation({
    mutationFn: (payload: Partial<ShopSettings>) => settingsApi.update(payload),
    onSuccess: (updated) => {
      // Cập nhật cache trực tiếp bằng kết quả PATCH — tránh GET phụ và race condition
      queryClient.setQueryData(['settings'], updated);
      Toast.show({ type: 'success', text1: 'Đã lưu cài đặt' });
    },
    onError: (err) => Toast.show({ type: 'error', text1: extractError(err).message }),
  });

  async function handleSaveApi() {
    try {
      setSavingApi(true);
      await setApiBaseUrl(apiUrl.trim());
      Toast.show({ type: 'success', text1: 'Đã lưu URL API' });
    } catch (err) {
      Toast.show({ type: 'error', text1: extractError(err).message });
    } finally {
      setSavingApi(false);
    }
  }

  const [printerBusy, setPrinterBusy] = useState(false);
  const [, setPrinterTick] = useState(0); // force re-render
  const [btModalVisible, setBtModalVisible] = useState(false);
  const [btScanning, setBtScanning] = useState(false);
  const [btDevices, setBtDevices] = useState<BluetoothDevice[]>([]);

  async function handleReconnect() {
    setPrinterBusy(true);
    PrinterService.getType() === 'bluetooth'
      ? null
      : await PrinterService.retryAsSunmi();
    await PrinterService.prepare();
    setPrinterTick((t) => t + 1);
    setPrinterBusy(false);
    if (PrinterService.isReady()) {
      Toast.show({ type: 'success', text1: 'Đã kết nối máy in' });
    } else {
      Toast.show({ type: 'error', text1: 'Không kết nối được máy in', text2: PrinterService.getError() ?? undefined });
    }
  }

  async function handlePrintTest() {
    setPrinterBusy(true);
    try {
      await PrinterService.printTest();
      Toast.show({ type: 'success', text1: 'Đã gửi đến máy in' });
    } catch (err) {
      Toast.show({ type: 'error', text1: extractError(err).message });
    } finally {
      setPrinterBusy(false);
    }
  }

  async function openBtScan() {
    setBtDevices([]);
    setBtModalVisible(true);
    setBtScanning(true);
    try {
      const enabled = await isBluetoothEnabled();
      if (!enabled) {
        Toast.show({ type: 'error', text1: 'Bluetooth chưa bật', text2: 'Bật Bluetooth rồi thử lại' });
        setBtModalVisible(false);
        return;
      }
      const { paired, found } = await scanBluetoothDevices();
      const all = [...paired, ...found].filter(
        (d, i, arr) => arr.findIndex((x) => x.address === d.address) === i,
      );
      setBtDevices(all);
    } catch (err) {
      Toast.show({ type: 'error', text1: extractError(err).message });
    } finally {
      setBtScanning(false);
    }
  }

  async function handleSelectBtDevice(device: BluetoothDevice) {
    setBtModalVisible(false);
    setPrinterBusy(true);
    try {
      const ok = await PrinterService.connectBluetooth(device);
      setPrinterTick((t) => t + 1);
      if (ok) {
        Toast.show({ type: 'success', text1: `Đã kết nối: ${device.name || device.address}` });
      } else {
        Toast.show({ type: 'error', text1: 'Kết nối thất bại', text2: PrinterService.getError() ?? undefined });
      }
    } finally {
      setPrinterBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsWrap}
        contentContainerStyle={styles.tabs}
      >
        {(
          [
            { value: 'shop', label: 'Cửa hàng', icon: 'storefront' },
            { value: 'invoice', label: 'Hóa đơn', icon: 'receipt' },
            { value: 'features', label: 'Tính năng', icon: 'star-cog' },
            { value: 'api', label: 'API & Máy in', icon: 'printer-settings' },
          ] as { value: SettingsTab; label: string; icon: string }[]
        ).map((t) => (
          <Pressable
            key={t.value}
            style={[styles.tab, tab === t.value && styles.tabActive]}
            onPress={() => setTab(t.value)}
          >
            <Icon name={t.icon} size={18} color={tab === t.value ? colors.primary : colors.textMuted} />
            <Text style={[styles.tabText, tab === t.value && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        {tab === 'shop' && (
          <Card>
            <CardHeader><CardTitle>Thông tin cửa hàng</CardTitle></CardHeader>
            <CardContent style={{ gap: spacing.md }}>
              <Input label="Tên cửa hàng" required value={shopName} onChangeText={setShopName} />
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Input label="Số điện thoại" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label="Mã số thuế" value={taxCode} onChangeText={setTaxCode} />
                </View>
              </View>
              <Input label="Địa chỉ" value={address} onChangeText={setAddress} />
              <Input label="Website" value={website} onChangeText={setWebsite} autoCapitalize="none" />
              <Input
                label="Logo (URL)"
                value={logo}
                onChangeText={setLogo}
                placeholder="https://..."
                autoCapitalize="none"
              />
              <Button
                onPress={() =>
                  saveMutation.mutate({
                    shopName,
                    phone: phone || null,
                    address: address || null,
                    website: website || null,
                    taxCode: taxCode || null,
                    logo: logo || null,
                  })
                }
                loading={saveMutation.isPending}
              >
                Lưu thay đổi
              </Button>
            </CardContent>
          </Card>
        )}

        {tab === 'invoice' && (
          <Card>
            <CardHeader><CardTitle>Hóa đơn & Tem nhãn</CardTitle></CardHeader>
            <CardContent style={{ gap: spacing.lg }}>
              <SizeStepper
                label="Cỡ chữ hóa đơn"
                value={invoiceFontSize}
                onChange={setInvoiceFontSize}
                min={16}
                max={48}
              />
              <SizeStepper
                label="Cỡ chữ tên khách hàng"
                value={customerNameFontSize}
                onChange={setCustomerNameFontSize}
                min={16}
                max={56}
              />

              <Text style={styles.sectionTitle}>Hiển thị trên hóa đơn</Text>
              <SwitchRow label="Logo" value={invoiceShowLogo} onChange={setInvoiceShowLogo} />
              <SwitchRow label="Tên cửa hàng" value={invoiceShowShopName} onChange={setInvoiceShowShopName} />
              <SwitchRow label="Số điện thoại" value={invoiceShowPhone} onChange={setInvoiceShowPhone} />
              <SwitchRow label="Địa chỉ" value={invoiceShowAddress} onChange={setInvoiceShowAddress} />
              <SwitchRow label="Website" value={invoiceShowWebsite} onChange={setInvoiceShowWebsite} />
              <SwitchRow label="Mã vạch" value={invoiceShowBarcode} onChange={setInvoiceShowBarcode} />
              <SwitchRow label="Mã QR" value={invoiceShowQR} onChange={setInvoiceShowQR} />
              <SwitchRow label="Hiển thị công nợ" value={invoiceShowDebt} onChange={setInvoiceShowDebt} />

              <Input
                label="Giờ mở cửa"
                value={openingHours}
                onChangeText={setOpeningHours}
                placeholder="7:00 - 22:00"
              />

              <Input
                label="Phí ship (đơn booking QR)"
                hint="Cộng thêm trên hoá đơn khi đơn đặt giao nhận qua mã QR"
                value={bookingShippingFee}
                onChangeText={setBookingShippingFee}
                keyboardType="numeric"
                placeholder="20000"
              />

              <Button
                onPress={() =>
                  saveMutation.mutate({
                    invoiceFontSize,
                    customerNameFontSize,
                    invoiceShowLogo,
                    invoiceShowShopName,
                    invoiceShowPhone,
                    invoiceShowAddress,
                    invoiceShowWebsite,
                    invoiceShowBarcode,
                    invoiceShowQR,
                    invoiceShowDebt,
                    openingHours: openingHours || null,
                    bookingShippingFee: bookingShippingFee
                      ? Number(bookingShippingFee)
                      : null,
                  })
                }
                loading={saveMutation.isPending}
              >
                Lưu thay đổi
              </Button>
            </CardContent>
          </Card>
        )}

        {tab === 'features' && (
          <Card>
            <CardHeader><CardTitle>Tính năng bổ sung</CardTitle></CardHeader>
            <CardContent style={{ gap: spacing.lg }}>
              <SwitchRow
                label="Bật tích điểm thành viên"
                description="Khách hàng tích điểm theo mỗi giao dịch"
                value={loyaltyEnabled}
                onChange={setLoyaltyEnabled}
              />
              {loyaltyEnabled && (
                <Input
                  label="Tỉ lệ tích điểm (đ/điểm)"
                  value={loyaltyPointsRate}
                  onChangeText={setLoyaltyPointsRate}
                  keyboardType="numeric"
                  placeholder="1000"
                />
              )}

              <SwitchRow
                label="Bật giao hàng"
                description="Cho phép đơn có ship"
                value={deliveryEnabled}
                onChange={setDeliveryEnabled}
              />
              {deliveryEnabled && (
                <Input
                  label="Phí giao hàng mặc định"
                  value={deliveryFee}
                  onChangeText={setDeliveryFee}
                  keyboardType="numeric"
                  placeholder="20000"
                />
              )}

              <SwitchRow
                label="Cho phép tạo đơn khi chưa mở ca"
                description="Bỏ ràng buộc phải mở ca trước khi tạo đơn"
                value={allowNoShiftOrder}
                onChange={setAllowNoShiftOrder}
              />

              <Button
                onPress={() =>
                  saveMutation.mutate({
                    loyaltyEnabled,
                    loyaltyPointsRate: loyaltyPointsRate ? Number(loyaltyPointsRate) : null,
                    deliveryEnabled,
                    deliveryFee: deliveryFee ? Number(deliveryFee) : null,
                    allowNoShiftOrder,
                  })
                }
                loading={saveMutation.isPending}
              >
                Lưu thay đổi
              </Button>
            </CardContent>
          </Card>
        )}

        {tab === 'api' && (
          <>
            <Card>
              <CardHeader><CardTitle>API Server</CardTitle></CardHeader>
              <CardContent style={{ gap: spacing.md }}>
                <Input
                  label="URL API"
                  value={apiUrl}
                  onChangeText={setApiUrl}
                  placeholder="https://laundry-qr-backend.onrender.com/api"
                  autoCapitalize="none"
                  hint="Đổi để trỏ về backend trong mạng LAN"
                />
                <Button onPress={handleSaveApi} loading={savingApi}>
                  Lưu URL
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Máy in</CardTitle></CardHeader>
              <CardContent style={{ gap: spacing.md }}>
                {/* Status */}
                <View style={styles.printerStatus}>
                  <Icon
                    name={PrinterService.isReady() ? 'check-circle' : PrinterService.isDetecting() ? 'loading' : 'close-circle'}
                    size={20}
                    color={PrinterService.isReady() ? colors.success : PrinterService.isDetecting() ? colors.textMuted : colors.danger}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text }}>
                      {PrinterService.isDetecting()
                        ? 'Đang tìm máy in…'
                        : PrinterService.isReady()
                          ? PrinterService.getType() === 'sunmi'
                            ? 'Sunmi built-in — sẵn sàng'
                            : `Bluetooth — sẵn sàng`
                          : 'Chưa kết nối máy in'}
                    </Text>
                    {!PrinterService.isReady() && PrinterService.getError() && (
                      <Text style={{ color: colors.danger, fontSize: 12, marginTop: 2 }}>
                        {PrinterService.getError()}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Actions */}
                <Button
                  variant="outline"
                  onPress={handleReconnect}
                  loading={printerBusy}
                  leftIcon={<Icon name="refresh" size={20} color={colors.text} />}
                >
                  Kết nối lại
                </Button>
                <Button
                  variant="outline"
                  onPress={openBtScan}
                  disabled={printerBusy}
                  leftIcon={<Icon name="bluetooth" size={20} color={colors.primary} />}
                >
                  {PrinterService.getType() === 'bluetooth' ? 'Đổi máy in Bluetooth' : 'Kết nối máy in Bluetooth'}
                </Button>
                <Button
                  variant="outline"
                  onPress={handlePrintTest}
                  loading={printerBusy}
                  disabled={!PrinterService.isReady()}
                  leftIcon={<Icon name="printer" size={20} color={colors.text} />}
                >
                  In thử trang test
                </Button>
              </CardContent>
            </Card>

            {/* BT Device Picker Modal */}
            <Modal visible={btModalVisible} transparent animationType="slide" onRequestClose={() => setBtModalVisible(false)}>
              <View style={styles.btModalBackdrop}>
                <View style={styles.btModalCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Chọn máy in Bluetooth</Text>
                    <Pressable onPress={() => setBtModalVisible(false)}>
                      <Icon name="close" size={22} color={colors.textMuted} />
                    </Pressable>
                  </View>

                  {btScanning && (
                    <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
                      <ActivityIndicator size="large" color={colors.primary} />
                      <Text style={{ color: colors.textMuted, marginTop: spacing.sm }}>Đang quét…</Text>
                    </View>
                  )}

                  {!btScanning && btDevices.length === 0 && (
                    <Text style={{ color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.xl }}>
                      Không tìm thấy thiết bị nào.{'\n'}Đảm bảo máy in đã bật và ở gần.
                    </Text>
                  )}

                  <FlatList
                    data={btDevices}
                    keyExtractor={(d) => d.address}
                    renderItem={({ item }) => (
                      <Pressable
                        style={styles.btDeviceRow}
                        onPress={() => handleSelectBtDevice(item)}
                      >
                        <Icon name="printer-wireless" size={22} color={colors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontWeight: '600' }}>{item.name || 'Thiết bị không tên'}</Text>
                          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.address}</Text>
                        </View>
                        <Icon name="chevron-right" size={20} color={colors.textMuted} />
                      </Pressable>
                    )}
                    ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
                  />

                  <Button variant="outline" onPress={openBtScan} disabled={btScanning} style={{ marginTop: spacing.md }}>
                    Quét lại
                  </Button>
                </View>
              </View>
            </Modal>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function SizeStepper({
  label,
  value,
  onChange,
  min = 12,
  max = 72,
}: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - 2))}
          style={styles.stepBtn}
        >
          <Icon name="minus" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.stepValueBox}>
          <Text style={styles.stepValue}>{value} px</Text>
        </View>
        <Pressable
          onPress={() => onChange(Math.min(max, value + 2))}
          style={styles.stepBtn}
        >
          <Icon name="plus" size={20} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

function SwitchRow({
  label,
  description,
  value,
  onChange,
}: { label: string; description?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1, paddingRight: spacing.md }}>
        <Text style={styles.switchLabel}>{label}</Text>
        {description && <Text style={styles.switchDesc}>{description}</Text>}
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabsWrap: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexGrow: 0,
    flexShrink: 0,
  },
  tabs: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.primary },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepBtn: {
    width: 48, height: 48, borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepValueBox: {
    flex: 1, height: 48, borderRadius: radius.md,
    backgroundColor: colors.inputBg,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepValue: { fontSize: 16, fontWeight: '700', color: colors.text },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  switchLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  switchDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  printerStatus: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, backgroundColor: colors.background,
    borderRadius: radius.md,
  },
  btModalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  btModalCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '70%',
  },
  btDeviceRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.md, paddingVertical: spacing.md,
  },
});
