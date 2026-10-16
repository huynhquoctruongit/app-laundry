/**
 * Tạo nội dung mã VietQR (chuẩn EMVCo / NAPAS 247) ngay trên máy — không cần tải ảnh
 * từ img.vietqr.io. In hoá đơn không còn phụ thuộc mạng (trước đây mạng chậm/lỗi → QR trắng).
 * Kết quả giống hệt mã của img.vietqr.io (đã đối chiếu từng ký tự).
 */

function tlv(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, '0')}${value}`;
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) — theo chuẩn EMVCo. */
function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Nội dung CK: bỏ dấu + ký tự đặc biệt như img.vietqr.io ("LD-20261016-ABCDE" → "LD20261016ABCDE"). */
function cleanInfo(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50);
}

export function buildVietQrPayload(opts: {
  bankBin: string;
  accountNumber: string;
  amount?: number;
  addInfo?: string;
}): string {
  const beneficiary = tlv('00', opts.bankBin) + tlv('01', opts.accountNumber.replace(/\s/g, ''));
  const merchant = tlv('00', 'A000000727') + tlv('01', beneficiary) + tlv('02', 'QRIBFTTA');
  const amount = opts.amount && opts.amount > 0 ? Math.round(opts.amount) : 0;
  const info = opts.addInfo ? cleanInfo(opts.addInfo) : '';

  let s =
    tlv('00', '01') +
    tlv('01', amount ? '12' : '11') + // 12 = mã động (có số tiền), 11 = mã tĩnh
    tlv('38', merchant) +
    tlv('53', '704') + // VND
    (amount ? tlv('54', String(amount)) : '') +
    tlv('58', 'VN') +
    (info ? tlv('62', tlv('08', info)) : '');
  s += '6304';
  return s + crc16(s);
}
