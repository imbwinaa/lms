import { useState } from 'react';
import { X, Award, FileText, CheckCircle2, MessageSquare, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, Notice, Avatar } from '@/components/common';
import { lmsStorage, type AssignmentSubmission, type CourseAssignment } from '@/services/lmsStorage';
import { useRole } from '@/contexts/RoleContext';

export interface GradeSubmissionDialogProps {
  open: boolean;
  assignment: CourseAssignment;
  submission: AssignmentSubmission;
  onClose: () => void;
  onGraded: (updated: AssignmentSubmission) => void;
}

export function GradeSubmissionDialog({
  open,
  assignment,
  submission,
  onClose,
  onGraded,
}: GradeSubmissionDialogProps) {
  const { user } = useRole();
  const [grade, setGrade] = useState<number | string>(submission.grade !== undefined ? submission.grade : '');
  const [feedback, setFeedback] = useState(submission.feedback || '');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState(false);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numGrade = Number(grade);
    if (isNaN(numGrade) || numGrade < 0 || numGrade > assignment.maxPoints) {
      setError(true);
      setMsg(`Điểm số phải từ 0 đến ${assignment.maxPoints}.`);
      return;
    }

    const updated = lmsStorage.gradeSubmission(
      submission.id,
      numGrade,
      feedback.trim() || 'Đã chấm bài đạt yêu cầu.',
      user.name || 'Cô Bui Ngan'
    );

    if (updated) {
      setMsg('Đã lưu điểm và gửi nhận xét cho học viên!');
      setTimeout(() => {
        onGraded(updated);
        onClose();
      }, 500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in-0 zoom-in-95">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <Avatar name={submission.studentName} size="md" />
            <div>
              <h3 className="font-display text-base font-bold">Chấm bài: {submission.studentName}</h3>
              <p className="text-xs text-muted-foreground truncate max-w-xs">{assignment.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={18} />
          </button>
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
              <span className="text-muted-foreground">Nộp lúc: {submission.submittedAt}</span>
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
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit">Lưu điểm & Nhận xét</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
