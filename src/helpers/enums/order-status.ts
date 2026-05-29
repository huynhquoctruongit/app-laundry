export const OrderStatus = {
  CREATED: 'CREATED',
  RECEIVED: 'RECEIVED',
  WASHING: 'WASHING',
  READY: 'READY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;

export type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  CREATED: 'Đã tạo',
  RECEIVED: 'Đã nhận đồ',
  WASHING: 'Đang giặt/sấy',
  READY: 'Đã giặt xong',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã huỷ',
};

export const ORDER_STATUS_COLOR: Record<OrderStatus, { bg: string; fg: string }> = {
  CREATED: { bg: '#f3f4f6', fg: '#374151' },
  RECEIVED: { bg: '#dbeafe', fg: '#1e40af' },
  WASHING: { bg: '#fef3c7', fg: '#92400e' },
  READY: { bg: '#ede9fe', fg: '#5b21b6' },
  DELIVERED: { bg: '#d1fae5', fg: '#065f46' },
  CANCELLED: { bg: '#fee2e2', fg: '#991b1b' },
};

export const NEXT_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  // Đơn được tạo ở trạng thái READY, chỉ chờ khách lấy
  CREATED: ['READY', 'CANCELLED'],
  RECEIVED: ['READY', 'CANCELLED'],
  WASHING: ['READY', 'CANCELLED'],
  READY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

// Label tuỳ chỉnh cho nút chuyển trạng thái (UX-friendly)
export const STATUS_ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  READY: 'Đã giặt xong',
  DELIVERED: 'Xác nhận đã giao',
  CANCELLED: 'Huỷ đơn',
};
