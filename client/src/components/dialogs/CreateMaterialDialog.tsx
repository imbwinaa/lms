import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, Notice } from '@/components/common';
import { notify } from '@/lib/toast';
import {
  formatFileSize,
  getErrorMessage,
  invalidateLms,
  uploadBrowserFile,
  useCreateCourseMaterial,
  useGetCourseOutline,
  type Material,
  type MaterialType,
} from '@/api';

export interface CreateMaterialDialogProps {
  open: boolean;
  courseId: number;
  onClose: () => void;
  onCreated?: (material: Material) => void;
}

export function CreateMaterialDialog({ open, courseId, onClose, onCreated }: CreateMaterialDialogProps) {
  const queryClient = useQueryClient();
  const createMaterial = useCreateCourseMaterial();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<MaterialType>('pdf');
  const [linkUrl, setLinkUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  // Bài học (trong studio) chứa tài liệu; null = tài liệu chung của khóa học
  const [lessonId, setLessonId] = useState<number | null>(null);
  const outlineQuery = useGetCourseOutline(courseId, { query: { enabled: open && courseId > 0 } });
  const sections = outlineQuery.data?.sections ?? [];
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState(false);

  if (!open) return null;

  const isLink = type === 'video' || type === 'link';

  const reset = () => {
    setTitle('');
    setDescription('');
    setLinkUrl('');
    setFile(null);
    setLessonId(null);
    setFeedback('');
    setError(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setFile(picked);
    if (!title) setTitle(picked.name.replace(/\.[^/.]+$/, ''));
    if (picked.type === 'application/pdf') setType('pdf');
    else if (picked.type.includes('presentation') || /\.pptx?$/i.test(picked.name)) setType('slide');
    else if (picked.type.includes('word') || picked.type.includes('document')) setType('doc');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    if (!title.trim()) {
      setError(true);
      setFeedback('Vui lòng nhập tên tài liệu bài giảng.');
      return;
    }
    if (isLink ? !linkUrl.trim() : !file) {
      setError(true);
      setFeedback(isLink ? 'Vui lòng nhập đường link tài liệu.' : 'Vui lòng chọn tệp tài liệu.');
      return;
    }

    setBusy(true);
    try {
      let fileUrl = linkUrl.trim();
      let fileName: string | undefined;
      let fileSize: string | undefined;
      if (!isLink && file) {
        setFeedback('Đang tải tệp lên máy chủ...');
        const uploaded = await uploadBrowserFile(file);
        fileUrl = uploaded.url;
        fileName = file.name;
        fileSize = formatFileSize(file.size);
      }
      const created = await createMaterial.mutateAsync({
        id: courseId,
        data: {
          title: title.trim(),
          type,
          fileUrl,
          fileName,
          fileSize,
          lessonId: lessonId ?? undefined,
          description: description.trim() || undefined,
        },
      });
      await invalidateLms(queryClient);
      onCreated?.(created);
      notify.success('Đã đăng tài liệu bài giảng.', created.title);
      reset();
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
            <DialogTitle className="font-display text-lg font-bold leading-tight tracking-normal">Đăng tài liệu bài giảng mới</DialogTitle>
            <p className="text-xs text-muted-foreground">Chia sẻ Slide, tài liệu PDF, tài liệu đọc hoặc link video cho học viên.</p>
          </div>
        </div>

        {feedback && (
          <div className="mt-4">
            <Notice message={feedback} error={error} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <Field label="Tiêu đề học liệu *">
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="VD: Slide bài giảng Chương 1 - Nhập môn"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Định dạng tài liệu">
              <select
                value={type}
                onChange={e => setType(e.target.value as MaterialType)}
                className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm font-medium"
              >
                <option value="pdf">📄 File PDF</option>
                <option value="slide">📊 Slide bài giảng (PPT/PDF)</option>
                <option value="doc">📝 Tài liệu Word/Văn bản</option>
                <option value="video">🎥 Video bài giảng / Link</option>
                <option value="link">🌐 Liên kết ngoài</option>
              </select>
            </Field>

            <Field label="Gắn vào bài học">
              <select
                value={lessonId ?? ''}
                onChange={e => setLessonId(e.target.value ? Number(e.target.value) : null)}
                disabled={outlineQuery.isLoading}
                className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm font-medium"
              >
                <option value="">Tài liệu chung của khóa học</option>
                {sections.map(section =>
                  section.lessons.length ? (
                    <optgroup key={section.id} label={section.title}>
                      {section.lessons.map(lesson => (
                        <option key={lesson.id} value={lesson.id}>
                          {lesson.title}
                          {lesson.isPublished ? '' : ' (nháp)'}
                        </option>
                      ))}
                    </optgroup>
                  ) : null,
                )}
              </select>
            </Field>
          </div>

          <Field label={isLink ? 'Đường link tài liệu (URL)' : 'Tải tệp từ máy tính'}>
            {isLink ? (
              <Input
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... hoặc https://drive.google.com/..."
              />
            ) : (
              <div className="relative flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-4 text-center hover:bg-muted/30">
                <input
                  type="file"
                  id="material-file-input"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip"
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
                <UploadCloud className="mb-2 h-8 w-8 text-primary" />
                <p className="text-xs font-semibold text-foreground">
                  {file ? `Đã chọn: ${file.name} (${formatFileSize(file.size)})` : 'Bấm vào đây để chọn tệp hoặc kéo thả'}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Hỗ trợ PDF, PPTX, DOCX, ZIP (Tối đa 25MB)</p>
              </div>
            )}
          </Field>

          <Field label="Ghi chú / Hướng dẫn học tập">
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="VD: Học viên đọc trước trang 12-25 trước giờ lên lớp."
              rows={2}
            />
          </Field>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Hủy
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Đang đăng...' : 'Đăng tài liệu'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
