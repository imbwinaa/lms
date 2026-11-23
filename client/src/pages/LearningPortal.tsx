import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useSearch } from 'wouter';
import { BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Circle, ClipboardList, FolderOpen, Lock, PenSquare, UserCheck } from 'lucide-react';
import {
  getErrorMessage,
  invalidateLms,
  recordXapiEvent,
  useCompleteLesson,
  useGetCourseOutline,
  useGetLesson,
  useListCourseMaterials,
  useListLmsCourses,
  useSubmitQuizAttempt,
  type CourseOutline,
  type LessonSummary,
} from '@/api';
import { Heading, Notice, QueryState } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AssignmentsTab } from '@/components/learning/AssignmentsTab';
import { LessonViewer } from '@/components/learning/LessonViewer';
import { MaterialsTab } from '@/components/learning/MaterialsTab';
import { QuizPlayer } from '@/components/learning/QuizPlayer';
import { formatMinutes, lessonTypeMeta } from '@/components/studio/lessonMeta';
import { useRole } from '@/contexts/RoleContext';
import { cn } from '@/lib/utils';

const XAPI = {
  completed: 'http://adlnet.gov/expapi/verbs/completed',
  answered: 'http://adlnet.gov/expapi/verbs/answered',
};

/** Bàn học: đề cương bên trái, nội dung bài học ở giữa, tài liệu & bài tập ở các tab khác */
export default function LearningPortal() {
  const { role, user } = useRole();
  const isStudent = role === 'student';
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(search);
  const queryClient = useQueryClient();

  const coursesQuery = useListLmsCourses();
  // Học viên: chỉ khóa đã ghi danh
  const courses = (coursesQuery.data ?? []).filter(c => role !== 'student' || c.myEnrollment === 'enrolled');
  const courseId = Number(params.get('courseId')) || courses[0]?.id || 0;
  const selectedLessonId = Number(params.get('lesson')) || null;

  const outlineQuery = useGetCourseOutline(courseId, { query: { enabled: courseId > 0 } });
  const outline = outlineQuery.data;
  const lessons = useMemo(() => outline?.sections.flatMap(s => s.lessons) ?? [], [outline]);
  // Xem trước (giảng viên/admin) chỉ hiển thị bài đã xuất bản, giống học viên
  const visibleLessons = useMemo(() => lessons.filter(l => l.isPublished), [lessons]);
  const lessonId = selectedLessonId && visibleLessons.some(l => l.id === selectedLessonId) ? selectedLessonId : (visibleLessons[0]?.id ?? null);

  const lessonQuery = useGetLesson(lessonId ?? 0, { query: { enabled: lessonId !== null } });
  const lesson = lessonQuery.data;
  const materialsQuery = useListCourseMaterials(courseId, { query: { enabled: courseId > 0 } });
  const lessonMaterials = (materialsQuery.data ?? []).filter(m => lesson && m.lessonId === lesson.id);

  const complete = useCompleteLesson();
  const submitQuiz = useSubmitQuizAttempt();
  const [notice, setNotice] = useState<{ message: string; error?: boolean } | null>(null);
  const [tab, setTab] = useState('lesson');

  const go = (nextCourseId: number, nextLessonId?: number | null) =>
    navigate(`/learn?courseId=${nextCourseId}${nextLessonId ? `&lesson=${nextLessonId}` : ''}`, { replace: true });

  useEffect(() => setNotice(null), [lessonId]);

  const index = visibleLessons.findIndex(l => l.id === lessonId);
  const prev = index > 0 ? visibleLessons[index - 1] : null;
  const next = index >= 0 && index < visibleLessons.length - 1 ? visibleLessons[index + 1] : null;
  const course = courses.find(c => c.id === courseId);

  const markComplete = async () => {
    if (!lesson) return;
    try {
      const result = await complete.mutateAsync({ id: lesson.id });
      void recordXapiEvent({ verb: XAPI.completed, objectId: `lesson:${lesson.id}`, score: 100 }).catch(() => {});
      await invalidateLms(queryClient);
      setNotice({
        message:
          result.pointsAwarded > 0
            ? `Hoàn thành bài học! +${result.pointsAwarded} điểm · tiến độ khóa học ${result.progress}%${result.certificateIssued ? ' · Bạn vừa được cấp chứng chỉ.' : ''}`
            : `Đã ghi nhận · tiến độ khóa học ${result.progress}%`,
      });
    } catch (err) {
      setNotice({ message: getErrorMessage(err, 'Chưa ghi nhận được. Hãy thử lại.'), error: true });
    }
  };

  return (
    <div className="page-enter">
      {!isStudent && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-xs text-blue-900 dark:text-blue-200">
          <UserCheck size={16} className="text-blue-600" />
          <span className="flex-1">
            <b>Chế độ xem trước:</b> bạn đang xem như học viên. Tiến độ và bài kiểm tra không được ghi nhận cho tài khoản {user.name}.
          </span>
          {outline?.canEdit && (
            <Button asChild size="sm" variant="outline" className="h-7 text-xs">
              <Link href={`/courses/${courseId}/studio${lessonId ? `?lesson=${lessonId}` : ''}`}>
                <PenSquare size={13} className="mr-1.5" /> Mở studio
              </Link>
            </Button>
          )}
        </div>
      )}

      <Heading
        eyebrow="Nếp học · Bàn học trực tuyến"
        title={course?.title ?? 'Bàn học'}
        description="Học theo đề cương, làm bài kiểm tra, tra cứu tài liệu và nộp bài tập của khóa học."
        action={
          courses.length > 1 ? (
            <select
              value={courseId}
              onChange={e => go(Number(e.target.value))}
              className="h-9 max-w-[260px] rounded-lg border border-input bg-card px-3 text-sm font-medium"
              aria-label="Chọn khóa học"
            >
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />

      <QueryState loading={coursesQuery.isLoading || outlineQuery.isLoading} error={coursesQuery.error ?? outlineQuery.error} refetch={() => void outlineQuery.refetch()}>
        {!courseId ? (
          <EmptyCard title="Chưa có khóa học nào" text="Khi bạn được ghi danh vào khóa học, nội dung sẽ xuất hiện tại đây." />
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="lesson" className="gap-1.5 text-xs font-semibold">
                <BookOpen size={14} /> Bài học
              </TabsTrigger>
              <TabsTrigger value="materials" className="gap-1.5 text-xs font-semibold">
                <FolderOpen size={14} /> Tài liệu
              </TabsTrigger>
              <TabsTrigger value="assignments" className="gap-1.5 text-xs font-semibold">
                <ClipboardList size={14} /> Bài tập
              </TabsTrigger>
            </TabsList>

            <TabsContent value="lesson">
              {visibleLessons.length === 0 ? (
                <EmptyCard
                  title="Khóa học chưa có bài học"
                  text={
                    outline?.canEdit
                      ? 'Vào studio để soạn và xuất bản bài học đầu tiên.'
                      : 'Giảng viên đang soạn nội dung. Hãy quay lại sau nhé.'
                  }
                />
              ) : (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="min-w-0 space-y-4">
                    {notice && <Notice message={notice.message} error={notice.error} onClose={() => setNotice(null)} />}

                    <QueryState loading={lessonQuery.isLoading} error={lessonQuery.error} refetch={() => void lessonQuery.refetch()}>
                      {lesson && (
                        <div className="rounded-2xl border border-card-border bg-card p-5 shadow-2xs sm:p-6">
                          <LessonHeader lesson={lesson} position={index + 1} total={visibleLessons.length} />
                          <div className="mt-5">
                            {lesson.type === 'quiz' ? (
                              <QuizPlayer
                                key={lesson.id}
                                lesson={lesson}
                                canSubmit={isStudent}
                                submitting={submitQuiz.isPending}
                                onSubmit={async answers => {
                                  const result = await submitQuiz.mutateAsync({ id: lesson.id, data: { answers } });
                                  void recordXapiEvent({
                                    verb: result.passed ? XAPI.completed : XAPI.answered,
                                    objectId: `lesson:${lesson.id}`,
                                    score: result.score,
                                  }).catch(() => {});
                                  await invalidateLms(queryClient);
                                  return result;
                                }}
                              />
                            ) : (
                              <LessonViewer lesson={lesson} materials={lessonMaterials} />
                            )}
                          </div>

                          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                            <Button variant="outline" size="sm" disabled={!prev} onClick={() => prev && go(courseId, prev.id)}>
                              <ChevronLeft size={15} className="mr-1" /> Bài trước
                            </Button>
                            <div className="flex-1" />
                            {lesson.type !== 'quiz' &&
                              (lesson.completed ? (
                                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 size={15} /> Đã học xong
                                </span>
                              ) : (
                                isStudent && (
                                  <Button size="sm" onClick={() => void markComplete()} disabled={complete.isPending}>
                                    <CheckCircle2 size={15} className="mr-1.5" />
                                    {complete.isPending ? 'Đang ghi nhận…' : 'Đánh dấu đã học xong'}
                                  </Button>
                                )
                              ))}
                            <Button variant={lesson.completed || !isStudent ? 'default' : 'outline'} size="sm" disabled={!next} onClick={() => next && go(courseId, next.id)}>
                              Bài tiếp <ChevronRight size={15} className="ml-1" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </QueryState>
                  </div>

                  <OutlineSidebar
                    outline={outline!}
                    activeLessonId={lessonId}
                    showProgress={isStudent}
                    onSelect={id => go(courseId, id)}
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="materials">
              <MaterialsTab courseId={courseId} />
            </TabsContent>
            <TabsContent value="assignments">
              <AssignmentsTab courseId={courseId} />
            </TabsContent>
          </Tabs>
        )}
      </QueryState>
    </div>
  );
}

function LessonHeader({ lesson, position, total }: { lesson: { title: string; type: LessonSummary['type']; durationMinutes: number }; position: number; total: number }) {
  const meta = lessonTypeMeta(lesson.type);
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
        <meta.icon size={13} /> {meta.label} · Bài {position}/{total}
        {lesson.durationMinutes > 0 && <span className="font-medium normal-case text-muted-foreground">· {formatMinutes(lesson.durationMinutes)}</span>}
      </p>
      <h2 className="mt-1 font-display text-xl font-extrabold sm:text-2xl">{lesson.title}</h2>
    </div>
  );
}

function OutlineSidebar({
  outline,
  activeLessonId,
  showProgress,
  onSelect,
}: {
  outline: CourseOutline;
  activeLessonId: number | null;
  showProgress: boolean;
  onSelect: (id: number) => void;
}) {
  const sections = outline.sections
    .map(s => ({ ...s, lessons: s.lessons.filter(l => l.isPublished) }))
    .filter(s => s.lessons.length > 0);
  let counter = 0;
  return (
    <aside className="h-fit space-y-4 rounded-2xl border border-card-border bg-card p-4 shadow-2xs lg:sticky lg:top-4">
      {showProgress && (
        <div>
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="font-semibold">Tiến độ của bạn</span>
            <span className="font-bold">{outline.progress.percent}%</span>
          </div>
          <Progress value={outline.progress.percent} className="h-1.5" />
          <p className="mt-1 text-[11px] text-muted-foreground">
            {outline.progress.completed}/{outline.progress.total} bài đã hoàn thành
          </p>
        </div>
      )}
      <nav className="space-y-4" aria-label="Đề cương khóa học">
        {sections.map(section => (
          <div key={section.id}>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{section.title}</p>
            <ul className="space-y-0.5">
              {section.lessons.map(l => {
                counter += 1;
                const active = l.id === activeLessonId;
                const meta = lessonTypeMeta(l.type);
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(l.id)}
                      aria-current={active ? 'step' : undefined}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition',
                        active ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-muted',
                      )}
                    >
                      {showProgress ? (
                        l.completed ? (
                          <CheckCircle2 size={15} className="shrink-0 text-emerald-600" aria-label="Đã hoàn thành" />
                        ) : (
                          <Circle size={15} className="shrink-0 text-muted-foreground/60" aria-label="Chưa hoàn thành" />
                        )
                      ) : (
                        <meta.icon size={14} className="shrink-0 text-muted-foreground" />
                      )}
                      <span className="flex-1 truncate">
                        {counter}. {l.title}
                      </span>
                      {l.durationMinutes > 0 && <span className="shrink-0 text-[10px] text-muted-foreground">{l.durationMinutes}′</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      {!showProgress && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Lock size={12} /> Bài nháp không hiển thị ở đây.
        </p>
      )}
    </aside>
  );
}

function EmptyCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
      <p className="font-display text-base font-bold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
