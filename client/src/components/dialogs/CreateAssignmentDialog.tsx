import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, Notice } from '@/components/common';
import {
  formatFileSize,
  getErrorMessage,
  invalidateLms,
  uploadBrowserFile,
  useCreateCourseAssignment,
  type Assignment,
} from '@/api';

export interface CreateAssignmentDialogProps {
  open: boolean;
  courseId: number;
  onClose: () => void;
  onCreated?: (assignment: Assignment) => void;
}

export function CreateAssignmentDialog({ open, courseId, onClose, onCreated }: CreateAssignmentDialogProps) {
  const queryClient = useQueryClient();
  const createAssignment = useCreateCourseAssignment();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [maxPoints, setMaxPoints] = useState(10);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    if (!title.trim() || !dueDate) {
      setError(true);
      setFeedback('Vui lòng nhập tiêu đề bài tập và hạn nộp.');
      return;
    }

    setBusy(true);
    try {
      let attachmentUrl: string | undefined;
      if (attachment) {
        setFeedback('Đang tải đề bài lên máy chủ...');
        attachmentUrl = (await uploadBrowserFile(attachment)).url;
      }
      const created = await createAssignment.mutateAsync({
        id: courseId,
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate,
          maxPoints,
          attachmentUrl,
          attachmentName: attachment?.name,
        },
      });
      await invalidateLms(queryClient);
      onCreated?.(created);
      setTitle('');
      setDescription('');
      setDueDate('');
      setAttachment(null);
      setFeedback('');
      onClose();
    } catch (err) {
      setError(true);
      setFeedback(err instanceof Error && !('status' in err) ? err.message : getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="block w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-4 pr-8">
          <div>
            <DialogTitle className="font-display text-lg font-bold leading-tight tracking-normal">Giao bài tập mới (Assignment)</DialogTitle>
            <p className="text-xs text-muted-foreground">Tạo bài tập về nhà, tiểu luận hoặc bài tập tình huống cho học viên.</p>
          </div>
        </div>

        {feedback && (
          <div className="mt-4">
            <Notice message={feedback} error={error} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <Field label="Tiêu đề bài tập *">
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="VD: Bài tập tuần 2: Viết kế hoạch đào tạo"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Hạn nộp (Deadline) *">
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
            </Field>

            <Field label="Thang điểm tối đa">
              <select
                value={maxPoints}
                onChange={e => setMaxPoints(Number(e.target.value))}
                className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm font-medium"
              >
                <option value={10}>Thang điểm 10</option>
                <option value={100}>Thang điểm 100</option>
              </select>
            </Field>
          </div>

          <Field label="Yêu cầu & Hướng dẫn làm bài">
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Mô tả chi tiết câu hỏi, cấu trúc bài nộp, định dạng file..."
              rows={3}
            />
          </Field>

          <Field label="Đính kèm đề bài mẫu (Tùy chọn)">
            <div className="relative flex items-center gap-3 rounded-xl border border-dashed border-border p-3 hover:bg-muted/30">
              <input
                type="file"
                onChange={e => setAttachment(e.target.files?.[0] ?? null)}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip"
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <UploadCloud className="h-6 w-6 shrink-0 text-primary" />
              <p className="text-xs font-medium text-foreground">
                {attachment ? `${attachment.name} (${formatFileSize(attachment.size)})` : 'Chọn tệp đề bài (PDF, Word...)'}
              </p>
            </div>
          </Field>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Hủy
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Đang giao...' : 'Giao bài tập'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
