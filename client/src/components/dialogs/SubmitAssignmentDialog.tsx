import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Field, Notice } from '@/components/common';
import {
  formatDate,
  formatFileSize,
  getErrorMessage,
  invalidateLms,
  uploadBrowserFile,
  useSubmitAssignment,
  type Assignment,
  type Submission,
} from '@/api';

export interface SubmitAssignmentDialogProps {
  open: boolean;
  assignment: Assignment;
  onClose: () => void;
  onSubmitted?: (submission: Submission) => void;
  existingSubmission?: Submission;
}

export function SubmitAssignmentDialog({
  open,
  assignment,
  onClose,
  onSubmitted,
  existingSubmission,
}: SubmitAssignmentDialogProps) {
  const queryClient = useQueryClient();
  const submit = useSubmitAssignment();
  const [file, setFile] = useState<File | null>(null);
  const [textContent, setTextContent] = useState(existingSubmission?.textContent ?? '');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState(false);

  if (!open) return null;

  const keptFileName = !file ? existingSubmission?.fileName : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    if (!file && !existingSubmission?.fileUrl && !textContent.trim()) {
      setError(true);
      setFeedback('Vui lòng tải lên tệp bài nộp hoặc nhập nội dung trả lời.');
      return;
    }

    setBusy(true);
    try {
      let fileFields: { fileUrl?: string; fileName?: string; fileSize?: string } = {};
      if (file) {
        setFeedback('Đang tải bài làm lên máy chủ...');
        const uploaded = await uploadBrowserFile(file);
        fileFields = { fileUrl: uploaded.url, fileName: file.name, fileSize: formatFileSize(file.size) };
      } else if (existingSubmission?.fileUrl) {
        fileFields = {
          fileUrl: existingSubmission.fileUrl,
          fileName: existingSubmission.fileName ?? undefined,
          fileSize: existingSubmission.fileSize ?? undefined,
        };
      }
      const saved = await submit.mutateAsync({
        id: assignment.id,
        data: { ...fileFields, textContent: textContent.trim() || undefined },
      });
      await invalidateLms(queryClient);
      onSubmitted?.(saved);
      onClose();
    } catch (err) {
      setError(true);
      setFeedback(err instanceof Error && !('status' in err) ? err.message : getErrorMessage(err));
    } finally {
      setBusy(false);
    }
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
            aria-label="Đóng"
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
              Hạn nộp: {formatDate(assignment.dueDate)} · Thang điểm: {assignment.maxPoints}
            </p>
          </div>

          <Field label="Tải lên tệp bài làm (PDF, Word, Zip)">
            <div className="relative flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-4 text-center hover:bg-muted/30">
              <input
                type="file"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.png,.jpg,.jpeg"
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <UploadCloud className="mb-2 h-7 w-7 text-primary" />
              <p className="text-xs font-semibold text-foreground">
                {file
                  ? `Đã chọn: ${file.name} (${formatFileSize(file.size)})`
                  : keptFileName
                  ? `Giữ tệp đã nộp: ${keptFileName}`
                  : 'Kéo thả tệp bài giải hoặc bấm để tải lên'}
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
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Hủy
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Đang nộp...' : existingSubmission ? 'Cập nhật bài nộp' : 'Xác nhận Nộp bài'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
