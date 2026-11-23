import { useEffect, useState } from 'react';
import type { ClassSession, MeetingPlatform } from '@/api';

/** Mở nút "Vào lớp" trước giờ bắt đầu bao lâu */
export const JOIN_EARLY_MINUTES = 15;

export const PLATFORM_META: Record<MeetingPlatform, { label: string; className: string }> = {
  teams: { label: 'Microsoft Teams', className: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' },
  meet: { label: 'Google Meet', className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  zoom: { label: 'Zoom', className: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' },
  other: { label: 'Phòng học trực tuyến', className: 'bg-muted text-muted-foreground' },
};

export type SessionStatus = 'upcoming' | 'joinable' | 'live' | 'ended';

export function sessionStatus(session: Pick<ClassSession, 'startsAt' | 'endsAt'>, now: number): SessionStatus {
  const start = new Date(session.startsAt).getTime();
  const end = new Date(session.endsAt).getTime();
  if (now >= end) return 'ended';
  if (now >= start) return 'live';
  if (now >= start - JOIN_EARLY_MINUTES * 60_000) return 'joinable';
  return 'upcoming';
}

/** Thời gian hiện tại, tự cập nhật mỗi 30 giây (để trạng thái "đang diễn ra" luôn đúng) */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

const pad = (n: number) => String(n).padStart(2, '0');

export const formatTime = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const formatTimeRange = (session: Pick<ClassSession, 'startsAt' | 'endsAt'>) =>
  `${formatTime(session.startsAt)} – ${formatTime(session.endsAt)}`;

const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/** Khóa ngày theo giờ địa phương (YYYY-MM-DD) */
export const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** "Hôm nay", "Ngày mai", "Hôm qua" hoặc "Thứ Ba, 25/11/2026" */
export function dayLabel(iso: string, now = Date.now()) {
  const d = new Date(iso);
  const today = new Date(now);
  const diffDays = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86_400_000,
  );
  if (diffDays === 0) return 'Hôm nay';
  if (diffDays === 1) return 'Ngày mai';
  if (diffDays === -1) return 'Hôm qua';
  return `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Giá trị cho input type="date" và type="time" theo giờ địa phương */
export function toLocalInputs(iso: string) {
  const d = new Date(iso);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** Ghép ngày + giờ địa phương thành ISO (UTC) để gửi lên máy chủ */
export function fromLocalInputs(date: string, time: string): string | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function groupByDay<T extends Pick<ClassSession, 'startsAt'>>(sessions: T[]) {
  const groups = new Map<string, T[]>();
  for (const s of sessions) {
    const key = dayKey(s.startsAt);
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  return [...groups.entries()].map(([key, items]) => ({ key, items }));
}
