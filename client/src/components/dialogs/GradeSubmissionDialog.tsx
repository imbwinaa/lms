import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, CheckCircle2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, Notice, Avatar } from '@/components/common';
import {
  formatDateTime,
  getErrorMessage,
  invalidateLms,
  useGradeSubmission,
  type Assignment,
  type Submission,
} from '@/api';

export interface GradeSubmissionDialogProps {
  open: boolean;
  assignment: Assignment;
  submission: Submission;
  onClose: () => void;
  onGraded?: (updated: Submission) => void;
}

export function GradeSubmissionDialog({
  open,
  assignment,
  submission,
  onClose,
  onGraded,
}: GradeSubmissionDialogProps) {
  const queryClient = useQueryClient();
  const gradeMutation = useGradeSubmission();
  const [grade, setGrade] = useState<number | string>(submission.grade ?? '');
  const [feedback, setFeedback] = useState(submission.feedback ?? '');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    const numGrade = Number(grade);
    if (grade === '' || Number.isNaN(numGrade) || numGrade < 0 || numGrade > assignment.maxPoints) {
      setError(true);
      setMsg(`Điểm số phải từ 0 đến ${assignment.maxPoints}.`);
      return;
    }

    try {
      const updated = await gradeMutation.mutateAsync({
        id: submission.id,
        data: { grade: numGrade, feedback: feedback.trim() || undefined },
      });
      await invalidateLms(queryClient);
      onGraded?.(updated);
      onClose();
    } catch (err) {
      setError(true);
      setMsg(getErrorMessage(err, 'Chưa thể lưu điểm. Vui lòng thử lại.'));
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="block w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-4 pr-8">
          <div className="flex items-center gap-3">
            <Avatar name={submission.studentName} size="md" />
            <div>
              <DialogTitle className="font-display text-base font-bold leading-tight tracking-normal">Chấm bài: {submission.studentName}</DialogTitle>
              <p className="text-xs text-muted-foreground truncate max-w-xs">{assignment.title}</p>
            </div>
          </div>
        </div>

        {msg && (
          <div className="mt-4">
            <Notice message={msg} error={error} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Thông tin bài nộp của học viên */}
          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Tệp bài nộp:</span>
              <span className="text-muted-foreground">Nộp lúc: {formatDateTime(submission.submittedAt)}</span>
            </div>
            {submission.fileName ? (
              <div className="flex items-center justify-between rounded-lg bg-card p-2.5 border border-border">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-primary" />
                  <span className="font-medium text-foreground">{submission.fileName}</span>
                  {submission.fileSize && <span className="text-[11px] text-muted-foreground">({submission.fileSize})</span>}
                </div>
                <a
                  href={submission.fileUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                >
                  <Download size={12} /> Tải bài
                </a>
              </div>
            ) : (
              <p className="italic text-muted-foreground">Học viên không gửi tệp đính kèm.</p>
            )}

            {submission.textContent && (
              <div className="mt-2 pt-2 border-t border-border">
                <span className="font-semibold text-foreground">Nội dung trả lời / Lời nhắn:</span>
                <p className="mt-1 rounded-md bg-card p-2.5 text-muted-foreground border border-border leading-relaxed">
                  {submission.textContent}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={`Điểm số (Thang ${assignment.maxPoints}) *`}>
              <Input
                type="number"
                step="0.25"
                min="0"
                max={assignment.maxPoints}
                value={grade}
                onChange={e => setGrade(e.target.value)}
                placeholder="VD: 9.5"
                required
              />
            </Field>

            <Field label="Trạng thái">
              <div className="flex h-10 items-center rounded-lg border border-input bg-card px-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={14} className="mr-1.5" /> Sẵn sàng công bố điểm
              </div>
            </Field>
          </div>

          <Field label="Lời nhận xét / Đóng góp ý kiến của Giảng viên">
            <Textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="VD: Lập luận tốt, cần chú ý phần tài liệu tham khảo..."
              rows={3}
            />
          </Field>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={gradeMutation.isPending}>
              Hủy
            </Button>
            <Button type="submit" disabled={gradeMutation.isPending}>
              {gradeMutation.isPending ? 'Đang lưu...' : 'Lưu điểm & Nhận xét'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
