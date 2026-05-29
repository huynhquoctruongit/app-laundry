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

  return {
    isAdmin,
    canCreate: isAdmin,
    canEdit: isAdmin,
    canDelete: isAdmin,
    canCancel: isAdmin,
    canChangeStatus: isAdmin,
    // Nhân viên được phép bấm "Hoàn thành" (READY → DELIVERED)
    canCompleteOrder: true,
  };
}
