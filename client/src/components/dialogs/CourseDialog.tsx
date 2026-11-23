import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getErrorMessage, invalidateLms, useCreateLmsCourse, useUpdateLmsCourse } from '@/api';
import type { Course, CourseInput, CourseVisibility, EnrollmentMethod } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Globe2, Lock, UserCheck, Users } from 'lucide-react';
import { Notice, Field } from '@/components/common';
import { cn } from '@/lib/utils';
import { notify } from '@/lib/toast';

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
  const [visibility, setVisibility] = useState<CourseVisibility>('public');
  const [enrollmentMethod, setEnrollmentMethod] = useState<EnrollmentMethod>('open');
  const [form, setForm] = useState<CourseInput>({
    title: '',
    description: '',
    category: '',
    level: 'Cơ bản',
    duration: '',
    format: 'Native',
  });

  useEffect(() => {
    if (open) {
      setVisibility(course?.visibility ?? 'public');
      setEnrollmentMethod(course?.enrollmentMethod ?? 'open');
      setForm(
        course
          ? {
              title: course.title,
              description: course.description,
              category: course.category,
              level: course.level,
              duration: course.duration,
              format: course.format,
            }
          : {
              title: '',
              description: '',
              category: 'Kỹ năng',
              level: 'Cơ bản',
              duration: '2 giờ',
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
      void invalidateLms(qc);
      notify.success(course ? 'Đã cập nhật bài giảng.' : 'Đã tạo khóa học mới.', form.title);
      onClose();
    };
    const onError = (error: unknown) => {
      setErr(true);
      setFeedback(getErrorMessage(error, 'Chưa thể lưu khóa học. Vui lòng kiểm tra lại.'));
    };
    const payload: CourseInput = { ...form, visibility, enrollmentMethod };
    if (course) update.mutate({ id: course.id, data: payload }, { onSuccess, onError });
    else create.mutate({ data: payload }, { onSuccess, onError });
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="block max-h-[92dvh] w-[calc(100%-2rem)] max-w-[550px] rounded-2xl bg-card shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between pr-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Biên soạn nội dung</p>
            <DialogTitle className="mt-1 font-display text-2xl font-bold leading-tight tracking-normal">{course ? 'Chỉnh sửa khóa học' : 'Tạo khóa học mới'}</DialogTitle>
          </div>
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
          {/* Số bài học được tính từ các bài đã xuất bản trong studio */}
          <div className="grid gap-3 sm:grid-cols-2">
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

          <Field label="Hiển thị">
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Hiển thị">
              <ChoiceCard
                selected={visibility === 'public'}
                onSelect={() => setVisibility('public')}
                icon={<Globe2 className="size-4" />}
                title="Công khai"
                hint="Mọi học viên thấy khóa học trong danh mục"
              />
              <ChoiceCard
                selected={visibility === 'private'}
                onSelect={() => setVisibility('private')}
                icon={<Lock className="size-4" />}
                title="Riêng tư"
                hint="Chỉ học viên được mời hoặc được thêm"
              />
            </div>
          </Field>
          {visibility === 'public' ? (
            <Field label="Cách ghi danh">
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Cách ghi danh">
                <ChoiceCard
                  selected={enrollmentMethod === 'open'}
                  onSelect={() => setEnrollmentMethod('open')}
                  icon={<Users className="size-4" />}
                  title="Tự do tham gia"
                  hint="Học viên bấm tham gia là vào học ngay"
                />
                <ChoiceCard
                  selected={enrollmentMethod === 'approval'}
                  onSelect={() => setEnrollmentMethod('approval')}
                  icon={<UserCheck className="size-4" />}
                  title="Cần duyệt"
                  hint="Giảng viên duyệt từng yêu cầu tham gia"
                />
              </div>
            </Field>
          ) : (
            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              Khóa riêng tư không nhận yêu cầu tham gia. Thêm học viên hoặc tạo liên kết mời trong tab <b>Học viên</b>.
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" type="button" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Đang lưu...' : course ? 'Lưu thay đổi' : 'Tạo bài giảng'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChoiceCard({
  selected,
  onSelect,
  icon,
  title,
  hint,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
        selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-input hover:bg-muted/60'
      )}
    >
      <span className={cn('mt-0.5', selected ? 'text-primary' : 'text-muted-foreground')}>{icon}</span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}
