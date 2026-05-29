import React, { useState } from 'react';
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import QRCode from 'react-native-qrcode-svg';
import { Barcode128 } from '@/components/common/Barcode128';
import Toast from 'react-native-toast-message';
import { Button } from '@/components/ui/Button';
import { extractError } from '@/api/client';
import { PrinterService } from '@/native/printer/PrinterService';
import { withTimeout } from '@/native/SunmiPrinter';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/spacing';
import { calcInvoiceTotals } from '@/lib/invoice-totals';
import { calcLineTotal, formatCurrency, formatDateTime } from '@/lib/utils';
import { BRAND_NAME } from '@/helpers/constants/brand';
import type { Order, ShopSettings } from '@/types/api';

interface Props {
  visible: boolean;
  onClose: () => void;
  order: Order | null;
  settings: ShopSettings | null;
}

export function InvoicePreviewModal({ visible, onClose, order, settings }: Props) {
  const [printing, setPrinting] = useState(false);

  async function handlePrint() {
    if (!order || !settings) return;
    setPrinting(true);
    try {
      if (!PrinterService.isReady()) {
        Toast.show({
          type: 'error',
          text1: 'Chưa kết nối máy in',
          text2: PrinterService.getError() ?? 'Vào Cài đặt → Máy in để thiết lập',
        });
        return;
      }
      await withTimeout(PrinterService.printInvoice(order, settings), 45000);
      Toast.show({ type: 'success', text1: 'Đã gửi đến máy in' });
      onClose();
    } catch (err) {
      Toast.show({ type: 'error', text1: extractError(err).message });
    } finally {
      setPrinting(false);
    }
  }

  if (!order || !settings) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.modalTitle}>Đang tải dữ liệu hoá đơn…</Text>
            <Button variant="outline" onPress={onClose} fullWidth>Đóng</Button>
          </View>
        </View>
      </Modal>
    );
  }

  const date = new Date(order.createdAt);
  const dateStr =
    `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const { subtotal, shippingFee, discount, grandTotal } = calcInvoiceTotals(order, settings);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Modal header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Xem trước hoá đơn</Text>
            <Text style={styles.modalSubtitle}>{order.code}</Text>
          </View>

          <ScrollView style={styles.receiptWrap} contentContainerStyle={styles.receipt}>

            {/* ── 1. SHOP HEADER ── */}
            {settings.invoiceShowLogo && settings.logo ? (
              <Image source={{ uri: settings.logo }} style={styles.logo} resizeMode="contain" />
            ) : null}

            {settings.invoiceShowShopName ? (
              <Text style={styles.shopName}>
                {(settings.shopName || BRAND_NAME).toUpperCase()}
              </Text>
            ) : null}

            {(settings.invoiceShowAddress && settings.address) ||
             (settings.invoiceShowPhone && settings.phone) ? (
              <View style={styles.shopContactBlock}>
                {settings.invoiceShowAddress && settings.address ? (
                  <Text style={styles.shopContact}>{settings.address}</Text>
                ) : null}
                {settings.invoiceShowPhone && settings.phone ? (
                  <Text style={styles.shopContact}>{settings.phone}</Text>
                ) : null}
              </View>
            ) : null}

            {settings.invoiceShowWebsite && settings.website ? (
              <Text style={styles.shopContactSmall}>{settings.website}</Text>
            ) : null}

            <Dashed />

            {/* ── 2. HOÁ ĐƠN TITLE ── */}
            <Text style={styles.invoiceTitle}>HÓA ĐƠN</Text>
            <Text style={styles.invoiceMeta}>{order.code}  ·  {dateStr}</Text>

            {order.fromBooking ? (
              <View style={styles.deliveryTag}>
                <Text style={styles.deliveryTagTitle}>GIAO NHẬN</Text>
                <Text style={styles.deliveryTagSub}>
                  Đơn đặt qua mã QR — shipper đi giao
                </Text>
                {order.booking?.code ? (
                  <Text style={styles.deliveryTagMeta}>{order.booking.code}</Text>
                ) : null}
                {order.pickupAt ? (
                  <Text style={styles.deliveryTagMeta}>
                    Hẹn lấy: {formatDateTime(order.pickupAt)}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {settings.invoiceShowBarcode ? (
              <View style={styles.barcodeWrap}>
                <Barcode128 value={order.code} width={280} height={52} />
              </View>
            ) : null}

            <Dashed />

            {/* ── 3. CUSTOMER INFO ── */}
            <View style={styles.customerBlock}>
              <Text style={styles.sectionLabel}>KHÁCH HÀNG</Text>
              <Text style={styles.customerName}>{order.customer?.name ?? '—'}</Text>

              {order.note ? (
                <View style={styles.infoRow}>
                  <Icon name="note-text-outline" size={12} color="#888" />
                  <Text style={styles.infoText}>{order.note}</Text>
                </View>
              ) : null}
              {order.customer?.phone ? (
                <View style={styles.infoRow}>
                  <Icon name="phone-outline" size={12} color="#888" />
                  <Text style={styles.infoText}>{order.customer.phone}</Text>
                </View>
              ) : null}
              {order.customer?.address ? (
                <View style={styles.infoRow}>
                  <Icon name="map-marker-outline" size={12} color="#888" />
                  <Text style={styles.infoText}>{order.customer.address}</Text>
                </View>
              ) : null}
            </View>

            <Dashed />

            {/* ── 4. ITEMS TABLE ── */}
            <View style={styles.tableHeader}>
              <Text style={[styles.colName, styles.tableHead]}>Dịch vụ</Text>
              <Text style={[styles.colQty, styles.tableHead]}>SL</Text>
              <Text style={[styles.colPrice, styles.tableHead]}>T.Tiền</Text>
            </View>
            {order.items.map((it, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.colName} numberOfLines={2}>
                  {i + 1}. {it.name}
                </Text>
                <Text style={styles.colQty}>
                  {it.weight ? `${it.quantity}(${it.weight}kg)` : it.quantity}
                </Text>
                <Text style={styles.colPrice}>
                  {calcLineTotal(it).toLocaleString('vi-VN')}
                </Text>
              </View>
            ))}

            {/* Đơn booking: thêm dòng phí giao hàng vào bảng items */}
            {order.fromBooking && shippingFee > 0 ? (
              <View style={[styles.tableRow, styles.shipRow]}>
                <Text style={[styles.colName, styles.shipLabel]}>🚚 Phí giao hàng</Text>
                <Text style={styles.colQty}>1</Text>
                <Text style={[styles.colPrice, styles.shipLabel]}>
                  {formatCurrency(shippingFee)}
                </Text>
              </View>
            ) : null}

            <Dashed />

            {/* ── 5. TOTALS ── */}
            {/* Ship đã hiện trong items → totals chỉ cần Tam tinh + Giam gia + Tong cong */}
            {settings.invoiceShowDebt && discount > 0 ? (
              <>
                <View style={styles.totalRow}>
                  <Text style={styles.subLabel}>Tạm tính</Text>
                  <Text style={styles.subValue}>{formatCurrency(subtotal + shippingFee)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.subLabel}>Giảm giá</Text>
                  <Text style={styles.subValue}>- {formatCurrency(discount)}</Text>
                </View>
              </>
            ) : null}
            <View style={[styles.totalRow, styles.remainingRow]}>
              <Text style={styles.remainingLabel}>Tổng cộng</Text>
              <Text style={styles.remainingValue}>{formatCurrency(grandTotal)}</Text>
            </View>

            {/* ── 6. QR (viền đen trắng, phù hợp in nhiệt) ── */}
            {settings.invoiceShowQR && order.qr?.url ? (
              <>
                <Dashed />
                <View style={styles.qrSection}>
                  <Text style={styles.qrHeadline}>
                    Dịch vụ giao nhận đồ tại nhà
                  </Text>
                  <Text style={styles.qrBody}>
                    Quét mã và đặt đơn — không cần làm gì thêm,{'\n'}chỉ nhập 1 lần duy nhất
                  </Text>
                  <View style={styles.qrCodeBox}>
                    <QRCode value={order.qr.url} size={140} color="#000" backgroundColor="#fff" />
                  </View>
                </View>
              </>
            ) : null}

            <Dashed />

            {/* ── 7. FOOTER ── */}
            {settings.openingHours ? (
              <Text style={styles.footerText}>Giờ mở cửa: {settings.openingHours}</Text>
            ) : null}
            <Text style={styles.footerText}>Cam on quy khach! Hen gap lai.</Text>

          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <Button variant="outline" onPress={onClose} style={{ flex: 1 }} disabled={printing}>
              Đóng
            </Button>
            <Button
              onPress={handlePrint}
              loading={printing}
              style={{ flex: 2 }}
              leftIcon={<Icon name="printer" size={20} color="#fff" />}
            >
              In ngay
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Dashed() {
  return <View style={styles.dashed} />;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    maxHeight: '95%',
  },

  // Modal chrome
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  modalSubtitle: { fontSize: 13, color: colors.textMuted, fontFamily: 'monospace' },

  // Receipt paper
  receiptWrap: { flexGrow: 0, flexShrink: 1, maxHeight: 540 },
  receipt: {
    padding: spacing.md,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    gap: 4,
    alignItems: 'center',
  },

  // Shop header
  logo: { height: 40, width: 120, marginBottom: 4 },
  shopName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  shopContactBlock: { alignItems: 'center', gap: 2, marginTop: 2 },
  shopContact: { fontSize: 12, color: '#333', fontWeight: '600', textAlign: 'center' },
  shopContactSmall: { fontSize: 11, color: '#666', textAlign: 'center' },

  // Invoice title
  invoiceTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
    marginTop: 2,
  },
  invoiceMeta: { fontSize: 11, color: '#666', fontFamily: 'monospace' },

  deliveryTag: {
    width: '100%',
    marginVertical: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: radius.sm,
    alignItems: 'center',
    gap: 3,
  },
  deliveryTagTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },
  deliveryTagSub: {
    fontSize: 11,
    color: '#333',
    textAlign: 'center',
  },
  deliveryTagMeta: {
    fontSize: 11,
    color: '#444',
    fontFamily: 'monospace',
    textAlign: 'center',
  },

  barcodeWrap: { marginVertical: 4 },

  // Divider
  dashed: {
    height: 1,
    width: '100%',
    borderTopWidth: 1,
    borderColor: '#ccc',
    borderStyle: 'dashed',
    marginVertical: 4,
  },

  // Customer
  customerBlock: { width: '100%', alignItems: 'center', gap: 3 },
  sectionLabel: { fontSize: 10, color: '#999', letterSpacing: 1, fontWeight: '600' },
  customerName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000',
    textAlign: 'center',
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, alignSelf: 'center' },
  infoText: { fontSize: 11, color: '#555', flexShrink: 1 },

  // Items table
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    backgroundColor: '#f3f4f6',
    width: '100%',
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 4,
    width: '100%',
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  shipRow: {
    backgroundColor: '#f0fdf4',
  },
  shipLabel: {
    fontWeight: '600',
    color: '#15803d',
  },
  tableHead: { fontWeight: '700', color: '#000', fontSize: 11 },
  colName: { flex: 1, fontSize: 11, color: '#000' },
  colQty: { width: 52, textAlign: 'center', fontSize: 11, color: '#000' },
  colPrice: { width: 72, textAlign: 'right', fontSize: 11, color: '#000' },

  // Totals
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  totalLabel: { fontSize: 13, fontWeight: '700', color: '#000' },
  totalValue: { fontSize: 13, fontWeight: '700', color: '#000' },
  subLabel: { fontSize: 11, color: '#777' },
  subValue: { fontSize: 11, color: '#777' },
  remainingRow: { marginTop: 2 },
  remainingLabel: { fontSize: 14, fontWeight: '900', color: '#000' },
  remainingValue: { fontSize: 14, fontWeight: '900', color: '#000' },

  // QR — chỉ viền, không tô nền (in nhiệt trắng đen)
  qrSection: {
    width: '100%',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: radius.sm,
  },
  qrCodeBox: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: radius.sm,
  },
  qrHeadline: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  qrBody: {
    fontSize: 12,
    color: '#444',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Footer
  footerText: { fontSize: 11, color: '#777', textAlign: 'center' },

  // Actions
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
});
