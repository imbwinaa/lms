import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ExternalLink, FileText, Link2, Loader2, Paperclip, Trash2, UploadCloud } from 'lucide-react';
import {
  formatFileSize,
  getErrorMessage,
  getGetLessonQueryKey,
  invalidateLms,
  updateLesson,
  uploadBrowserFile,
  useCreateCourseMaterial,
  useDeleteMaterial,
  useListCourseMaterials,
  type Lesson,
  type LessonType,
  type MaterialType,
} from '@/api';
import { MediaUploader } from '@/components/common';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { LESSON_TYPES } from './lessonMeta';
import { QuizBuilder } from './QuizBuilder';
import { RichTextEditor } from './RichTextEditor';
import type { LessonDraft } from './useLessonDraft';

export type LessonEditorProps = {
  lesson: Lesson;
  draft: LessonDraft;
  update: (patch: Partial<LessonDraft>) => void;
  flush: () => Promise<void>;
  quizHint: string | null;
  sectionTitle?: string;
  lessonNumber?: number;
  onError: (message: string) => void;
};

export function LessonEditor({ lesson, draft, update, flush, quizHint, sectionTitle, lessonNumber, onError }: LessonEditorProps) {
  const queryClient = useQueryClient();
  const [changingType, setChangingType] = useState(false);

  const changeType = async (type: LessonType) => {
    if (type === lesson.type || changingType) return;
    setChangingType(true);
    try {
      await flush();
      const updated = await updateLesson(lesson.id, { type, ...(lesson.isPublished ? { isPublished: false } : {}) });
      queryClient.setQueryData(getGetLessonQueryKey(lesson.id), updated);
      await invalidateLms(queryClient);
    } catch (err) {
      onError(getErrorMessage(err, 'Chưa đổi được loại bài học.'));
    } finally {
      setChangingType(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-6">
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground">
          {sectionTitle}
          {lessonNumber ? ` · Bài ${lessonNumber}` : ''}
        </p>
        <input
          value={draft.title}
          onChange={e => update({ title: e.target.value })}
          maxLength={200}
          placeholder="Tên bài học"
          aria-label="Tên bài học"
          className="mt-1 w-full bg-transparent font-display text-2xl font-extrabold outline-none placeholder:text-muted-foreground/50"
        />
        {!draft.title.trim() && <p className="text-[11px] text-destructive">Tên bài học không được để trống.</p>}
      </div>

      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Loại bài học">
        {LESSON_TYPES.map(t => {
          const active = t.type === lesson.type;
          return (
            <button
              key={t.type}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={changingType}
              onClick={() => void changeType(t.type)}
              title={t.hint}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition',
                active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <t.icon size={14} /> {t.label}
            </button>
          );
        })}
        {changingType && <Loader2 size={14} className="ml-1 self-center animate-spin text-muted-foreground" />}
      </div>

      {lesson.type === 'video' && (
        <section className="space-y-2">
          <Label>Video bài giảng</Label>
          <MediaUploader
            value={draft.mediaUrl ?? undefined}
            mediaType="video"
            onChange={url => update({ mediaUrl: url })}
            onRemove={() => update({ mediaUrl: null })}
          />
          <UrlInput
            value={draft.mediaUrl}
            onChange={url => update({ mediaUrl: url })}
            placeholder="Hoặc dán link YouTube / Vimeo / tệp .mp4"
          />
        </section>
      )}

      {lesson.type === 'document' && (
        <section className="space-y-2">
          <Label>Tài liệu chính</Label>
          <DocumentField value={draft.mediaUrl} onChange={url => update({ mediaUrl: url })} onError={onError} />
        </section>
      )}

      {lesson.type === 'quiz' ? (
        <section className="space-y-2">
          <Label>Câu hỏi</Label>
          {quizHint && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              Chưa lưu câu hỏi: {quizHint}
            </p>
          )}
          <QuizBuilder questions={draft.questions} onChange={questions => update({ questions })} />
        </section>
      ) : (
        <section className="space-y-2">
          <Label>{lesson.type === 'text' ? 'Nội dung bài đọc' : 'Ghi chú cho học viên'}</Label>
          <RichTextEditor
            value={draft.contentHtml}
            resetKey={lesson.id}
            onChange={html => update({ contentHtml: html })}
            placeholder={
              lesson.type === 'text'
                ? 'Soạn nội dung bài học: tiêu đề, đoạn văn, danh sách, hình ảnh…'
                : 'Hướng dẫn xem/đọc, câu hỏi gợi mở… (không bắt buộc)'
            }
          />
        </section>
      )}

      {lesson.type !== 'quiz' && <LessonMaterials lesson={lesson} onError={onError} />}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{children}</p>;
}

function UrlInput({
  value,
  onChange,
  placeholder,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  placeholder: string;
}) {
  const isUpload = value?.startsWith('/uploads/') || value?.startsWith('/api/upload/');
  return (
    <div className="relative">
      <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={isUpload ? '' : (value ?? '')}
        onChange={e => onChange(e.target.value.trim() || null)}
        placeholder={isUpload ? 'Đang dùng tệp đã tải lên' : placeholder}
        className="h-9 pl-9 text-xs"
      />
    </div>
  );
}

function DocumentField({
  value,
  onChange,
  onError,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  onError: (message: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const uploaded = await uploadBrowserFile(file);
      onChange(uploaded.url);
    } catch (err) {
      onError(err instanceof Error && !('status' in err) ? err.message : getErrorMessage(err, 'Không tải được tệp.'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
          <FileText size={18} className="shrink-0 text-primary" />
          <a href={value} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-xs font-semibold hover:underline">
            {decodeURIComponent(value.split('/').pop() ?? value)}
          </a>
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Mở tài liệu">
            <ExternalLink size={14} />
          </a>
          <button type="button" onClick={() => onChange(null)} className="text-muted-foreground hover:text-destructive" aria-label="Gỡ tài liệu">
            <Trash2 size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed border-border p-6 text-center hover:border-primary/50 hover:bg-muted/40"
        >
          {uploading ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : <UploadCloud className="h-7 w-7 text-primary" />}
          <span className="text-xs font-semibold">{uploading ? 'Đang tải lên…' : 'Chọn tệp PDF, Word hoặc PowerPoint'}</span>
          <span className="text-[11px] text-muted-foreground">Tối đa 25 MB</span>
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <UrlInput value={value} onChange={onChange} placeholder="Hoặc dán link Google Drive / OneDrive" />
    </div>
  );
}

const materialTypeFor = (name: string): MaterialType => {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'ppt' || ext === 'pptx') return 'slide';
  if (ext === 'mp4' || ext === 'webm' || ext === 'mov') return 'video';
  return 'doc';
};

/** Tài liệu đính kèm của bài học (lưu trong bảng tài liệu khóa học, gắn lessonId) */
function LessonMaterials({ lesson, onError }: { lesson: Lesson; onError: (message: string) => void }) {
  const queryClient = useQueryClient();
  const materialsQuery = useListCourseMaterials(lesson.courseId);
  const create = useCreateCourseMaterial();
  const remove = useDeleteMaterial();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const attached = (materialsQuery.data ?? []).filter(m => m.lessonId === lesson.id);

  const attach = async (file: File) => {
    setUploading(true);
    try {
      const uploaded = await uploadBrowserFile(file);
      await create.mutateAsync({
        id: lesson.courseId,
        data: {
          title: file.name.replace(/\.[^/.]+$/, ''),
          type: materialTypeFor(file.name),
          fileUrl: uploaded.url,
          fileName: file.name,
          fileSize: formatFileSize(file.size),
          lessonId: lesson.id,
        },
      });
      await invalidateLms(queryClient);
    } catch (err) {
      onError(err instanceof Error && !('status' in err) ? err.message : getErrorMessage(err, 'Không đính kèm được tệp.'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <section className="space-y-2">
      <Label>Tệp đính kèm</Label>
      {attached.map(m => (
        <div key={m.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs">
          <Paperclip size={13} className="shrink-0 text-muted-foreground" />
          <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate hover:underline">
            {m.fileName ?? m.title}
          </a>
          {m.fileSize && <span className="text-muted-foreground">{m.fileSize}</span>}
          <button
            type="button"
            onClick={async () => {
              try {
                await remove.mutateAsync({ id: m.id });
                await invalidateLms(queryClient);
              } catch (err) {
                onError(getErrorMessage(err, 'Không gỡ được tệp.'));
              }
            }}
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Gỡ ${m.title}`}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:border-primary/50 hover:text-foreground"
      >
        {uploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
        {uploading ? 'Đang tải lên…' : 'Đính kèm slide, PDF hoặc tài liệu cho bài này'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) void attach(file);
        }}
      />
    </section>
  );
}
