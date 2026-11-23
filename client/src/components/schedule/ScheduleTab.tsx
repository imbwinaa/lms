import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarDays, History, Plus } from 'lucide-react';
import {
  deleteCourseSession,
  getErrorMessage,
  invalidateLms,
  useListCourseSessions,
  type ClassSession,
} from '@/api';
import { QueryState } from '@/components/common';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { notify } from '@/lib/toast';
import { SessionCard } from './SessionCard';
import { SessionDialog } from './SessionDialog';
import { dayLabel, formatTimeRange, groupByDay, useNow } from './sessionUtils';

/** Tab "Lịch học" của khóa học: buổi học trực tuyến sắp tới / đã qua */
export function ScheduleTab({ courseId, canManage }: { courseId: number; canManage: boolean }) {
  const now = useNow();
  const sessionsQuery = useListCourseSessions(courseId);
  const [showPast, setShowPast] = useState(false);
  const [editing, setEditing] = useState<ClassSession | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ClassSession | null>(null);

  const { upcoming, past } = useMemo(() => {
    const all = sessionsQuery.data ?? [];
    return {
      upcoming: all.filter(s => new Date(s.endsAt).getTime() > now),
      // Buổi đã qua: mới nhất trước
      past: all.filter(s => new Date(s.endsAt).getTime() <= now).reverse(),
    };
  }, [sessionsQuery.data, now]);

  const visible = showPast ? past : upcoming;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-bold text-foreground">Lịch học trực tuyến</h3>
          <p className="text-xs text-muted-foreground">
            Buổi học qua Microsoft Teams, Google Meet hoặc Zoom. Nút "Vào lớp" mở trước giờ học 15 phút.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowPast(v => !v)} className="text-xs">
            {showPast ? <CalendarDays size={14} className="mr-1.5" /> : <History size={14} className="mr-1.5" />}
            {showPast ? 'Buổi sắp tới' : `Buổi đã qua${past.length ? ` (${past.length})` : ''}`}
          </Button>
          {canManage && (
            <Button size="sm" onClick={() => setCreating(true)} className="text-xs">
              <Plus size={14} className="mr-1.5" /> Thêm buổi học
            </Button>
          )}
        </div>
      </div>

      <QueryState loading={sessionsQuery.isLoading} error={sessionsQuery.error} refetch={() => void sessionsQuery.refetch()}>
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-10 text-center">
            <CalendarDays className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
            <p className="font-display text-base font-bold">{showPast ? 'Chưa có buổi học nào đã qua' : 'Chưa có buổi học sắp tới'}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {canManage && !showPast
                ? 'Thêm buổi học với liên kết Teams, Google Meet hoặc Zoom. Có thể lặp lại hằng tuần.'
                : 'Lịch học sẽ hiện ở đây khi giảng viên lên lịch.'}
            </p>
            {canManage && !showPast && (
              <Button size="sm" className="mt-4" onClick={() => setCreating(true)}>
                <Plus size={14} className="mr-1.5" /> Thêm buổi học
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {groupByDay(visible).map(group => (
              <section key={group.key} className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {dayLabel(group.items[0]!.startsAt, now)}
                </h4>
                {group.items.map(session => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    now={now}
                    canManage={canManage}
                    onEdit={() => setEditing(session)}
                    onDelete={() => setDeleting(session)}
                  />
                ))}
              </section>
            ))}
          </div>
        )}
      </QueryState>

      <SessionDialog open={creating || Boolean(editing)} courseId={courseId} session={editing} onClose={() => {
        setCreating(false);
        setEditing(null);
      }} />
      <CancelSessionDialog session={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

/** Hủy buổi học: với chuỗi hằng tuần, chọn hủy riêng buổi này hoặc buổi này và các buổi sau */
function CancelSessionDialog({ session, onClose }: { session: ClassSession | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  const cancel = async (scope: 'single' | 'following') => {
    if (!session) return;
    setPending(true);
    try {
      const result = await deleteCourseSession(session.id, { scope });
      notify.success(result.message);
      await invalidateLms(queryClient);
      onClose();
    } catch (err) {
      notify.error(getErrorMessage(err, 'Chưa hủy được buổi học.'));
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={Boolean(session)} onOpenChange={o => !o && !pending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hủy buổi học?</AlertDialogTitle>
          <AlertDialogDescription>
            {session && (
              <>
                <b>{session.title}</b> · {dayLabel(session.startsAt)}, {formatTimeRange(session)}.{' '}
                {session.seriesId
                  ? 'Buổi này thuộc lịch lặp hằng tuần. Bạn muốn hủy riêng buổi này, hay cả các buổi sau?'
                  : 'Học viên sẽ không còn thấy buổi học này trong lịch.'}
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={pending}>Giữ lại</AlertDialogCancel>
          {session?.seriesId && (
            <Button variant="outline" disabled={pending} onClick={() => void cancel('following')} className="text-destructive">
              Buổi này và các buổi sau
            </Button>
          )}
          <Button variant="destructive" disabled={pending} onClick={() => void cancel('single')}>
            {pending ? 'Đang hủy…' : session?.seriesId ? 'Chỉ buổi này' : 'Hủy buổi học'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
