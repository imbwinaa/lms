import { useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import { useListUpcomingSessions } from '@/api';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { JoinButton } from './SessionCard';
import { dayKey, dayLabel, formatTimeRange, PLATFORM_META, sessionStatus, useNow } from './sessionUtils';

const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/**
 * Lịch học sắp tới trên bảng điều khiển: dải 7 ngày (đánh dấu ngày có buổi học)
 * và danh sách buổi học gần nhất của các khóa học của người dùng.
 */
export function UpcomingSessionsWidget({ title, emptyText }: { title: string; emptyText: string }) {
  const now = useNow();
  const query = useListUpcomingSessions({ limit: 8 });
  const sessions = query.data ?? [];

  const week = useMemo(() => {
    const busy = new Set(sessions.map(s => dayKey(s.startsAt)));
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = d.toISOString();
      return { key: dayKey(iso), day: d.getDate(), weekday: WEEKDAY_SHORT[d.getDay()], busy: busy.has(dayKey(iso)), today: i === 0 };
    });
  }, [sessions, now]);

  return (
    <Card className="overflow-hidden border-card-border shadow-2xs">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
            <CalendarDays size={16} />
          </div>
          <h3 className="font-display text-sm font-bold text-foreground">{title}</h3>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center" aria-label="7 ngày tới">
          {week.map(d => (
            <div
              key={d.key}
              className={cn(
                'flex flex-col items-center rounded-lg py-1.5 text-[11px]',
                d.today ? 'bg-primary font-bold text-primary-foreground' : d.busy ? 'bg-primary/10 font-bold text-primary' : 'text-muted-foreground',
              )}
            >
              <span className="text-[9px] uppercase opacity-80">{d.weekday}</span>
              <span>{d.day}</span>
              <span className={cn('mt-0.5 h-1 w-1 rounded-full', d.busy ? (d.today ? 'bg-white' : 'bg-primary') : 'bg-transparent')} />
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t border-border/50 pt-3">
          {query.isLoading ? (
            <p className="text-xs text-muted-foreground">Đang tải lịch học…</p>
          ) : query.isError ? (
            <p className="rounded-xl bg-destructive/10 px-3 py-4 text-center text-xs text-destructive">
              Chưa tải được lịch học. Vui lòng thử lại sau.
            </p>
          ) : sessions.length === 0 ? (
            <p className="rounded-xl bg-muted/40 px-3 py-4 text-center text-xs text-muted-foreground">{emptyText}</p>
          ) : (
            sessions.map(session => {
              const status = sessionStatus(session, now);
              return (
                <div
                  key={session.id}
                  className={cn(
                    'space-y-2 rounded-xl border bg-muted/30 p-2.5',
                    status === 'live' ? 'border-rose-500/40' : 'border-border/60',
                  )}
                >
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-xs font-semibold text-foreground">{session.title}</p>
                    <p className="line-clamp-1 text-[10px] text-muted-foreground">
                      {session.courseTitle} · {PLATFORM_META[session.platform].label}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] font-medium text-foreground">
                      {dayLabel(session.startsAt, now)} · {formatTimeRange(session)}
                      {status === 'live' && <span className="ml-1.5 font-sans font-bold text-rose-600">● Đang diễn ra</span>}
                    </p>
                  </div>
                  <JoinButton session={session} now={now} />
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
