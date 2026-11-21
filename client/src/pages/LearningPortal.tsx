import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Play,
  UserCheck,
  UploadCloud,
  Video,
  Sparkles,
  FileText,
  FileCheck,
  BookOpen,
  Award,
} from 'lucide-react';
import {
  getGetLmsDashboardQueryKey,
  getGetLmsLeaderboardQueryKey,
  getListLmsCertificatesQueryKey,
  getListLmsCoursesQueryKey,
  getListLmsLearnersQueryKey,
  useCompleteLmsLesson,
  useListLmsCourses,
  useRecordXapiEvent,
} from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Heading, Notice, Avatar, Field, MediaUploader } from '@/components/common';
import { MaterialsTab } from '@/components/learning/MaterialsTab';
import { AssignmentsTab } from '@/components/learning/AssignmentsTab';
import { useRole } from '@/contexts/RoleContext';

export default function LearningPortal() {
  const { role, user } = useRole();
  const qc = useQueryClient();
  const coursesQuery = useListLmsCourses({ query: { queryKey: getListLmsCoursesQueryKey() } });
  const complete = useCompleteLmsLesson();
  const record = useRecordXapiEvent();

  const [learnerId] = useState('3'); // Mặc định học sinh Ngann (ID: 3)
  const [courseId, setCourseId] = useState('');
  const [lessonNumber, setLessonNumber] = useState(1);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [failure, setFailure] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSeconds, setPlaybackSeconds] = useState(0);
  const [customMediaUrl, setCustomMediaUrl] = useState('');
  const [customMediaType, setCustomMediaType] = useState('video');
  const [showUploader, setShowUploader] = useState(false);

  const courses = coursesQuery.data ?? [];
  const selectedCourse = courses.find(c => String(c.id) === courseId);
  const lessonCount = selectedCourse?.lessons ?? 4;
  const lessonTitles = [
    'Lắng nghe và thấu hiểu',
    'Đặt câu hỏi gợi mở',
    'Tìm ra nguyên nhân cốt lõi',
    'Đề xuất giải pháp an toàn',
    'Thực hành tình huống',
    'Kiểm tra năng lực',
  ];
  const activeLessonTitle = lessonTitles[(lessonNumber - 1) % lessonTitles.length] ?? `Bài học ${lessonNumber}`;

  // Đọc courseId từ query URL nếu có (?courseId=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paramId = params.get('courseId');
    if (paramId && courses.some(c => String(c.id) === paramId)) {
      setCourseId(paramId);
    } else if (courses.length && !courseId) {
      setCourseId(String(courses[0]!.id));
    }
  }, [courses]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => setPlaybackSeconds(v => Math.min(300, v + 1)), 1000);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const submit = () => {
    if (!courseId || selectedAnswer === null) return;
    const score = selectedAnswer === 1 ? 100 : 40;
    setFeedback('');
    setFailure(false);
    record.mutate(
      {
        data: {
          learnerId: Number(learnerId),
          verb: score >= 70 ? 'http://adlnet.gov/expapi/verbs/completed' : 'http://adlnet.gov/expapi/verbs/answered',
          objectId: `course:${courseId}/lesson:${lessonNumber}`,
          score,
          raw: { lessonTitle: activeLessonTitle, answerIndex: selectedAnswer },
        },
      },
      {
        onSuccess: () => {
          if (score < 70) {
            setFailure(true);
            setFeedback('Chưa đạt 70 điểm. Hệ thống đã lưu lượt thử xAPI — hãy chọn lại đáp án B và nộp lại nhé!');
            return;
          }
          complete.mutate(
            {
              data: {
                learnerId: Number(learnerId),
                courseId: Number(courseId),
                lessonId: `lesson-${lessonNumber}`,
                score,
              },
            },
            {
              onSuccess: result => {
                setCompleted(true);
                setFeedback(
                  `Tuyệt vời! Bạn hoàn thành bài học đạt ${score} điểm (+${result.pointsAwarded} điểm thưởng)${
                    result.certificateIssued ? ' · 🎓 Bạn đã được cấp chứng chỉ mới!' : ''
                  }`
                );
                qc.invalidateQueries({ queryKey: getListLmsLearnersQueryKey() });
                qc.invalidateQueries({ queryKey: getListLmsCoursesQueryKey() });
                qc.invalidateQueries({ queryKey: getGetLmsDashboardQueryKey() });
                qc.invalidateQueries({ queryKey: getListLmsCertificatesQueryKey() });
                qc.invalidateQueries({ queryKey: getGetLmsLeaderboardQueryKey() });
              },
            }
          );
        },
      }
    );
  };

  const reset = () => {
    setCompleted(false);
    setSelectedAnswer(null);
    setFeedback('');
    setPlaybackSeconds(0);
    setIsPlaying(false);
  };

  return (
    <div className="page-enter">
      {/* Banner xem trước nếu là Giảng viên hoặc Quản trị viên */}
      {role !== 'student' && (
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-xs text-blue-900 dark:text-blue-200">
          <div className="flex items-center gap-2">
            <UserCheck size={16} className="text-blue-600" />
            <span>
              <b>Chế độ xem trước bài giảng:</b> Bạn đang trải nghiệm giao diện người học dưới góc nhìn của học sinh.
            </span>
          </div>
          <span className="font-semibold text-blue-700 dark:text-blue-300">{user.name}</span>
        </div>
      )}

      <Heading
        eyebrow="Nếp học · Bàn học trực tuyến"
        title={selectedCourse ? selectedCourse.title : 'Không gian học tập tương tác'}
        description="Xem bài giảng, tra cứu tài liệu học phần, nộp bài tập và hoàn thành các bài trắc nghiệm nhanh."
      />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          {/* Lựa chọn khóa học và bài học */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Môn học đang chọn">
              <select
                value={courseId}
                onChange={e => {
                  setCourseId(e.target.value);
                  setLessonNumber(1);
                  setCustomMediaUrl('');
                  reset();
                }}
                className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm font-medium"
              >
                {courses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={`Bài học trong môn (${lessonCount} bài)`}>
              <select
                value={lessonNumber}
                onChange={e => {
                  setLessonNumber(Number(e.target.value));
                  reset();
                }}
                className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm font-medium"
              >
                {Array.from({ length: lessonCount }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Bài {i + 1}: {lessonTitles[i % lessonTitles.length]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* HỆ THỐNG CÁC TAB CỐT LÕI (Chuẩn Moodle Core) */}
          <Tabs defaultValue="video" className="w-full">
            <TabsList className="mb-4 grid w-full grid-cols-4 h-11 p-1 bg-muted/80 rounded-xl">
              <TabsTrigger value="video" className="text-xs font-semibold gap-1.5 data-[state=active]:shadow-xs">
                <Play size={13} />
                <span className="hidden sm:inline">Bài giảng</span> Video
              </TabsTrigger>
              <TabsTrigger value="materials" className="text-xs font-semibold gap-1.5 data-[state=active]:shadow-xs">
                <FileText size={13} />
                <span className="hidden sm:inline">Tài liệu</span> Học phần
              </TabsTrigger>
              <TabsTrigger value="assignments" className="text-xs font-semibold gap-1.5 data-[state=active]:shadow-xs">
                <FileCheck size={13} />
                <span className="hidden sm:inline">Bài tập &</span> Nộp bài
              </TabsTrigger>
              <TabsTrigger value="quiz" className="text-xs font-semibold gap-1.5 data-[state=active]:shadow-xs">
                <Sparkles size={13} />
                Quiz Game
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: BÀI GIẢNG VIDEO */}
            <TabsContent value="video" className="space-y-4">
              {/* Thanh công cụ Đổi video bài giảng */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-bold text-primary border-primary/30">
                    {customMediaUrl || (selectedCourse as any)?.mediaUrl
                      ? 'Đang phát video đã tải lên'
                      : 'Bài giảng tương tác H5P'}
                  </Badge>
                  {(customMediaUrl || (selectedCourse as any)?.mediaUrl) && (
                    <span className="text-[11px] text-muted-foreground truncate max-w-[220px]">
                      {(customMediaUrl || (selectedCourse as any)?.mediaUrl).startsWith('/uploads')
                        ? '📁 Đã lưu trên máy chủ'
                        : '🌐 Từ kho học liệu mẫu'}
                    </span>
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUploader(!showUploader)}
                  className="h-8 text-xs font-semibold gap-1.5"
                >
                  <UploadCloud size={14} />
                  <span>{showUploader ? 'Đóng bộ tải tệp' : 'Đổi Video / Audio bài giảng'}</span>
                </Button>
              </div>

              {showUploader && (
                <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-bold">Tải lên video / audio thật từ máy tính hoặc chọn bài mẫu</p>
                  </div>
                  <MediaUploader
                    value={customMediaUrl || (selectedCourse as any)?.mediaUrl}
                    mediaType={customMediaType || (selectedCourse as any)?.mediaType}
                    onChange={(url, type) => {
                      setCustomMediaUrl(url);
                      setCustomMediaType(type);
                    }}
                    onRemove={() => {
                      setCustomMediaUrl('');
                    }}
                  />
                </div>
              )}

              {/* Khung Video bài giảng */}
              <Card className="overflow-hidden border-card-border shadow-2xs">
                {customMediaUrl || (selectedCourse as any)?.mediaUrl ? (
                  (customMediaType || (selectedCourse as any)?.mediaType) === 'audio' ? (
                    <div className="p-6 bg-linear-to-r from-emerald-950 to-teal-900 text-white text-center">
                      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white/20">
                        <Play size={22} fill="currentColor" />
                      </div>
                      <p className="font-display text-base font-bold">{activeLessonTitle}</p>
                      <p className="text-xs text-white/70 mt-1">Bài giảng audio phát âm chuẩn</p>
                      <audio
                        src={customMediaUrl || (selectedCourse as any)?.mediaUrl}
                        controls
                        className="w-full mt-4"
                      />
                    </div>
                  ) : (
                    <div className="relative aspect-video overflow-hidden bg-black grid place-items-center">
                      <video
                        src={customMediaUrl || (selectedCourse as any)?.mediaUrl}
                        controls
                        className="h-full w-full object-contain"
                      >
                        Trình duyệt của bạn không hỗ trợ thẻ video.
                      </video>
                    </div>
                  )
                ) : (
                  <div className="relative aspect-video overflow-hidden bg-[#243c3a]">
                    <div className="absolute inset-0 bg-linear-to-br from-[#243c3a] via-[#456b5d] to-[#d29b72] opacity-90" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white">
                      <span className="mb-3 rounded-full border border-white/40 bg-black/20 px-3 py-0.5 text-[9px] font-bold uppercase tracking-[.2em]">
                        BÀI HỌC {lessonNumber} / {lessonCount} · CHUẨN H5P
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="grid h-14 w-14 place-items-center rounded-full border border-white/60 bg-white/20 backdrop-blur-xs transition hover:scale-105"
                      >
                        {isPlaying ? <span className="h-4 w-4 rounded-xs bg-white" /> : <Play size={20} fill="currentColor" />}
                      </button>
                      <p className="mt-3 text-xs font-semibold">{isPlaying ? `Đang phát: ${activeLessonTitle}` : activeLessonTitle}</p>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="300"
                      value={playbackSeconds}
                      onChange={e => setPlaybackSeconds(Number(e.target.value))}
                      className="absolute bottom-6 left-4 right-4 z-10 h-1 cursor-pointer accent-amber-400"
                    />
                    <div className="absolute bottom-2 left-4 flex items-center gap-2 text-[10px] text-white/80">
                      <span>
                        {String(Math.floor(playbackSeconds / 60)).padStart(2, '0')}:
                        {String(playbackSeconds % 60).padStart(2, '0')} / 05:00
                      </span>
                      <span>· Phụ đề Tiếng Việt</span>
                    </div>
                  </div>
                )}
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Nội dung bài {lessonNumber}</p>
                      <h3 className="font-display text-lg font-bold">{activeLessonTitle}</h3>
                    </div>
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                      5 phút
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    Hãy lắng nghe và quan sát tình huống thực tế để nhận diện nhu cầu trọng tâm trước khi đưa ra phương án giải quyết.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: TÀI LIỆU HỌC PHẦN (MATERIALS) */}
            <TabsContent value="materials">
              <MaterialsTab courseId={Number(courseId) || 1} />
            </TabsContent>

            {/* TAB 3: BÀI TẬP & NỘP BÀI (ASSIGNMENTS) */}
            <TabsContent value="assignments">
              <AssignmentsTab courseId={Number(courseId) || 1} />
            </TabsContent>

            {/* TAB 4: TRẮC NGHIỆM QUIZ GAME */}
            <TabsContent value="quiz" className="space-y-4">
              <Card className="border-card-border shadow-2xs">
                <CardContent className="p-5">
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[.15em] text-primary">Kiểm tra nhanh · Quiz Game</p>
                      <h3 className="mt-1 font-display text-base font-bold">
                        Khi đồng nghiệp hoặc khách hàng gặp vấn đề, bạn nên làm gì trước tiên?
                      </h3>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {[
                      'Đưa ra ngay giải pháp cá nhân mà bạn nghĩ là đúng nhất.',
                      'Lắng nghe cẩn thận, đặt câu hỏi gợi mở để hiểu đúng nhu cầu cốt lõi.',
                      'Chuyển vấn đề cho người khác xử lý mà không cần tìm hiểu.',
                    ].map((answer, i) => (
                      <button
                        key={answer}
                        onClick={() => {
                          setSelectedAnswer(i);
                          setFeedback('');
                        }}
                        disabled={completed}
                        className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-xs transition ${
                          selectedAnswer === i
                            ? 'border-primary bg-primary/10 font-semibold text-foreground'
                            : 'border-border hover:bg-muted/50'
                        }`}
                      >
                        <span
                          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                            selectedAnswer === i
                              ? 'bg-primary text-primary-foreground'
                              : 'border border-border text-muted-foreground'
                          }`}
                        >
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className="flex-1">{answer}</span>
                        {completed && i === 1 && <Check size={16} className="text-primary" />}
                      </button>
                    ))}
                  </div>
                  {feedback && (
                    <div className="mt-4">
                      <Notice message={feedback} error={failure} />
                    </div>
                  )}
                  <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                    <p className="text-[11px] text-muted-foreground">Đạt từ 70 điểm để hoàn tất bài học (Chuẩn xAPI).</p>
                    {completed ? (
                      <Button variant="outline" size="sm" onClick={reset}>
                        Học lại bài này
                      </Button>
                    ) : (
                      <Button size="sm" onClick={submit} disabled={selectedAnswer === null || complete.isPending}>
                        {complete.isPending ? 'Đang nộp...' : 'Nộp câu trả lời'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Khung tiến độ & mục tiêu học tập bên phải */}
        <div className="space-y-5">
          <Card className="border-card-border shadow-2xs">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <Avatar name={role === 'student' ? user.name : 'Ngann'} size="md" />
                <div>
                  <p className="text-xs text-muted-foreground">Hồ sơ người học</p>
                  <p className="font-display text-base font-bold">{role === 'student' ? user.name : 'Ngann (Học viên mẫu)'}</p>
                </div>
              </div>
              <div className="mt-4 flex justify-between text-xs">
                <span>Tiến độ học phần</span>
                <span className="font-bold">82%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: '82%' }} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl bg-muted/60 p-3">
                  <p className="text-xs text-[#bd6846] font-bold">12 ngày</p>
                  <p className="text-[10px] text-muted-foreground">Chuyên cần</p>
                </div>
                <div className="rounded-xl bg-muted/60 p-3">
                  <p className="text-xs text-primary font-bold">1.840</p>
                  <p className="text-[10px] text-muted-foreground">Điểm tích lũy</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-card-border shadow-2xs">
            <CardContent className="p-5">
              <h4 className="font-display text-sm font-bold">Danh sách bài học trong môn</h4>
              <div className="mt-3 space-y-1">
                {lessonTitles.slice(0, lessonCount).map((t, idx) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setLessonNumber(idx + 1);
                      reset();
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-lg p-2 text-left text-xs transition ${
                      lessonNumber === idx + 1
                        ? 'bg-primary/10 font-bold text-primary'
                        : 'text-muted-foreground hover:bg-muted/50'
                    }`}
                  >
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-secondary text-[10px]">{idx + 1}</span>
                    <span className="flex-1 truncate">{t}</span>
                    {idx === 0 && <Check size={13} className="text-primary" />}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
