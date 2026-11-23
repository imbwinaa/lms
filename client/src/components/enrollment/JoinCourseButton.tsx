import { useQueryClient } from '@tanstack/react-query';
import { Clock3, Lock, LogIn, Send, X } from 'lucide-react';
import { invalidateLms, useCancelJoinRequest, useJoinCourse } from '@/api';
import type { Course } from '@/api';
import { Button } from '@/components/ui/button';
import { notify } from '@/lib/toast';

/** Nút tham gia khóa học cho học viên chưa ghi danh */
export function JoinCourseButton({ course }: { course: Course }) {
  const qc = useQueryClient();
  const join = useJoinCourse();
  const cancel = useCancelJoinRequest();

  if (course.myEnrollment === 'pending') {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="inline-flex h-11 items-center gap-2 rounded-xl bg-amber-500/10 px-4 text-xs font-semibold text-amber-700 dark:text-amber-400">
          <Clock3 size={14} />
          Đang chờ giảng viên duyệt
        </span>
        <Button
          variant="outline"
          className="h-11 rounded-xl text-xs"
          disabled={cancel.isPending}
          onClick={() =>
            cancel.mutate(
              { id: course.id },
              {
                onSuccess: () => {
                  void invalidateLms(qc);
                  notify.info('Đã rút yêu cầu tham gia.');
                },
                onError: e => notify.error(e),
              }
            )
          }
        >
          <X size={14} className="mr-1" />
          Rút yêu cầu
        </Button>
      </div>
    );
  }

  if (course.visibility === 'private') {
    return (
      <span className="inline-flex h-11 items-center gap-2 rounded-xl bg-muted px-4 text-xs font-semibold text-muted-foreground">
        <Lock size={14} />
        Khóa riêng tư — cần lời mời của giảng viên
      </span>
    );
  }

  const needsApproval = course.enrollmentMethod === 'approval';
  return (
    <Button
      className="h-11 rounded-xl px-4 text-xs font-bold"
      disabled={join.isPending}
      onClick={() =>
        join.mutate(
          { id: course.id, data: {} },
          {
            onSuccess: result => {
              void invalidateLms(qc);
              if (result.status === 'enrolled') notify.success('Đã tham gia khóa học', course.title);
              else notify.info('Đã gửi yêu cầu tham gia', 'Bạn sẽ vào học được sau khi giảng viên duyệt.');
            },
            onError: e => notify.error(e),
          }
        )
      }
    >
      {needsApproval ? <Send size={14} className="mr-1.5" /> : <LogIn size={14} className="mr-1.5" />}
      {join.isPending ? 'Đang gửi...' : needsApproval ? 'Gửi yêu cầu tham gia' : 'Tham gia khóa học'}
    </Button>
  );
}

/** Thay cho nội dung tab khi học viên chưa ghi danh */
export function LockedPanel({ text = 'Tham gia khóa học để xem nội dung này.' }: { text?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <div className="mx-auto mb-3 grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
        <Lock size={20} />
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
