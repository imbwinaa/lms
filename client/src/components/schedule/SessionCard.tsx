import { BookOpen, Clock, Lock, Pencil, Repeat, Trash2, Video } from 'lucide-react';
import { Link } from 'wouter';
import type { ClassSession } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatTime, formatTimeRange, JOIN_EARLY_MINUTES, PLATFORM_META, sessionStatus, type SessionStatus } from './sessionUtils';

const STATUS_BADGE: Record<SessionStatus, { label: string; className: string } | null> = {
  upcoming: null,
  joinable: { label: 'Sắp bắt đầu', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  live: { label: 'Đang diễn ra', className: 'bg-rose-500/15 text-rose-700 dark:text-rose-300' },
  ended: { label: 'Đã kết thúc', className: 'bg-muted text-muted-foreground' },
};

/** Nút vào lớp: mở trước giờ học 15 phút đến hết buổi */
export function JoinButton({ session, now, size = 'sm' }: { session: ClassSession; now: number; size?: 'sm' | 'default' }) {
  const status = sessionStatus(session, now);
  if (!session.canJoin || !session.meetingUrl) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Lock size={12} /> Ghi danh để nhận liên kết
      </span>
    );
  }
  if (status === 'ended') return null;
  if (status === 'upcoming') {
    return (
      <Button size={size} variant="outline" disabled className="text-xs">
        <Video size={14} className="mr-1.5" /> Mở lúc {formatTime(new Date(new Date(session.startsAt).getTime() - JOIN_EARLY_MINUTES * 60_000).toISOString())}
      </Button>
    );
  }
  return (
    <Button asChild size={size} className={cn('text-xs', status === 'live' && 'bg-rose-600 hover:bg-rose-700')}>
      <a href={session.meetingUrl} target="_blank" rel="noopener noreferrer">
        <Video size={14} className="mr-1.5" /> Vào lớp
      </a>
    </Button>
  );
}

export function SessionCard({
  session,
  now,
  canManage,
  showCourse,
  onEdit,
  onDelete,
}: {
  session: ClassSession;
  now: number;
  canManage?: boolean;
  /** Hiện tên khóa học (dùng trên bảng điều khiển) */
  showCourse?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const status = sessionStatus(session, now);
  const platform = PLATFORM_META[session.platform];
  const badge = STATUS_BADGE[status];

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-start',
        status === 'live' ? 'border-rose-500/40' : 'border-card-border',
        status === 'ended' && 'opacity-70',
      )}
    >
      <div className="w-24 shrink-0">
        <p className="font-display text-base font-bold">{formatTime(session.startsAt)}</p>
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock size={11} /> {session.durationMinutes} phút
        </p>
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold', platform.className)}>{platform.label}</span>
          {badge && <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold', badge.className)}>{badge.label}</span>}
          {session.seriesId && (
            <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px] font-medium">
              <Repeat size={10} /> Hằng tuần
            </Badge>
          )}
        </div>
        <p className="text-sm font-semibold">{session.title}</p>
        {showCourse && (
          <Link href={`/courses/${session.courseId}`} className="block text-xs text-primary hover:underline">
            {session.courseTitle}
          </Link>
        )}
        <p className="text-[11px] text-muted-foreground">{formatTimeRange(session)}</p>
        {session.lessonTitle && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <BookOpen size={12} /> Bài học: <span className="font-medium text-foreground">{session.lessonTitle}</span>
          </p>
        )}
        {session.notes && <p className="whitespace-pre-line rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{session.notes}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
        <JoinButton session={session} now={now} />
        {canManage && (
          <>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={onEdit} aria-label="Sửa buổi học">
              <Pencil size={14} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              aria-label="Hủy buổi học"
            >
              <Trash2 size={14} />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
