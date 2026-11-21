import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import {
  getErrorMessage,
  getGetLessonQueryKey,
  invalidateLms,
  updateLesson,
  uploadBrowserFile,
  useDeleteLesson,
  useUpdateLmsCourse,
  type Course,
  type Lesson,
} from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { CourseCover } from './CourseCover';
import type { LessonDraft } from './useLessonDraft';

export function InspectorPanel({
  course,
  lesson,
  draft,
  update,
  flush,
  onLessonDeleted,
  onError,
}: {
  course: Course;
  lesson: Lesson | null;
  draft: LessonDraft | null;
  update: (patch: Partial<LessonDraft>) => void;
  flush: () => Promise<void>;
  onLessonDeleted: () => void;
  onError: (message: string) => void;
}) {
  return (
    <div className="space-y-6 p-4">
      <CoverImageField course={course} onError={onError} />
      {lesson && draft ? (
        <LessonSettings
          lesson={lesson}
          draft={draft}
          update={update}
          flush={flush}
          onDeleted={onLessonDeleted}
          onError={onError}
        />
      ) : (
        <p className="text-xs text-muted-foreground">Chọn một bài học trong đề cương để chỉnh cài đặt.</p>
      )}
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{children}</p>;
}

function CoverImageField({ course, onError }: { course: Course; onError: (message: string) => void }) {
  const queryClient = useQueryClient();
  const updateCourse = useUpdateLmsCourse();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const setCover = async (coverImageUrl: string | null) => {
    await updateCourse.mutateAsync({ id: course.id, data: { coverImageUrl } });
    await invalidateLms(queryClient);
  };

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      onError('Ảnh bìa phải là tệp hình ảnh (JPG, PNG hoặc WebP).');
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadBrowserFile(file);
      await setCover(uploaded.url);
    } catch (err) {
      onError(err instanceof Error && !('status' in err) ? err.message : getErrorMessage(err, 'Không tải được ảnh bìa.'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <Heading>Ảnh bìa khóa học</Heading>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="group relative block w-full overflow-hidden rounded-xl border border-border"
        aria-label={course.coverImageUrl ? 'Thay ảnh bìa' : 'Tải ảnh bìa lên'}
      >
        <CourseCover course={course} className="aspect-video w-full" />
        <span className="absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
          <span className="flex items-center gap-1.5 text-xs font-semibold">
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
            {uploading ? 'Đang tải…' : course.coverImageUrl ? 'Thay ảnh' : 'Tải ảnh lên'}
          </span>
        </span>
      </button>
      <p className="mt-1.5 text-[11px] text-muted-foreground">Tỉ lệ 16:9, tối thiểu 1280×720. Dùng cho thẻ khóa học và ảnh đầu trang.</p>
      {course.coverImageUrl && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 h-7 px-2 text-xs text-muted-foreground"
          disabled={updateCourse.isPending}
          onClick={() => setCover(null).catch(err => onError(getErrorMessage(err, 'Không gỡ được ảnh bìa.')))}
        >
          <Trash2 size={12} className="mr-1" /> Gỡ ảnh bìa
        </Button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
    </div>
  );
}

function LessonSettings({
  lesson,
  draft,
  update,
  flush,
  onDeleted,
  onError,
}: {
  lesson: Lesson;
  draft: LessonDraft;
  update: (patch: Partial<LessonDraft>) => void;
  flush: () => Promise<void>;
  onDeleted: () => void;
  onError: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const remove = useDeleteLesson();
  const [publishing, setPublishing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const togglePublished = async (isPublished: boolean) => {
    setPublishing(true);
    try {
      await flush();
      const updated = await updateLesson(lesson.id, { isPublished });
      queryClient.setQueryData(getGetLessonQueryKey(lesson.id), updated);
      await invalidateLms(queryClient);
    } catch (err) {
      onError(getErrorMessage(err, 'Chưa đổi được trạng thái xuất bản.'));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div>
      <Heading>Cài đặt bài học</Heading>
      <div className="space-y-3 text-xs">
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-semibold">Xuất bản</span>
            <span className="block text-[11px] text-muted-foreground">
              {lesson.isPublished ? 'Học viên đang thấy bài này' : 'Bản nháp, học viên chưa thấy'}
            </span>
          </span>
          <Switch checked={lesson.isPublished} disabled={publishing} onCheckedChange={v => void togglePublished(v)} />
        </label>

        <label className="flex items-center justify-between gap-3">
          <span className="font-semibold">Thời lượng (phút)</span>
          <Input
            type="number"
            min={0}
            max={1440}
            value={draft.durationMinutes}
            onChange={e => update({ durationMinutes: Math.max(0, Math.min(1440, Math.round(Number(e.target.value) || 0))) })}
            className="h-8 w-20 text-right text-xs"
          />
        </label>

        {lesson.type === 'quiz' && (
          <label className="flex items-center justify-between gap-3">
            <span>
              <span className="block font-semibold">Điểm đạt (%)</span>
              <span className="block text-[11px] text-muted-foreground">Đạt từ mức này mới hoàn thành bài</span>
            </span>
            <Input
              type="number"
              min={0}
              max={100}
              value={draft.passScore}
              onChange={e => update({ passScore: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))) })}
              className="h-8 w-20 text-right text-xs"
            />
          </label>
        )}

        <p className="text-[11px] text-muted-foreground">
          {lesson.type === 'quiz'
            ? 'Hoàn thành khi học viên đạt điểm tối thiểu.'
            : 'Hoàn thành khi học viên bấm "Đánh dấu đã học xong".'}
        </p>

        <Button
          variant="outline"
          size="sm"
          className="w-full text-destructive hover:text-destructive"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 size={13} className="mr-1.5" /> Xóa bài học
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={`Xóa "${lesson.title}"?`}
        description="Bài học, câu hỏi và tiến độ của học viên với bài này sẽ bị xóa vĩnh viễn. Tệp đính kèm vẫn còn trong mục Tài liệu."
        confirmLabel="Xóa bài học"
        pendingLabel="Đang xóa…"
        destructive
        pending={remove.isPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try {
            await remove.mutateAsync({ id: lesson.id });
            setConfirmDelete(false);
            queryClient.removeQueries({ queryKey: getGetLessonQueryKey(lesson.id) });
            onDeleted();
            await invalidateLms(queryClient);
          } catch (err) {
            onError(getErrorMessage(err, 'Chưa xóa được bài học.'));
          }
        }}
      />
    </div>
  );
}
