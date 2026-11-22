import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useRoute, useSearch } from 'wouter';
import { AlertCircle, ArrowLeft, Check, CloudOff, Eye, Loader2, X } from 'lucide-react';
import { useGetCourseOutline, useGetLmsCourse } from '@/api';
import { Button } from '@/components/ui/button';
import { QueryState } from '@/components/common';
import { InspectorPanel } from '@/components/studio/InspectorPanel';
import { LessonEditor } from '@/components/studio/LessonEditor';
import { OutlinePanel } from '@/components/studio/OutlinePanel';
import { useLessonDraft, type SaveState } from '@/components/studio/useLessonDraft';
import { cn } from '@/lib/utils';

/** Studio soạn khóa học: đề cương (trái) · soạn bài (giữa) · ảnh bìa & cài đặt (phải) */
export default function CourseStudio() {
  const [, params] = useRoute('/courses/:id/studio');
  const courseId = Number(params?.id ?? 0);
  const search = useSearch();
  const [, navigate] = useLocation();
  const selectedLessonId = Number(new URLSearchParams(search).get('lesson')) || null;

  const courseQuery = useGetLmsCourse(courseId, { query: { enabled: courseId > 0 } });
  const outlineQuery = useGetCourseOutline(courseId, { query: { enabled: courseId > 0 } });
  const outline = outlineQuery.data;

  const [errors, setErrors] = useState<string[]>([]);
  const pushError = (message: string) => setErrors(list => [...list.filter(m => m !== message), message].slice(-3));

  const selectLesson = (lessonId: number | null) =>
    navigate(`/courses/${courseId}/studio${lessonId ? `?lesson=${lessonId}` : ''}`, { replace: true });

  // Mặc định mở bài học đầu tiên
  const firstLessonId = outline?.sections.flatMap(s => s.lessons)[0]?.id ?? null;
  useEffect(() => {
    if (outline && !selectedLessonId && firstLessonId) selectLesson(firstLessonId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outline, selectedLessonId, firstLessonId]);

  const { lesson, lessonQuery, draft, update, flush, saveState, quizHint } = useLessonDraft(selectedLessonId, pushError);

  const position = useMemo(() => {
    if (!outline || !selectedLessonId) return null;
    for (const section of outline.sections) {
      const index = section.lessons.findIndex(l => l.id === selectedLessonId);
      if (index >= 0) return { sectionTitle: section.title, lessonNumber: index + 1 };
    }
    return null;
  }, [outline, selectedLessonId]);

  const totals = useMemo(() => {
    const lessons = outline?.sections.flatMap(s => s.lessons) ?? [];
    return { total: lessons.length, published: lessons.filter(l => l.isPublished).length };
  }, [outline]);

  const course = courseQuery.data;

  if (outline && !outline.canEdit) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <h1 className="font-display text-lg font-bold">Bạn không thể chỉnh sửa khóa học này</h1>
        <p className="mt-1 text-sm text-muted-foreground">Chỉ giảng viên phụ trách và quản trị viên mới mở được studio.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href={`/courses/${courseId}`}>Về trang khóa học</Link>
        </Button>
      </div>
    );
  }

  return (
    <QueryState
      loading={courseQuery.isLoading || outlineQuery.isLoading}
      error={courseQuery.error ?? outlineQuery.error}
      refetch={() => {
        void courseQuery.refetch();
        void outlineQuery.refetch();
      }}
    >
      {course && outline && (
        // Bố cục theo bề rộng của chính studio (container query), không theo màn hình:
        // hẹp: 1 cột · vừa: đề cương | soạn bài (cài đặt bên dưới) · rộng: 3 cột cuộn độc lập
        <div className="@container">
        <div className="flex flex-col overflow-hidden rounded-2xl border border-card-border bg-card shadow-2xs @6xl:h-[calc(100dvh-9rem)]">
          {/* Thanh trên cùng */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5 sm:px-4">
            <Button asChild variant="ghost" size="sm" className="h-8 px-2">
              <Link href={`/courses/${courseId}`} aria-label="Về trang khóa học">
                <ArrowLeft size={16} />
              </Link>
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-bold">{course.title}</p>
              <p className="text-[11px] text-muted-foreground">
                Studio · {totals.published}/{totals.total} bài đã xuất bản
              </p>
            </div>
            <SaveIndicator state={saveState} />
            <Button asChild variant="outline" size="sm" className="h-8 text-xs">
              <Link href={`/learn?courseId=${courseId}${selectedLessonId ? `&lesson=${selectedLessonId}` : ''}`}>
                <Eye size={14} className="mr-1.5" /> Xem như học viên
              </Link>
            </Button>
          </div>

          {errors.length > 0 && (
            <div className="space-y-1 border-b border-destructive/20 bg-destructive/5 px-4 py-2">
              {errors.map(message => (
                <div key={message} className="flex items-start gap-2 text-xs text-destructive">
                  <AlertCircle size={14} className="mt-px shrink-0" />
                  <span className="flex-1">{message}</span>
                  <button
                    type="button"
                    onClick={() => setErrors(list => list.filter(m => m !== message))}
                    aria-label="Đóng thông báo"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid min-h-0 flex-1 @2xl:grid-cols-[240px_minmax(0,1fr)] @6xl:grid-cols-[260px_minmax(0,1fr)_280px]">
            <aside className="min-h-0 border-b border-border bg-muted/30 @2xl:row-span-2 @2xl:border-b-0 @2xl:border-r @6xl:row-span-1">
              <div className="@2xl:sticky @2xl:top-0 @2xl:max-h-[100dvh] @6xl:static @6xl:h-full @6xl:max-h-none">
              <OutlinePanel
                courseId={courseId}
                outline={outline}
                selectedLessonId={selectedLessonId}
                onSelect={selectLesson}
                onError={pushError}
              />
              </div>
            </aside>

            <section className="min-h-[420px] min-w-0 @6xl:overflow-y-auto">
              {!selectedLessonId ? (
                <EmptyEditor hasLessons={totals.total > 0} />
              ) : lessonQuery.isError ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Không mở được bài học này. Có thể bài đã bị xóa.</div>
              ) : !lesson || !draft ? (
                <div className="grid h-full place-items-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <LessonEditor
                  key={lesson.id}
                  lesson={lesson}
                  draft={draft}
                  update={update}
                  flush={flush}
                  quizHint={quizHint}
                  sectionTitle={position?.sectionTitle}
                  lessonNumber={position?.lessonNumber}
                  onError={pushError}
                />
              )}
            </section>

            <aside className="border-t border-border bg-muted/30 @6xl:col-start-3 @6xl:row-start-1 @6xl:overflow-y-auto @6xl:border-l @6xl:border-t-0">
              <InspectorPanel
                course={course}
                lesson={lesson && draft ? lesson : null}
                draft={draft}
                update={update}
                flush={flush}
                onLessonDeleted={() => selectLesson(null)}
                onError={pushError}
              />
            </aside>
          </div>
        </div>
        </div>
      )}
    </QueryState>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const map: Record<SaveState, { label: string; icon: React.ReactNode; className?: string }> = {
    idle: { label: '', icon: null },
    pending: { label: 'Chưa lưu', icon: <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> },
    saving: { label: 'Đang lưu…', icon: <Loader2 size={13} className="animate-spin" /> },
    saved: { label: 'Đã lưu', icon: <Check size={13} />, className: 'text-emerald-600 dark:text-emerald-400' },
    error: { label: 'Lỗi khi lưu', icon: <CloudOff size={13} />, className: 'text-destructive' },
  };
  const item = map[state];
  if (!item.label) return null;
  return (
    <span className={cn('flex items-center gap-1 text-[11px] font-medium text-muted-foreground', item.className)} aria-live="polite">
      {item.icon}
      {item.label}
    </span>
  );
}

function EmptyEditor({ hasLessons }: { hasLessons: boolean }) {
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div className="max-w-sm">
        <p className="font-display text-base font-bold">{hasLessons ? 'Chọn một bài học để bắt đầu soạn' : 'Khóa học chưa có bài học'}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {hasLessons
            ? 'Bấm vào một bài trong đề cương bên trái.'
            : 'Thêm chương ở cột bên trái, rồi chọn "Thêm bài học" để tạo video, bài đọc, tài liệu hoặc bài kiểm tra.'}
        </p>
      </div>
    </div>
  );
}
