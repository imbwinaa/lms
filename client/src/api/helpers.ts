import type { QueryClient } from '@tanstack/react-query';
import { ApiError } from './custom-fetch';
import { uploadFile } from './generated/api';
import type { UploadResult } from './generated/api.schemas';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Làm mới mọi truy vấn LMS sau khi ghi dữ liệu (khóa học, tài liệu, bài tập, bài nộp...) */
export function invalidateLms(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: query => {
      const key = query.queryKey[0];
      return typeof key === 'string' && key.startsWith('/api/') && !key.startsWith('/api/auth/');
    },
  });
}

/** Thông điệp lỗi thân thiện từ ErrorResponse của máy chủ */
export function getErrorMessage(error: unknown, fallback = 'Đã có lỗi xảy ra. Vui lòng thử lại.'): string {
  if (error instanceof ApiError) {
    const data = error.data as { message?: unknown } | null;
    if (data && typeof data.message === 'string' && data.message.trim()) return data.message;
    if (error.status === 0 || error.status >= 500) return fallback;
    return error.message;
  }
  if (error instanceof TypeError) return 'Không thể kết nối tới máy chủ.';
  return fallback;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Không thể đọc tệp.'));
    reader.readAsDataURL(file);
  });
}

/** Tải tệp từ trình duyệt lên máy chủ (/api/upload) và trả về URL lưu trữ thật */
export async function uploadBrowserFile(file: File): Promise<UploadResult> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Tệp vượt quá giới hạn ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`);
  }
  const data = await readAsDataUrl(file);
  return uploadFile({ name: file.name, type: file.type, data });
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN');
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}
