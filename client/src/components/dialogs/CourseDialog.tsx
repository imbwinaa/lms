import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import {
  getGetLmsDashboardQueryKey,
  getListLmsCoursesQueryKey,
  useCreateLmsCourse,
  useUpdateLmsCourse,
} from '@/api';
import type { Course, CourseInput } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Notice, Field, MediaUploader } from '@/components/common';

export type CourseDialogProps = {
  open: boolean;
  onClose: () => void;
  course?: Course;
};

export function CourseDialog({ open, onClose, course }: CourseDialogProps) {
  const qc = useQueryClient();
  const create = useCreateLmsCourse();
  const update = useUpdateLmsCourse();
  const [feedback, setFeedback] = useState('');
  const [err, setErr] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('video');
  const [mediaTitle, setMediaTitle] = useState('');
  const [form, setForm] = useState<CourseInput>({
    title: '',
    description: '',
    category: '',
    level: 'Cơ bản',
    duration: '',
    lessons: 1,
    format: 'Native',
  });

  useEffect(() => {
    if (open) {
      if (course) {
        setMediaUrl((course as any).mediaUrl || '');
        setMediaType((course as any).mediaType || 'video');
        setMediaTitle('');
      } else {
        setMediaUrl('');
        setMediaType('video');
        setMediaTitle('');
      }
      setForm(
        course
          ? {
              title: course.title,
              description: course.description,
              category: course.category,
              level: course.level,
              duration: course.duration,
              lessons: course.lessons,
              format: course.format,
            }
          : {
              title: '',
              description: '',
              category: 'Kỹ năng',
              level: 'Cơ bản',
              duration: '2 giờ',
              lessons: 4,
              format: 'Native',
            }
      );
      setFeedback('');
    }
  }, [open, course]);

  if (!open) return null;
  const pending = create.isPending || update.isPending;
  const set = (key: keyof CourseInput, value: string | number) => setForm(prev => ({ ...prev, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback('');
    setErr(false);
    const onSuccess = () => {
      qc.invalidateQueries({ queryKey: getListLmsCoursesQueryKey() });
      qc.invalidateQueries({ queryKey: getGetLmsDashboardQueryKey() });
      setFeedback(course ? 'Đã cập nhật bài giảng.' : 'Đã tạo khóa học mới.');
      setTimeout(onClose, 650);
    };
    const onError = () => {
      setErr(true);
      setFeedback('Chưa thể lưu khóa học. Vui lòng kiểm tra lại.');
    };
    const payload = {
      ...form,
      mediaUrl: mediaUrl || undefined,
      mediaType: mediaType || 'video',
    };
    if (course) update.mutate({ id: course.id, data: payload as any }, { onSuccess, onError });
    else create.mutate({ data: payload as any }, { onSuccess, onError });
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"
      role="presentation"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[92dvh] w-full max-w-[550px] overflow-auto rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Biên soạn nội dung</p>
            <h2 className="mt-1 font-display text-2xl font-bold">{course ? 'Chỉnh sửa khóa học' : 'Tạo khóa học mới'}</h2>
          </div>
          <button onClick={onClose} aria-label="Đóng" className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>
        {feedback && <Notice message={feedback} error={err} />}
        <form onSubmit={submit} className="space-y-4">
          <Field label="Tên môn học / bài giảng" required>
            <Input
              required
              minLength={2}
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Ví dụ: Kỹ năng giao tiếp và làm việc nhóm"
            />
          </Field>
          <Field label="Tóm tắt mục tiêu bài học">
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={3}
              placeholder="Bài học giúp học viên phát triển..."
              className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Danh mục môn học">
              <Input
                value={form.category}
                onChange={e => set('category', e.target.value)}
                placeholder="Kỹ năng mềm / Chuyên môn"
              />
            </Field>
            <Field label="Thời lượng học đề xuất">
              <Input
                value={form.duration}
                onChange={e => set('duration', e.target.value)}
                placeholder="2 giờ 30 phút"
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Cấp độ">
              <select
                value={form.level}
                onChange={e => set('level', e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option>Cơ bản</option>
                <option>Trung cấp</option>
                <option>Nâng cao</option>
              </select>
            </Field>
            <Field label="Số bài học">
              <Input
                type="number"
                min={1}
                value={form.lessons}
                onChange={e => set('lessons', Number(e.target.value))}
              />
            </Field>
            <Field label="Định dạng bài giảng">
              <select
                value={form.format}
                onChange={e => set('format', e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option>Native</option>
                <option>H5P</option>
                <option>SCORM 1.2</option>
                <option>xAPI</option>
              </select>
            </Field>
          </div>

          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-semibold">Tải lên học liệu đa phương tiện (Video, Audio, SCORM, Slide)</label>
            <MediaUploader
              value={mediaUrl}
              mediaType={mediaType}
              fileName={mediaTitle}
              onChange={(url, type, title) => {
                setMediaUrl(url);
                setMediaType(type);
                setMediaTitle(title);
              }}
              onRemove={() => {
                setMediaUrl('');
                setMediaType('video');
                setMediaTitle('');
              }}
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" type="button" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Đang lưu...' : course ? 'Lưu thay đổi' : 'Tạo bài giảng'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
