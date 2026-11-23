import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getErrorMessage,
  invalidateLms,
  useCreateCourseSessions,
  useGetCourseOutline,
  useUpdateCourseSession,
  type ClassSession,
} from '@/api';
import { Field, Notice } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/lib/toast';
import { fromLocalInputs, toLocalInputs } from './sessionUtils';

const DURATIONS = [30, 45, 60, 90, 120, 150, 180, 240];

export type SessionDialogProps = {
  open: boolean;
  courseId: number;
  /** Có -> sửa buổi học này; không -> thêm buổi mới */
  session?: ClassSession | null;
  onClose: () => void;
};

function defaultStart() {
  // Mặc định: ngày mai 19:00
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(19, 0, 0, 0);
  return d.toISOString();
}

/** Thêm / sửa buổi học trực tuyến (Teams, Google Meet, Zoom...) */
export function SessionDialog({ open, courseId, session, onClose }: SessionDialogProps) {
  const queryClient = useQueryClient();
  const create = useCreateCourseSessions();
  const update = useUpdateCourseSession();
  const outlineQuery = useGetCourseOutline(courseId, { query: { enabled: open } });
  const isEdit = Boolean(session);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(90);
  const [meetingUrl, setMeetingUrl] = useState('');
  const [lessonId, setLessonId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [repeat, setRepeat] = useState(false);
  const [weeks, setWeeks] = useState(8);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const start = toLocalInputs(session?.startsAt ?? defaultStart());
    // Chủ đề trống trên máy chủ được hiển thị bằng tên khóa học -> không đưa lại vào ô nhập
    setTitle(session && session.title !== session.courseTitle ? session.title : '');
    setDate(start.date);
    setTime(start.time);
    setDuration(session?.durationMinutes ?? 90);
    setMeetingUrl(session?.meetingUrl ?? '');
    setLessonId(session?.lessonId ?? null);
    setNotes(session?.notes ?? '');
    setRepeat(false);
    setWeeks(8);
    setError('');
  }, [open, session]);

  const pending = create.isPending || update.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const startsAt = fromLocalInputs(date, time);
    if (!startsAt) return setError('Hãy chọn ngày và giờ bắt đầu.');
    const url = meetingUrl.trim();
    if (!/^https:\/\//i.test(url)) return setError('Liên kết buổi học phải bắt đầu bằng https:// (Teams, Google Meet, Zoom...).');
    if (duration < 15 || duration > 480) return setError('Thời lượng từ 15 phút đến 8 giờ.');

    const fields = {
      title: title.trim(),
      notes: notes.trim(),
      meetingUrl: url,
      startsAt,
      durationMinutes: duration,
      lessonId,
    };
    try {
      if (session) {
        await update.mutateAsync({ id: session.id, data: fields });
        notify.success('Đã cập nhật buổi học.');
      } else {
        const created = await create.mutateAsync({
          id: courseId,
          data: { ...fields, repeatWeeks: repeat ? weeks : 1 },
        });
        notify.success(created.length > 1 ? `Đã lên lịch ${created.length} buổi học hằng tuần.` : 'Đã lên lịch buổi học.');
      }
      await invalidateLms(queryClient);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, 'Chưa lưu được buổi học.'));
    }
  };

  const sections = outlineQuery.data?.sections ?? [];

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="block max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-card">
        <div className="border-b border-border pb-4 pr-8">
          <DialogTitle className="font-display text-lg font-bold leading-tight tracking-normal">
            {isEdit ? 'Sửa buổi học' : 'Thêm buổi học trực tuyến'}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">Dán liên kết Microsoft Teams, Google Meet hoặc Zoom.</p>
        </div>

        {error && (
          <div className="mt-4">
            <Notice message={error} error onClose={() => setError('')} />
          </div>
        )}

        <form onSubmit={submit} className="mt-4 space-y-4">
          <Field label="Chủ đề buổi học">
            <Input value={title} onChange={e => setTitle(e.target.value)} maxLength={200} placeholder="Để trống sẽ dùng tên khóa học" />
          </Field>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Ngày" required>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </Field>
            <Field label="Giờ bắt đầu" required>
              <Input type="time" value={time} onChange={e => setTime(e.target.value)} required />
            </Field>
            <Field label="Thời lượng">
              <select
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
              >
                {[...new Set([...DURATIONS, duration])]
                  .sort((a, b) => a - b)
                  .map(m => (
                    <option key={m} value={m}>
                      {m < 60 ? `${m} phút` : `${Math.floor(m / 60)} giờ${m % 60 ? ` ${m % 60} phút` : ''}`}
                    </option>
                  ))}
              </select>
            </Field>
          </div>

          <Field label="Liên kết phòng học" required>
            <Input
              type="url"
              inputMode="url"
              value={meetingUrl}
              onChange={e => setMeetingUrl(e.target.value)}
              placeholder="https://meet.google.com/abc-defg-hij"
              required
            />
          </Field>

          <Field label="Gắn với bài học">
            <select
              value={lessonId ?? ''}
              onChange={e => setLessonId(e.target.value ? Number(e.target.value) : null)}
              className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
            >
              <option value="">Không gắn bài học</option>
              {sections.map(section =>
                section.lessons.length ? (
                  <optgroup key={section.id} label={section.title}>
                    {section.lessons.map(lesson => (
                      <option key={lesson.id} value={lesson.id}>
                        {lesson.title}
                      </option>
                    ))}
                  </optgroup>
                ) : null,
              )}
            </select>
          </Field>

          <Field label="Ghi chú cho học viên">
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              maxLength={2000}
              rows={2}
              placeholder="VD: Chuẩn bị tai nghe, đọc trước bài 3. Mật khẩu phòng: 1234"
            />
          </Field>

          {!isEdit && (
            <div className="rounded-xl border border-border p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)} className="accent-primary" />
                Lặp lại hằng tuần
              </label>
              {repeat && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Tạo</span>
                  <Input
                    type="number"
                    min={2}
                    max={26}
                    value={weeks}
                    onChange={e => setWeeks(Math.max(2, Math.min(26, Math.round(Number(e.target.value) || 2))))}
                    className="h-8 w-16 text-center text-xs"
                  />
                  <span>buổi, cùng giờ mỗi tuần (tối đa 26).</span>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Hủy
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : repeat ? `Tạo ${weeks} buổi` : 'Thêm buổi học'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
