import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import type { Course } from '@/api';
import { accentBackgrounds } from '@/components/common/constants';
import { cn } from '@/lib/utils';

/**
 * Ảnh bìa khóa học (16:9). Không có ảnh, hoặc ảnh lỗi -> nền màu nhấn của khóa học như trước.
 * Dùng chung cho thẻ khóa học, ảnh đầu trang chi tiết và studio.
 */
export function CourseCover({
  course,
  className,
  children,
  overlay = false,
}: {
  course: Pick<Course, 'coverImageUrl' | 'accent' | 'title'>;
  className?: string;
  children?: React.ReactNode;
  /** Phủ lớp tối để chữ trắng đặt lên ảnh dễ đọc */
  overlay?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(course.coverImageUrl) && !failed;
  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={showImage ? undefined : { background: accentBackgrounds[course.accent] ?? '#dce9df' }}
    >
      {showImage ? (
        <img
          src={course.coverImageUrl!}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        !children && (
          <div className="absolute inset-0 grid place-items-center text-slate-900/25">
            <BookOpen size={36} strokeWidth={1.5} />
          </div>
        )
      )}
      {overlay && <div className={cn('absolute inset-0', showImage ? 'bg-black/55' : 'bg-black/0')} />}
      {children && <div className="relative h-full">{children}</div>}
    </div>
  );
}
