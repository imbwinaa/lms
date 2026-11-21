import { useState } from 'react';
import { X, UploadCloud, FileText, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Field, Notice } from '@/components/common';
import { lmsStorage, type CourseAssignment, type AssignmentSubmission } from '@/services/lmsStorage';
import { useRole } from '@/contexts/RoleContext';

export interface SubmitAssignmentDialogProps {
  open: boolean;
  assignment: CourseAssignment;
  onClose: () => void;
  onSubmitted: (submission: AssignmentSubmission) => void;
  existingSubmission?: AssignmentSubmission;
}

export function SubmitAssignmentDialog({
  open,
  assignment,
  onClose,
  onSubmitted,
  existingSubmission,
}: SubmitAssignmentDialogProps) {
  const { user } = useRole();
  const [fileName, setFileName] = useState(existingSubmission?.fileName || '');
  const [fileSize, setFileSize] = useState(existingSubmission?.fileSize || '');
  const [fileUrl, setFileUrl] = useState(existingSubmission?.fileUrl || '');
  const [textContent, setTextContent] = useState(existingSubmission?.textContent || '');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState(false);

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setFileSize(`${sizeMb} MB`);
      setFileUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName && !textContent.trim()) {
      setError(true);
      setFeedback('Vui lòng tải lên tệp bài nộp hoặc nhập nội dung trả lời.');
      return;
    }

    const sub = lmsStorage.submitAssignment({
      assignmentId: assignment.id,
      studentId: user.id || 3,
      studentName: user.name || 'Ngann',
      studentAvatar: user.avatar || 'NG',
      fileName: fileName || `${user.name}_BaiNop.docx`,
      fileSize: fileSize || '500 KB',
      fileUrl: fileUrl || '/uploads/student-submission.pdf',
      textContent: textContent.trim(),
    });

    setFeedback('Nộp bài thành công! Giảng viên sẽ chấm điểm và nhận xét sớm.');
    setTimeout(() => {
      onSubmitted(sub);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in-0 zoom-in-95">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h3 className="font-display text-lg font-bold">Nộp bài tập (Submission)</h3>
            <p className="text-xs text-muted-foreground truncate max-w-sm">{assignment.title}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        {feedback && (
          <div className="mt-4">
            <Notice message={feedback} error={error} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="rounded-xl bg-muted/50 p-3 text-xs">
            <p className="font-semibold text-foreground">Yêu cầu từ giảng viên:</p>
            <p className="mt-1 text-muted-foreground leading-relaxed">{assignment.description}</p>
            <p className="mt-2 text-[11px] font-bold text-primary">
              Hạn nộp: {new Date(assignment.dueDate).toLocaleDateString('vi-VN')} · Thang điểm: {assignment.maxPoints}
            </p>
          </div>

          <Field label="Tải lên tệp bài làm (PDF, Word, Zip)">
            <div className="relative flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-4 text-center hover:bg-muted/30">
              <input
                type="file"
                onChange={handleFileChange}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <UploadCloud className="mb-2 h-7 w-7 text-primary" />
              <p className="text-xs font-semibold text-foreground">
                {fileName ? `Đã chọn: ${fileName} (${fileSize})` : 'Kéo thả tệp bài giải hoặc bấm để tải lên'}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Chấp nhận .pdf, .docx, .zip (Tối đa 25MB)</p>
            </div>
          </Field>

          <Field label="Lời nhắn gửi giảng viên / Trả lời bằng văn bản (Tùy chọn)">
            <Textarea
              value={textContent}
              onChange={e => setTextContent(e.target.value)}
              placeholder="VD: Em gửi cô bài tập phần 1 và phân tích bổ sung theo hướng dẫn tuần trước..."
              rows={3}
            />
          </Field>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit">
              {existingSubmission ? 'Cập nhật bài nộp' : 'Xác nhận Nộp bài'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
