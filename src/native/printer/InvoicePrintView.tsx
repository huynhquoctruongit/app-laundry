/**
 * InvoicePrintView — render hoá đơn tiếng Việt đầy đủ thành ảnh để in bitmap.
 *
 * Flow:
 *  1. Mount component này off-screen (position absolute, left -9999)
 *  2. Dùng react-native-view-shot capture thành base64 PNG
 *  3. Gửi base64 tới SunmiPrinterLibrary.printImage()
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Barcode128 } from '@/components/common/Barcode128';
import type { Order, ShopSettings } from '@/types/api';
import { calcInvoiceTotals } from '@/lib/invoice-totals';
import { calcLineTotal } from '@/lib/utils';
import { BRAND_NAME } from '@/helpers/constants/brand';

// Giấy 58mm → 384px. Giấy 80mm → 576px. Scale để font đủ lớn khi in.
export const PRINT_WIDTH_PX = 384;

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}
function money(v: number) {
  return v.toLocaleString('vi-VN') + 'đ';
}

interface Props {
  order: Order;
  settings: ShopSettings;
}

export function InvoicePrintView({ order, settings }: Props) {
  const date = new Date(order.createdAt);
  const dateStr = `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  const { subtotal, shippingFee, discount, grandTotal } = calcInvoiceTotals(order, settings);
  const total = subtotal;

  const Divider = () => (
    <View style={s.divider} />
  );

  return (
    <View style={s.paper}>
      {/* Shop name */}
      {settings.invoiceShowShopName && (
        <Text style={s.shopName}>{settings.shopName || BRAND_NAME}</Text>
      )}
      {settings.invoiceShowPhone && settings.phone ? (
        <Text style={s.center}>{settings.phone}</Text>
      ) : null}
      {settings.invoiceShowAddress && settings.address ? (
        <Text style={s.center}>{settings.address}</Text>
      ) : null}

      <Divider />

      {/* Title */}
      <Text style={s.title}>HÓA ĐƠN</Text>
      <Text style={s.center}>{order.code}  {dateStr}</Text>

      {/* Barcode (mã vạch để staff quét) */}
      {settings.invoiceShowBarcode && (
        <View style={s.codeBox}>
          <Barcode128 value={order.code} width={340} height={58} />
        </View>
      )}

      <Divider />

      {/* Customer */}
      <Text style={s.sectionLabel}>KHÁCH HÀNG</Text>
      <Text style={[s.customerName, { fontSize: Math.max(20, (settings.customerNameFontSize ?? 22)) }]}>
        {order.customer?.name ?? '—'}
      </Text>
      {order.customer?.phone ? <Text style={s.meta}>SĐT: {order.customer.phone}</Text> : null}
      {order.customer?.address ? <Text style={s.meta}>ĐC: {order.customer.address}</Text> : null}
      {order.note ? <Text style={s.meta}>Ghi chú: {order.note}</Text> : null}

      <Divider />

      {/* Table header */}
      <View style={s.row}>
        <Text style={[s.col1, s.bold]}>Dịch vụ</Text>
        <Text style={[s.col2, s.bold]}>SL</Text>
        <Text style={[s.col3, s.bold]}>Thành tiền</Text>
      </View>
      <Divider />

      {/* Items */}
      {order.items.map((it, i) => {
        const sub = calcLineTotal(it);
        const sl = it.weight ? `${it.quantity}(${it.weight}kg)` : `${it.quantity}`;
        return (
          <View key={i} style={s.row}>
            <Text style={s.col1}>{i + 1}.{it.name}</Text>
            <Text style={s.col2}>{sl}</Text>
            <Text style={s.col3}>{money(sub)}</Text>
          </View>
        );
      })}

      <Divider />

      {/* Totals */}
      {shippingFee > 0 ? (
        <>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Tạm tính</Text>
            <Text style={s.totalValue}>{money(subtotal)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Phí ship</Text>
            <Text style={s.totalValue}>+ {money(shippingFee)}</Text>
          </View>
        </>
      ) : null}
      {settings.invoiceShowDebt && discount > 0 ? (
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Giảm giá</Text>
          <Text style={s.totalValue}>- {money(discount)}</Text>
        </View>
      ) : null}
      <View style={s.totalRow}>
        <Text style={[s.totalLabel, s.bold, s.big]}>TỔNG CỘNG</Text>
        <Text style={[s.totalValue, s.bold, s.big]}>{money(grandTotal)}</Text>
      </View>

      {/* QR section — CTA nổi bật để khách đặt giao nhận tại nhà */}
      {settings.invoiceShowQR && order.qr?.url && (
        <>
          <View style={{ height: 6 }} />
          <View style={s.qrCta}>
            <Text style={s.qrTitle}>GIAO NHẬN ĐỒ TẬN NHÀ</Text>
            <Text style={s.qrSubtitle}>Quét mã QR để đặt đơn — miễn phí tới tận nơi</Text>
            <View style={s.qrBox}>
              <QRCode value={order.qr.url} size={210} color="#000" backgroundColor="#fff" />
            </View>
          </View>
        </>
      )}

      <Divider />
      {settings.openingHours ? (
        <Text style={s.center}>Giờ mở cửa: {settings.openingHours}</Text>
      ) : null}
      <Text style={[s.center, s.bold]}>Cảm ơn quý khách! Hẹn gặp lại.</Text>
      {/* Khoảng trắng đáy đủ lớn để nhát cắt rơi vào vùng trống,
          tránh footer bị dính sang đầu tờ kế tiếp (cutter cách đầu in ~12mm) */}
      <View style={{ height: 120 }} />
    </View>
  );
}

const FONT = 15;

const s = StyleSheet.create({
  paper: {
    width: PRINT_WIDTH_PX,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#000',
    marginVertical: 6,
  },
  center: { textAlign: 'center', fontSize: FONT, color: '#000' },
  codeBox: { alignItems: 'center', justifyContent: 'center', marginVertical: 6 },
  qrCta: {
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginVertical: 4,
  },
  qrTitle: {
    fontSize: FONT + 9,
    fontWeight: '900',
    color: '#000',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  qrSubtitle: {
    fontSize: FONT,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
    marginTop: 3,
    marginBottom: 8,
  },
  qrBox: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopName: { textAlign: 'center', fontSize: FONT + 6, fontWeight: '800', color: '#000' },
  title: { textAlign: 'center', fontSize: FONT + 6, fontWeight: '800', color: '#000', marginVertical: 2 },
  sectionLabel: { textAlign: 'center', fontSize: FONT - 1, color: '#333', marginBottom: 2 },
  customerName: { textAlign: 'center', fontWeight: '800', color: '#000', marginBottom: 2 },
  meta: { fontSize: FONT - 1, color: '#333' },
  row: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 2 },
  col1: { flex: 1, fontSize: FONT, color: '#000', flexWrap: 'wrap' },
  col2: { width: 50, textAlign: 'center', fontSize: FONT, color: '#000' },
  col3: { width: 90, textAlign: 'right', fontSize: FONT, color: '#000' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 1 },
  totalLabel: { fontSize: FONT, color: '#000' },
  totalValue: { fontSize: FONT, color: '#000' },
  bold: { fontWeight: '700' },
  big: { fontSize: FONT + 3 },
});
