import { useMemo, useState, useEffect } from 'react';
import { useRoute, useLocation, Link } from 'wouter';
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  CircleDashed,
  Clock3,
  FileText,
  GraduationCap,
  ListChecks,
  Play,
  Plus,
  Settings2,
  Share2,
  Sparkles,
  Trophy,
  Users,
  Video,
  Flame,
  Award,
} from 'lucide-react';
import {
  getListLmsCoursesQueryKey,
  getListLmsLearnersQueryKey,
  useListLmsCourses,
  useListLmsLearners,
} from '@/api';
import type { Course } from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Avatar, accentBackgrounds } from '@/components/common';
import { MaterialsTab } from '@/components/learning/MaterialsTab';
import { AssignmentsTab } from '@/components/learning/AssignmentsTab';
import { CourseDialog, EnrollDialog } from '@/components/dialogs';
import { useRole } from '@/contexts/RoleContext';

const courseGradients: Record<string, string> = {
  teal: 'from-emerald-900/60 via-teal-900/40 to-slate-900',
  violet: 'from-purple-900/60 via-indigo-900/40 to-slate-900',
  amber: 'from-amber-900/60 via-orange-900/40 to-slate-900',
  blue: 'from-sky-900/60 via-blue-900/40 to-slate-900',
  rose: 'from-rose-900/60 via-pink-900/40 to-slate-900',
};

const defaultLessonTitles = [
  'Tổng quan & Giới thiệu học phần',
  'Lắng nghe và thấu hiểu nguyên tắc cốt lõi',
  'Đặt câu hỏi gợi mở & Thu thập dữ liệu',
  'Đề xuất giải pháp & Thực hành ứng dụng',
  'Thực hành xử lý tình huống thực tế',
  'Kiểm tra năng lực & Đánh giá tổng kết',
];

