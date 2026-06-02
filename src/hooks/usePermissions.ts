import { useAuth } from '@/hooks/useAuth';

/**
 * Quyền theo vai trò:
 *  - ADMIN  : toàn quyền (tạo / sửa / xoá / huỷ ...)
 *  - STAFF  : chỉ xem (read-only) trên hầu hết module nghiệp vụ
 *
 * Một số tác vụ vẫn cho phép STAFF làm vì đó là thao tác của chính nhân viên
 * (vd: tự check-in / check-out ca làm việc).
 */
export function usePermissions() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const perms = user?.permissions ?? {};
  // Admin toàn quyền; nhân viên theo quyền được cấp ở màn "Nhân viên"
  const can = (key: string) => isAdmin || perms[key] === true;

  return {
    isAdmin,
    // canCreate vẫn mở khoá các MÀN QUẢN TRỊ (dịch vụ, NCC, kho, thu chi) → giữ admin-only
    canCreate: isAdmin,
    canEdit: isAdmin,
    canDelete: isAdmin,
    canCancel: isAdmin,
    canChangeStatus: isAdmin,
    // Nhân viên được phép bấm "Hoàn thành" (READY → DELIVERED)
    canCompleteOrder: true,
    // Tạo đơn: admin luôn được; nhân viên cần bật quyền "Tạo đơn hàng" (ORDER_CREATE)
    canCreateOrder: can('ORDER_CREATE'),
  };
}
