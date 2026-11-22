import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getErrorMessage, invalidateLms, useAutoEnrollLearners } from '@/api';
import type { Course, Learner } from '@/api';
import { Button } from '@/components/ui/button';
import { Notice, Avatar, Field } from '@/components/common';

export type EnrollDialogProps = {
  open: boolean;
  onClose: () => void;
  learners: Learner[];
  courses: Course[];
};

export function EnrollDialog({ open, onClose, learners, courses }: EnrollDialogProps) {
  const qc = useQueryClient();
  const mutation = useAutoEnrollLearners();
  const [courseId, setCourseId] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected([]);
      setMessage('');
      setCourseId(courses[0] ? String(courses[0].id) : '');
    }
  }, [open, courses]);

  if (!open) return null;
  const toggle = (id: number) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));

  const submit = () => {
    setMessage('');
    setError(false);
    mutation.mutate(
      { data: { courseId: Number(courseId), learnerIds: selected } },
      {
        onSuccess: result => {
          void invalidateLms(qc);
          setMessage(`${result.message} (${result.enrolled} học sinh mới ghi danh).`);
        },
        onError: err => {
          setError(true);
          setMessage(getErrorMessage(err, 'Không thể tự động ghi danh. Vui lòng thử lại.'));
        },
      }
    );
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="block max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-card shadow-2xl"
      >
        <div className="mb-5 flex justify-between pr-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Phòng Đào Tạo</p>
            <DialogTitle className="mt-1 font-display text-xl font-bold leading-tight tracking-normal">Ghi danh học viên vào lớp</DialogTitle>
          </div>
        </div>
        {message && <Notice message={message} error={error} />}
        <Field label="Chọn môn học / bài giảng">
          <select
            value={courseId}
            onChange={e => setCourseId(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            {courses.map(c => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </Field>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs font-semibold">Chọn học sinh ({selected.length} đã chọn)</span>
          <button
            onClick={() => setSelected(selected.length === learners.length ? [] : learners.map(l => l.id))}
            className="text-xs font-semibold text-primary"
          >
            {selected.length === learners.length ? 'Bỏ chọn' : 'Chọn tất cả'}
          </button>
        </div>
        <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
          {learners.map(person => (
            <label
              key={person.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted"
            >
              <input
                type="checkbox"
                checked={selected.includes(person.id)}
                onChange={() => toggle(person.id)}
                className="accent-[hsl(var(--primary))]"
              />
              <Avatar name={person.name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">{person.name}</span>
                <span className="block truncate text-[10px] text-muted-foreground">{person.team}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
          <Button onClick={submit} disabled={mutation.isPending || !courseId || !selected.length}>
            {mutation.isPending ? 'Đang ghi danh...' : `Ghi danh ${selected.length} em`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
