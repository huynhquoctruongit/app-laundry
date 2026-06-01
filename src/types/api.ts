export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  message: string;
  code?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'ADMIN' | 'STAFF';
  permissions?: Record<string, boolean>;
  orderViewTimeLimit?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WholesaleTier {
  minQty: number;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  unit: string;
  price: number;
  importPrice?: number | null;
  costPrice?: number | null;
  wholesaleEnabled?: boolean;
  wholesaleTiers?: WholesaleTier[] | null;
  isActive: boolean;
  hiddenFromBooking?: boolean;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id?: string;
  productId?: string | null;
  name: string;
  quantity: number;
  weight?: number | null;
  unitPrice: number;
  subtotal?: number;
}

export interface Order {
  id: string;
  code: string;
  qrToken: string;
  status: string;
  totalAmount: number;
  discountAmount: number;
  note?: string | null;
  pickupAt?: string | null;
  deliveredAt?: string | null;
  customerId: string;
  customer?: { id: string; name: string; phone?: string; address?: string | null } | null;
  createdById?: string | null;
  assignedToId?: string | null;
  assignedTo?: { id: string; name: string } | null;
  items: OrderItem[];
  qr?: { url: string } | null;
  /** Đơn được tạo từ booking (khách đặt giao nhận qua mã QR) */
  fromBooking?: boolean;
  booking?: { id: string; code: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  email?: string | null;
  note?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  description?: string | null;
  date: string;
  createdBy?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDebt {
  id: string;
  customerId: string;
  customer?: Customer;
  amount: number;
  type: 'MONEY' | 'GOODS';
  description?: string | null;
  dueDate?: string | null;
  isPaid: boolean;
  paidAt?: string | null;
  paidAmount?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierDebt {
  id: string;
  supplierId: string;
  supplier?: Supplier;
  amount: number;
  type: 'MONEY' | 'GOODS';
  description?: string | null;
  dueDate?: string | null;
  isPaid: boolean;
  paidAt?: string | null;
  paidAmount?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  minQuantity?: number | null;
  importPrice?: number | null;
  note?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryLog {
  id: string;
  itemId: string;
  item?: { id: string; name: string; unit: string };
  type: 'IMPORT' | 'EXPORT' | 'ADJUST';
  quantity: number;
  unitPrice?: number | null;
  note?: string | null;
  createdBy?: { id: string; name: string };
  createdAt: string;
}

export interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime?: string | null;
  isOpen: boolean;
  note?: string | null;
  openedBy?: { id: string; name: string };
  _count?: { attendances: number };
  attendances?: ShiftAttendance[];
  createdAt: string;
  updatedAt: string;
}

export interface ShiftAttendance {
  id: string;
  shiftId: string;
  userId: string;
  user?: { id: string; name: string };
  checkIn: string;
  checkOut?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface ShopSettings {
  id: string;
  shopName: string;
  phone: string | null;
  address: string | null;
  website: string | null;
  logo: string | null;
  taxCode: string | null;
  invoiceTemplate: string;
  invoiceFontSize: number;
  customerNameFontSize: number;
  invoiceShowLogo: boolean;
  invoiceShowShopName: boolean;
  invoiceShowPhone: boolean;
  invoiceShowAddress: boolean;
  invoiceShowWebsite: boolean;
  invoiceShowBarcode: boolean;
  invoiceShowQR: boolean;
  invoiceShowDebt: boolean;
  openingHours: string | null;
  labelTemplate: string | null;
  labelFontSize: number;
  loyaltyEnabled: boolean;
  loyaltyPointsRate: number | null;
  deliveryEnabled: boolean;
  deliveryFee: number | null;
  /** Phí ship cộng trên hoá đơn khi đơn từ booking (giao nhận QR) */
  bookingShippingFee: number | null;
  freeShipThreshold: number | null;
  allowNoShiftOrder: boolean;
}

export type BookingStatusValue = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'CONVERTED';

export interface BookingItem {
  id?: string;
  productId?: string | null;
  name: string;
  quantity: number;
  weight?: number | null;
  unitPrice: number;
}

export interface Booking {
  id: string;
  code: string;
  status: BookingStatusValue;
  customerId: string;
  customer?: { id: string; name: string; phone?: string; address?: string | null } | null;
  phone: string;
  address: string;
  note?: string | null;
  pickupAt?: string | null;
  deliveryAt?: string | null;
  sourceOrderId?: string | null;
  sourceOrder?: { id: string; code: string } | null;
  convertedOrderId?: string | null;
  convertedOrder?: { id: string; code: string } | null;
  items: BookingItem[];
  createdAt: string;
  updatedAt: string;
}

export interface DashboardReport {
  revenue: number;
  profit: number;
  newOrders: number;
  deliveredOrders: number;
  ordersByStatus: Record<string, number>;
  todoList: { status: string; label: string; count: number }[];
}
