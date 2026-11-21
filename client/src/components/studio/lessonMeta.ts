import { FileText, HelpCircle, PlayCircle, Presentation, type LucideIcon } from 'lucide-react';
import type { LessonType } from '@/api';

/** Nhãn & biểu tượng cho từng loại bài học (dùng chung cho studio và trình học) */
export const LESSON_TYPES: Array<{ type: LessonType; label: string; icon: LucideIcon; hint: string }> = [
  { type: 'video', label: 'Video', icon: PlayCircle, hint: 'Video bài giảng kèm ghi chú' },
  { type: 'text', label: 'Bài đọc', icon: FileText, hint: 'Nội dung văn bản, hình ảnh, liên kết' },
  { type: 'document', label: 'Tài liệu', icon: Presentation, hint: 'PDF, slide hoặc tệp Word để học viên xem/tải' },
  { type: 'quiz', label: 'Kiểm tra', icon: HelpCircle, hint: 'Câu hỏi trắc nghiệm, chấm điểm tự động' },
];

export const lessonTypeMeta = (type: LessonType) => LESSON_TYPES.find(t => t.type === type) ?? LESSON_TYPES[1]!;

export function formatMinutes(minutes: number) {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} phút`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} giờ ${m} phút` : `${h} giờ`;
}
