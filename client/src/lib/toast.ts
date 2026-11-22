import { toast } from 'sonner';
import { getErrorMessage } from '@/api';

/**
 * Thông báo dạng toast dùng chung cho toàn ứng dụng.
 * - Kết quả thao tác (lưu, xóa, khóa...) -> toast
 * - Lỗi nhập liệu trong form -> giữ hiển thị ngay trong form (Notice)
 */
export const notify = {
  success: (title: string, description?: string) => toast.success(title, { description }),
  info: (title: string, description?: string) => toast.info(title, { description }),
  warning: (title: string, description?: string) => toast.warning(title, { description }),
  /** Lỗi từ API: tự lấy thông điệp thân thiện của máy chủ */
  error: (error: unknown, fallback = 'Đã có lỗi xảy ra. Vui lòng thử lại.') =>
    toast.error(typeof error === 'string' ? error : getErrorMessage(error, fallback), { duration: 6000 }),
  /** Hiển thị trạng thái đang xử lý -> thành công / thất bại cho một Promise */
  promise: <T>(promise: Promise<T>, messages: { loading: string; success: string | ((data: T) => string); error?: string }) =>
    toast.promise(promise, {
      loading: messages.loading,
      success: messages.success,
      error: (err: unknown) => getErrorMessage(err, messages.error ?? 'Đã có lỗi xảy ra. Vui lòng thử lại.'),
    }),
  dismiss: toast.dismiss,
};

export { toast };
