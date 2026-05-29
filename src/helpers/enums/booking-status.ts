export const BookingStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  CONVERTED: 'CONVERTED',
} as const;

export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: 'Chờ duyệt',
  CONFIRMED: 'Đã duyệt',
  CANCELLED: 'Đã từ chối',
  CONVERTED: 'Đã tạo đơn',
};

export const BOOKING_STATUS_COLOR: Record<BookingStatus, { bg: string; fg: string }> = {
  PENDING: { bg: '#fef3c7', fg: '#92400e' },
  CONFIRMED: { bg: '#dbeafe', fg: '#1e40af' },
  CANCELLED: { bg: '#fee2e2', fg: '#991b1b' },
  CONVERTED: { bg: '#d1fae5', fg: '#065f46' },
};