export default function CourseDetail() {
  const [, params] = useRoute('/courses/:id');
  const [, setLocation] = useLocation();
  const { role } = useRole();

  const coursesQuery = useListLmsCourses({ query: { queryKey: getListLmsCoursesQueryKey() } });
  const learnersQuery = useListLmsLearners({ query: { queryKey: getListLmsLearnersQueryKey() } });

  const [activeTab, setActiveTab] = useState<'syllabus' | 'materials' | 'assignments' | 'learners'>('syllabus');
  const [courseDialog, setCourseDialog] = useState(false);
  const [enrollDialog, setEnrollDialog] = useState(false);

  const courseId = params?.id ? Number(params.id) : 0;
  const courses = coursesQuery.data ?? [];
  const learners = learnersQuery.data ?? [];

  // Tìm khóa học theo ID
  const course = useMemo(() => {
    return courses.find(c => Number(c.id) === courseId);
  }, [courses, courseId]);

  // Danh sách bài học của môn học này
  const lessonCount = course?.lessons ?? 5;
  const lessons = useMemo(() => {
    return Array.from({ length: lessonCount }, (_, i) => {
      const lessonNumber = i + 1;
      const title = defaultLessonTitles[i % defaultLessonTitles.length] ?? `Bài học ${lessonNumber}`;
      let status: 'completed' | 'in_progress' | 'not_started' = 'not_started';
      if (i === 0) status = 'completed';
      else if (i === 1) status = 'in_progress';

      return {
        number: lessonNumber,
        title,
        duration: `${15 + i * 5} phút`,
        status,
        format: course?.format ?? 'Native',
      };
    });
  }, [lessonCount, course?.format]);

  // Lọc học viên thuộc môn học này
  const enrolledLearners = useMemo(() => {
    if (!course) return learners.slice(0, 4);
    // Ưu tiên học viên có activeCourse khớp hoặc lấy mẫu
    const matched = learners.filter(l => l.activeCourse === course.title);
    return matched.length > 0 ? matched : learners.slice(0, Math.min(course.enrolled || 4, learners.length));
  }, [learners, course]);

  if (coursesQuery.isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Đang tải thông tin khóa học...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="page-enter py-12 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <BookOpen size={28} />
        </div>
        <h2 className="font-display text-xl font-bold">Không tìm thấy khóa học</h2>
        <p className="mt-1 text-sm text-muted-foreground">Môn học có thể đã bị xóa hoặc đường dẫn không hợp lệ.</p>
        <Button className="mt-6" onClick={() => setLocation('/courses')}>
          <ArrowLeft size={16} className="mr-2" />
          Quay lại danh mục khóa học
        </Button>
      </div>
    );
  }

  const gradientClass = courseGradients[course.accent] ?? 'from-slate-800 to-slate-900';
  const instructorName = (course as any).instructor_name || (course as any).instructorName || 'Cô Bui Ngan';

  return (
    <div className="page-enter pb-12 space-y-6">
      {/* 1. Hero Header Card */}
      <Card className="overflow-hidden border-card-border shadow-sm">
        <div className={`relative bg-gradient-to-r ${gradientClass} p-6 sm:p-8 text-white`}>
          <div className="relative z-10">
            {/* Badges strip */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge variant="secondary" className="bg-white/15 text-white backdrop-blur-sm border-0 font-bold uppercase tracking-wider text-[10px]">
                {course.category}
              </Badge>
              <Badge variant="outline" className="border-white/20 text-white/90 text-[10px]">
                {course.level}
              </Badge>
              <Badge variant="outline" className="border-white/20 text-white/90 text-[10px]">
                Định dạng: {course.format}
              </Badge>
              <Badge className="bg-emerald-500/80 text-white border-0 text-[10px]">
                {course.status}
              </Badge>
            </div>

            {/* Course Title */}
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white mb-3">
              {course.title}
            </h1>

            {/* Instructor & Description */}
            <p className="text-white/80 text-sm max-w-3xl leading-relaxed mb-6">
              {course.description}
            </p>

            {/* Instructor Info */}
            <div className="flex items-center gap-3 mb-6 bg-black/20 backdrop-blur-sm rounded-xl p-3 inline-flex border border-white/10">
              <Avatar name={instructorName} className="h-8 w-8 text-xs" />
              <div>
                <p className="text-xs font-semibold text-white">{instructorName}</p>
                <p className="text-[10px] text-white/70">Giảng viên phụ trách chuyên môn</p>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/15">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/15 text-white">
                  <ListChecks size={16} />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-white/70">Bài học</p>
                  <p className="text-sm font-bold text-white">{course.lessons} bài giảng</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/15 text-white">
                  <Clock3 size={16} />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-white/70">Thời lượng</p>
                  <p className="text-sm font-bold text-white">{course.duration}</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/15 text-white">
                  <Users size={16} />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-white/70">Học viên</p>
                  <p className="text-sm font-bold text-white">{course.enrolled} học sinh</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/15 text-white">
                  <Trophy size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase font-bold text-white/70">Tiến độ lớp</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white">{course.progress}%</p>
                    <div className="h-1.5 flex-1 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 rounded-full"
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Main Content 4 Tabs & Action Buttons at the same level */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 h-11 w-full sm:max-w-xl bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="syllabus" className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <BookOpen size={14} />
              Đề cương ({lessons.length})
            </TabsTrigger>
            <TabsTrigger value="materials" className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <FileText size={14} />
              Tài liệu học tập
            </TabsTrigger>
            <TabsTrigger value="assignments" className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <GraduationCap size={14} />
              Bài tập & Nộp bài
            </TabsTrigger>
            <TabsTrigger value="learners" className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <Users size={14} />
              Học viên ({enrolledLearners.length})
            </TabsTrigger>
          </TabsList>

          {/* Nút Vào bàn học trực tuyến & Các nút thao tác cùng hàng với Tabs */}
          <div className="flex items-center gap-2 shrink-0">
            {role !== 'student' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 text-xs font-semibold rounded-xl cursor-pointer"
                  onClick={() => setEnrollDialog(true)}
                >
                  <Users size={13} className="mr-1.5" />
                  Ghi danh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 text-xs font-semibold rounded-xl cursor-pointer"
                  onClick={() => setCourseDialog(true)}
                >
                  <Settings2 size={13} className="mr-1.5" />
                  Sửa môn
                </Button>
              </>
            )}

            <Link
              href={`/learn?courseId=${course.id}`}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground shadow-xs hover:opacity-90 transition-all cursor-pointer"
            >
              <Play size={14} fill="currentColor" />
              Vào bàn học trực tuyến
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>

        {/* TAB 1: Đề cương bài học */}
        <TabsContent value="syllabus" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-bold text-foreground">
                Đề cương & Danh sách bài học
              </h3>
            </div>
            <Link
              href={`/learn?courseId=${course.id}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Học toàn bộ bài học <ArrowUpRight size={13} />
            </Link>
          </div>

          <div className="grid gap-3">
            {lessons.map(lesson => (
              <Card
                key={lesson.number}
                className="overflow-hidden border-card-border transition hover:border-primary/50 hover:shadow-sm"
              >
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    {/* Lesson index badge */}
                    <div
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-mono font-bold ${
                        lesson.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : lesson.status === 'in_progress'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {lesson.status === 'completed' ? (
                        <CheckCircle2 size={18} />
                      ) : lesson.status === 'in_progress' ? (
                        <Play size={16} fill="currentColor" />
                      ) : (
                        String(lesson.number).padStart(2, '0')
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Bài {lesson.number}
                        </span>
                        <Badge
                          variant={
                            lesson.status === 'completed'
                              ? 'default'
                              : lesson.status === 'in_progress'
                              ? 'secondary'
                              : 'outline'
                          }
                          className="text-[9px] h-4 px-1.5"
                        >
                          {lesson.status === 'completed'
                            ? 'Đã hoàn thành'
                            : lesson.status === 'in_progress'
                            ? 'Đang học'
                            : 'Chưa bắt đầu'}
                        </Badge>
                      </div>
                      <h4 className="font-semibold text-sm text-foreground mt-0.5">
                        {lesson.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                        <span className="inline-flex items-center gap-1">
                          <Clock3 size={12} /> {lesson.duration}
                        </span>
                        <span>•</span>
                        <span>Định dạng: {lesson.format}</span>
                      </p>
                    </div>
                  </div>

                  {/* Action jump into lesson */}
                  <div className="flex items-center justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                    <Link
                      href={`/learn?courseId=${course.id}&lesson=${lesson.number}`}
                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-secondary px-3 text-xs font-semibold text-secondary-foreground hover:bg-muted transition-colors"
                    >
                      {lesson.status === 'completed'
                        ? 'Ôn lại bài'
                        : lesson.status === 'in_progress'
                        ? 'Tiếp tục học'
                        : 'Bắt đầu học'}
                      <ArrowUpRight size={12} />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* TAB 2: Tài liệu học tập */}
        <TabsContent value="materials">
          <MaterialsTab courseId={Number(course.id)} />
        </TabsContent>

        {/* TAB 3: Bài tập & Nộp bài */}
        <TabsContent value="assignments">
          <AssignmentsTab courseId={Number(course.id)} />
        </TabsContent>

        {/* TAB 4: Danh sách học viên */}
        <TabsContent value="learners" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-bold text-foreground">
                Danh sách học viên đã ghi danh
              </h3>
              <p className="text-xs text-muted-foreground">
                Tổng cộng {enrolledLearners.length} học viên tham gia lớp học phần này.
              </p>
            </div>
            {role !== 'student' && (
              <Button size="sm" onClick={() => setEnrollDialog(true)}>
                <Plus size={14} className="mr-1.5" />
                Ghi danh học viên mới
              </Button>
            )}
          </div>

          <Card className="overflow-hidden border-card-border shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Học viên</th>
                    <th className="px-4 py-3">Nhóm / Lớp</th>
                    <th className="px-4 py-3">Điểm tích lũy</th>
                    <th className="px-4 py-3">Chuỗi ngày</th>
                    <th className="px-4 py-3">Tiến độ môn này</th>
                    <th className="px-4 py-3 text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {enrolledLearners.map(learner => (
                    <tr key={learner.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={learner.name} className="h-8 w-8 text-xs" />
                          <div>
                            <p className="font-semibold text-foreground">{learner.name}</p>
                            <p className="text-[10px] text-muted-foreground">{learner.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-medium">
                        {learner.team}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-primary">
                        {learner.points.toLocaleString('vi-VN')} điểm
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs">
                          <Flame size={13} className="text-[#bd6846]" />
                          {learner.streak} ngày
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-32 flex items-center gap-2">
                          <Progress value={learner.progress} className="h-2 flex-1" />
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {learner.progress}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-0">
                          Đang học
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CourseDialog open={courseDialog} course={course} onClose={() => setCourseDialog(false)} />
      <EnrollDialog
        open={enrollDialog}
        onClose={() => setEnrollDialog(false)}
        learners={learners}
        courses={[course]}
      />
    </div>
  );
}
