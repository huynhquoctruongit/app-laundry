/**
 * InvoicePrintView — render hoá đơn tiếng Việt đầy đủ thành ảnh để in bitmap.
 *
 * Flow:
 *  1. Mount component này off-screen (position absolute, left -9999)
 *  2. Dùng react-native-view-shot capture thành base64 PNG
 *  3. Gửi base64 tới SunmiPrinterLibrary.printImage()
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Barcode128 } from '@/components/common/Barcode128';
import type { Order, ShopSettings } from '@/types/api';
import { calcInvoiceTotals } from '@/lib/invoice-totals';
import { calcLineTotal, orderCodeSuffix } from '@/lib/utils';
import { BRAND_NAME } from '@/helpers/constants/brand';

// Giấy 58mm → 384px. Giấy 80mm → 576px. Scale để font đủ lớn khi in.
export const PRINT_WIDTH_PX = 384;

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}
function money(v: number) {
  return v.toLocaleString('vi-VN') + 'đ';
}
/** Dòng quảng cáo freeship theo ngưỡng cấu hình */
function freeShipLine(threshold?: number | null): string {
  const t = Number(threshold ?? 0);
  if (t > 0) {
    const k = t % 1000 === 0 ? `${t / 1000}k` : money(t);
    return `MIỄN PHÍ giao nhận cho đơn hàng trên ${k}`;
  }
  return 'Miễn phí giao nhận tận nơi';
}

interface Props {
  order: Order;
  settings: ShopSettings;
}

/**
 * Toàn bộ hoá đơn (tiếng Việt có dấu) dưới dạng 1 ảnh — in bằng 1 lệnh printPic
 * duy nhất → 1 tờ liền (máy BT tự cắt sau mỗi printPic nên không gọi 2 lần).
 * Barcode được in RIÊNG bằng lệnh gốc (sắc nét) NÊN KHÔNG nằm trong ảnh này.
 */
export function InvoicePrintView({ order, settings }: Props) {
  const date = new Date(order.createdAt);
  const dateStr = `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  const { subtotal, shippingFee, discount, grandTotal } = calcInvoiceTotals(order, settings);
  const total = subtotal;

  // Cỡ chữ lấy từ cài đặt (clamp về khoảng hợp lý cho ảnh in)
  const baseFont = clamp(settings.invoiceFontSize ?? 15, 12, 26);
  const nameFont = clamp(settings.customerNameFontSize ?? 22, 16, 34);
  const s = useMemo(() => makeStyles(baseFont), [baseFont]);

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

      {/* Barcode mã hoá ĐUÔI mã đơn (ngắn → vạch to → quét nhạy); in trong ảnh
          nên KHÔNG bị tách tờ. Mã đầy đủ vẫn in dạng chữ ở dòng trên. */}
      {settings.invoiceShowBarcode && (
        <View style={s.codeBox}>
          <Barcode128 value={orderCodeSuffix(order.code)} width={300} height={90} quietZone={18} />
        </View>
      )}

      <Divider />

      {/* Customer */}
      <Text style={s.sectionLabel}>KHÁCH HÀNG</Text>
      <Text style={[s.customerName, { fontSize: nameFont }]}>
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
            <Text style={s.qrSubtitle}>{freeShipLine(settings.freeShipThreshold)}</Text>
            <View style={s.qrBox}>
              <QRCode value={order.qr.url} size={210} color="#000" backgroundColor="#fff" />
            </View>
          </View>
        </>
      )}

      {/* Tag SHIP cho đơn đặt lịch — bottom, center */}
      {order.fromBooking && (
        <View style={s.shipTag}>
          <Icon name="truck-fast" size={18} color="#000" />
          <Text style={s.shipTagText}>ĐƠN GIAO TẬN NHÀ</Text>
        </View>
      )}

      <Divider />
      {settings.openingHours ? (
        <Text style={s.center}>Giờ mở cửa: {settings.openingHours}</Text>
      ) : null}
      <Text style={[s.center, s.bold]}>Cảm ơn quý khách! Hẹn gặp lại.</Text>
      {/* Lề DƯỚI: vừa tránh nhát cắt phạm vào "Cảm ơn", vừa cân với lề trên
          (lề trên là khe vật lý đầu in→dao cắt, không giảm được bằng phần mềm
          nên nới lề dưới cho cân, không bị hẹp). */}
      <View style={{ height: 100 }} />
    </View>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/** Styles theo cỡ chữ FONT (px trong ảnh 384) — cột co theo font để không tràn */
function makeStyles(FONT: number) {
  const col2W = Math.round(FONT * 3.2); // cột SL
  const col3W = Math.round(FONT * 6);   // cột Thành tiền
  return StyleSheet.create({
    paper: {
      width: PRINT_WIDTH_PX,
      backgroundColor: '#fff',
      paddingHorizontal: 12,
      paddingTop: 0,
      paddingBottom: 0,
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
    shipTag: {
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 8,
      marginBottom: 2,
      borderWidth: 2,
      borderColor: '#000',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 5,
    },
    shipTagText: { fontSize: FONT + 1, fontWeight: '900', color: '#000', letterSpacing: 0.5 },
    shopName: { textAlign: 'center', fontSize: FONT + 6, fontWeight: '800', color: '#000' },
    title: { textAlign: 'center', fontSize: FONT + 6, fontWeight: '800', color: '#000', marginVertical: 2 },
    sectionLabel: { textAlign: 'center', fontSize: FONT - 1, color: '#333', marginBottom: 2 },
    customerName: { textAlign: 'center', fontWeight: '800', color: '#000', marginBottom: 2 },
    meta: { fontSize: FONT - 1, color: '#333' },
    row: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 2 },
    col1: { flex: 1, fontSize: FONT, color: '#000', flexWrap: 'wrap' },
    col2: { width: col2W, textAlign: 'center', fontSize: FONT, color: '#000' },
    col3: { width: col3W, textAlign: 'right', fontSize: FONT, color: '#000' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 1 },
    totalLabel: { fontSize: FONT, color: '#000' },
    totalValue: { fontSize: FONT, color: '#000' },
    bold: { fontWeight: '700' },
    big: { fontSize: FONT + 3 },
  });
}
