import { useState } from 'react';
import { X, Calendar, Award, FileText, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, Notice } from '@/components/common';
import { lmsStorage, type CourseAssignment } from '@/services/lmsStorage';
import { useRole } from '@/contexts/RoleContext';

export interface CreateAssignmentDialogProps {
  open: boolean;
  courseId: number;
  onClose: () => void;
  onCreated: (assignment: CourseAssignment) => void;
}

export function CreateAssignmentDialog({ open, courseId, onClose, onCreated }: CreateAssignmentDialogProps) {
  const { user } = useRole();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [maxPoints, setMaxPoints] = useState(10);
  const [attachmentName, setAttachmentName] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState(false);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) {
      setError(true);
      setFeedback('Vui lòng nhập tiêu đề bài tập và hạn nộp.');
      return;
    }

    const created = lmsStorage.addAssignment({
      courseId,
      title: title.trim(),
      description: description.trim() || 'Học viên hoàn thành bài tập theo hướng dẫn và nộp đúng hạn.',
      dueDate,
      maxPoints: Number(maxPoints) || 10,
      attachmentName: attachmentName || undefined,
      attachmentUrl: attachmentName ? '/uploads/assignment-prompt.pdf' : undefined,
      createdBy: user.name || 'Cô Bui Ngan',
    });

    setFeedback('Đã giao bài tập mới thành công!');
    setTimeout(() => {
      onCreated(created);
      onClose();
      // Reset form
      setTitle('');
      setDescription('');
      setDueDate('');
      setAttachmentName('');
      setFeedback('');
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in-0 zoom-in-95">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h3 className="font-display text-lg font-bold">Giao bài tập mới (Assignment)</h3>
            <p className="text-xs text-muted-foreground">Tạo bài tập về nhà, tiểu luận hoặc bài tập tình huống cho học viên.</p>
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
              <Input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                required
              />
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
            <Input
              value={attachmentName}
              onChange={e => setAttachmentName(e.target.value)}
              placeholder="VD: De_bai_tuan_2.pdf hoặc Mau_bao_cao.docx"
            />
          </Field>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit">Giao bài tập</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
