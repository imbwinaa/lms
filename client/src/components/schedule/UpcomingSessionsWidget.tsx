import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useListCalendarSessions } from '@/api';
import type { ClassSession } from '@/api';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { JoinButton } from './SessionCard';
import { dayKey, dayLabel, formatTimeRange, PLATFORM_META, sessionStatus, useNow } from './sessionUtils';

const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
/** Xem lịch trong khoảng hôm nay ± 2 tháng */
const RANGE_MONTHS = 2;

type ViewMode = 'day' | 'upcoming';

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
/** Thứ Hai của tuần chứa ngày d */
const startOfWeek = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
const localKey = (d: Date) => dayKey(d.toISOString());

/**
 * Lịch học trên bảng điều khiển (học viên: khóa đã ghi danh; giảng viên: khóa mình dạy).
 * - Dải tuần, chuyển tuần trong phạm vi hôm nay ± 2 tháng; chấm = ngày có buổi học
 * - Hai chế độ: "Theo ngày" (buổi học của ngày đang chọn) và "Sắp tới" (mọi buổi chưa kết thúc)
 */
export function UpcomingSessionsWidget({ title, emptyText }: { title: string; emptyText: string }) {
  const now = useNow();
  const todayKey = localKey(new Date(now));

  // Phạm vi cố định theo ngày hôm nay -> khóa truy vấn ổn định
  const bounds = useMemo(() => {
    const today = startOfDay(new Date(now));
    const min = addMonths(today, -RANGE_MONTHS);
    const max = addMonths(today, RANGE_MONTHS);
    return { today, min, max, from: min.toISOString(), to: addDays(max, 1).toISOString() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayKey]);

  const query = useListCalendarSessions({ from: bounds.from, to: bounds.to });
  const sessions = useMemo(() => query.data ?? [], [query.data]);

  const [mode, setMode] = useState<ViewMode>('day');
  const [selected, setSelected] = useState<Date>(() => startOfDay(new Date()));
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));

  const byDay = useMemo(() => {
    const map = new Map<string, ClassSession[]>();
    for (const s of sessions) {
      const key = dayKey(s.startsAt);
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return map;
  }, [sessions]);

  const week = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(weekStart, i);
        const key = localKey(date);
        return {
          date,
          key,
          day: date.getDate(),
          weekday: WEEKDAY_SHORT[date.getDay()],
          count: byDay.get(key)?.length ?? 0,
          today: key === todayKey,
          selected: mode === 'day' && key === localKey(selected),
          disabled: date < bounds.min || date > bounds.max,
        };
      }),
    [weekStart, byDay, todayKey, selected, mode, bounds],
  );

  const canPrev = addDays(weekStart, -1) >= bounds.min;
  const canNext = addDays(weekStart, 7) <= bounds.max;
  const monthLabel = (() => {
    const mid = addDays(weekStart, 3);
    return `Tháng ${mid.getMonth() + 1}, ${mid.getFullYear()}`;
  })();

  const pickDay = (date: Date) => {
    setSelected(date);
    setMode('day');
  };
  const goToday = () => {
    setWeekStart(startOfWeek(bounds.today));
    pickDay(bounds.today);
  };
  const shiftWeek = (dir: -1 | 1) => {
    const next = addDays(weekStart, dir * 7);
    setWeekStart(next);
    if (mode === 'day') {
      // Giữ cùng thứ trong tuần, nhưng không vượt phạm vi
      const candidate = addDays(selected, dir * 7);
      pickDay(candidate < bounds.min ? bounds.min : candidate > bounds.max ? bounds.max : candidate);
    }
  };

  const daySessions = byDay.get(localKey(selected)) ?? [];
  const upcoming = useMemo(() => sessions.filter(s => new Date(s.endsAt).getTime() > now), [sessions, now]);
  const upcomingGroups = useMemo(() => {
    const groups: { key: string; label: string; items: ClassSession[] }[] = [];
    for (const s of upcoming) {
      const key = dayKey(s.startsAt);
      const last = groups[groups.length - 1];
      if (last?.key === key) last.items.push(s);
      else groups.push({ key, label: dayLabel(s.startsAt, now), items: [s] });
    }
    return groups;
  }, [upcoming, now]);

  return (
    <Card className="overflow-hidden border-card-border shadow-2xs">
      <CardContent className="space-y-3 p-4">
        {/* Tiêu đề + chế độ xem */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays size={16} />
            </div>
            <h3 className="font-display text-sm font-bold text-foreground">{title}</h3>
          </div>
          <div className="flex shrink-0 rounded-lg bg-muted p-0.5 text-[11px] font-semibold" role="tablist" aria-label="Chế độ xem lịch">
            {(
              [
                ['day', 'Theo ngày'],
                ['upcoming', 'Sắp tới'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  'rounded-md px-2.5 py-1 transition-colors',
                  mode === value ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Điều hướng tuần */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => shiftWeek(-1)}
            disabled={!canPrev}
            aria-label="Tuần trước"
            className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">{monthLabel}</span>
            {(localKey(weekStart) !== localKey(startOfWeek(bounds.today)) || (mode === 'day' && localKey(selected) !== todayKey)) && (
              <button
                type="button"
                onClick={goToday}
                className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/10"
              >
                Hôm nay
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => shiftWeek(1)}
            disabled={!canNext}
            aria-label="Tuần sau"
            className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center" aria-label="Chọn ngày">
          {week.map(d => (
            <button
              key={d.key}
              type="button"
              disabled={d.disabled}
              onClick={() => pickDay(d.date)}
              aria-pressed={d.selected}
              aria-label={`${dayLabel(d.date.toISOString(), now)}${d.count ? `, ${d.count} buổi học` : ''}`}
              className={cn(
                'flex flex-col items-center rounded-lg py-1.5 text-[11px] transition-colors disabled:opacity-30',
                d.selected
                  ? 'bg-primary font-bold text-primary-foreground'
                  : d.today
                  ? 'bg-primary/10 font-bold text-primary hover:bg-primary/15'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <span className="text-[9px] uppercase opacity-80">{d.weekday}</span>
              <span>{d.day}</span>
              <span
                className={cn(
                  'mt-0.5 h-1 w-1 rounded-full',
                  d.count ? (d.selected ? 'bg-primary-foreground' : 'bg-primary') : 'bg-transparent',
                )}
              />
            </button>
          ))}
        </div>

        <div className="space-y-2 border-t border-border/50 pt-3">
          {query.isLoading ? (
            <p className="text-xs text-muted-foreground">Đang tải lịch học…</p>
          ) : query.isError ? (
            <p className="rounded-xl bg-destructive/10 px-3 py-4 text-center text-xs text-destructive">
              Chưa tải được lịch học. Vui lòng thử lại sau.
            </p>
          ) : mode === 'day' ? (
            <>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {dayLabel(selected.toISOString(), now)}
                {daySessions.length > 0 && ` · ${daySessions.length} buổi`}
              </p>
              {daySessions.length === 0 ? (
                <p className="rounded-xl bg-muted/40 px-3 py-4 text-center text-xs text-muted-foreground">
                  Không có buổi học nào trong ngày này.
                </p>
              ) : (
                daySessions.map(s => <SessionRow key={s.id} session={s} now={now} />)
              )}
            </>
          ) : upcomingGroups.length === 0 ? (
            <p className="rounded-xl bg-muted/40 px-3 py-4 text-center text-xs text-muted-foreground">{emptyText}</p>
          ) : (
            <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1">
              {upcomingGroups.map(group => (
                <div key={group.key} className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{group.label}</p>
                  {group.items.map(s => (
                    <SessionRow key={s.id} session={s} now={now} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SessionRow({ session, now }: { session: ClassSession; now: number }) {
  const status = sessionStatus(session, now);
  return (
    <div
      className={cn(
        'space-y-2 rounded-xl border bg-muted/30 p-2.5',
        status === 'live' ? 'border-rose-500/40' : 'border-border/60',
        status === 'ended' && 'opacity-60',
      )}
    >
      <div className="min-w-0">
        <p className="line-clamp-1 text-xs font-semibold text-foreground">{session.title}</p>
        <p className="line-clamp-1 text-[10px] text-muted-foreground">
          {session.courseTitle} · {PLATFORM_META[session.platform].label}
        </p>
        <p className="mt-0.5 font-mono text-[10px] font-medium text-foreground">
          {formatTimeRange(session)}
          {status === 'live' && <span className="ml-1.5 font-sans font-bold text-rose-600">● Đang diễn ra</span>}
          {status === 'ended' && <span className="ml-1.5 font-sans text-muted-foreground">· Đã kết thúc</span>}
        </p>
      </div>
      <JoinButton session={session} now={now} />
    </div>
  );
}
