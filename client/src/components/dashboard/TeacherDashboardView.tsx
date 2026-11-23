import { useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileCheck,
  FileText,
  GraduationCap,
  Plus,
  Search,
  Sparkles,
  Users,
  Video,
  ArrowUpRight,
  AlertCircle,
  Download,
  Send,
  SlidersHorizontal,
} from 'lucide-react';
import { Link } from 'wouter';
import {
  formatDateTime,
  getListLmsCoursesQueryKey,
  useListLmsCourses,
  useListMyAssignments,
  useListMySubmissions,
} from '@/api';
import type { Assignment, Course, Submission } from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar } from '@/components/common';
import { useRole } from '@/contexts/RoleContext';
import {
  CourseDialog,
  CreateAssignmentDialog,
  CreateMaterialDialog,
  GradeSubmissionDialog,
} from '@/components/dialogs';
import { UpcomingSessionsWidget } from '@/components/schedule/UpcomingSessionsWidget';

export function TeacherDashboardView() {
  const { user, canManageCourse } = useRole();
  const coursesQuery = useListLmsCourses({ query: { queryKey: getListLmsCoursesQueryKey() } });

  const [search, setSearch] = useState('');

  // Dialog states
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [selectedCourseForDialog, setSelectedCourseForDialog] = useState<Course | undefined>(undefined);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [activeCourseId, setActiveCourseId] = useState<number>(1);

  // Grading Dialog states
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  // Bài tập & bài nộp thuộc các khóa học do giảng viên phụ trách (máy chủ đã lọc theo quyền)
  const assignmentsQuery = useListMyAssignments();
  const pendingQuery = useListMySubmissions({ status: 'submitted' });

  const rawCourses = coursesQuery.data ?? [];

  // Chỉ các khóa học giảng viên phụ trách (admin: tất cả)
  const teacherCourses = useMemo(() => {
    return rawCourses.filter(
      c =>
        canManageCourse(c) &&
        `${c.title} ${c.category} ${c.description}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [rawCourses, search, canManageCourse]);

  const allAssignments = assignmentsQuery.data ?? [];
  const pendingSubmissions = pendingQuery.data ?? [];


  // Handler for grading a specific submission
  const handleOpenGradeDialog = (sub: Submission) => {
    const asg = allAssignments.find(a => a.id === sub.assignmentId);
    if (!asg) return;
    setSelectedSubmission(sub);
    setSelectedAssignment(asg);
    setGradeDialogOpen(true);
  };

  // Quick action openers for specific course
  const handleOpenCreateAssignment = (courseId: number) => {
    setActiveCourseId(courseId);
    setAssignmentDialogOpen(true);
  };

  const handleOpenCreateMaterial = (courseId: number) => {
    setActiveCourseId(courseId);
    setMaterialDialogOpen(true);
  };

  return (
    <div className="page-enter space-y-6">
      {/* 1. Header Banner & Quick Action (Teacher Workspace Style) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Tổ Sư Phạm & Đào Tạo · Không gian Giảng viên
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground mt-0.5">
            Lớp học phụ trách & Nghiệp vụ
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Chào mừng <span className="font-semibold text-foreground">{user.name}</span>. Theo dõi lớp học phần, chấm bài tập học viên và quản lý tài liệu giảng dạy.
          </p>
        </div>

        {/* CTA: Soạn khóa học mới */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setSelectedCourseForDialog(undefined);
              setCourseDialogOpen(true);
            }}
            className="rounded-xl text-xs font-semibold gap-1.5 shadow-2xs cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus size={15} />
            <span>Soạn khóa học mới</span>
          </Button>
        </div>
      </div>

      {/* 2. Key Metrics Bar (4 Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-card-border bg-card shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Lớp phụ trách
              </p>
              <h3 className="font-display text-2xl font-extrabold text-foreground mt-1">
                {teacherCourses.length} <span className="text-xs font-normal text-muted-foreground">lớp</span>
              </h3>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                ● Đang mở giảng dạy
              </p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
              <BookOpen size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-card-border bg-card shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Tổng học viên
              </p>
              <h3 className="font-display text-2xl font-extrabold text-foreground mt-1">
                9 <span className="text-xs font-normal text-muted-foreground">học viên</span>
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Trên 3 lớp học phần
              </p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
              <Users size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-card-border bg-card shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Bài nộp chờ chấm
              </p>
              <h3 className="font-display text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-2">
                {pendingSubmissions.length}
                {pendingSubmissions.length > 0 && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                  </span>
                )}
              </h3>
              <p className="text-[10px] text-rose-600/80 font-medium mt-0.5">
                Cần phản hồi sớm
              </p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
              <FileCheck size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-card-border bg-card shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Tiến độ lớp TB
              </p>
              <h3 className="font-display text-2xl font-extrabold text-foreground mt-1">
                62%
              </h3>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                +8% so với tuần trước
              </p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Sparkles size={20} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Main 2-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================
            CENTER COLUMN (8 / 12 Cols):
            - Hàng đợi bài nộp chờ chấm (Pending Grading Queue)
            - Danh sách lớp học phần phụ trách (Classes Taught)
           ======================================================== */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          {/* SECTION A: HÀNG ĐỢI BÀI TẬP CHỜ CHẤM (PENDING GRADING QUEUE) */}
          <Card className="overflow-hidden border-card-border shadow-2xs">
            <CardContent className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
                    <Award size={17} />
                  </div>
                  <div>
                    <h2 className="font-display text-base font-bold text-foreground">
                      Hàng đợi bài nộp chờ chấm
                    </h2>
                    <p className="text-[11px] text-muted-foreground">
                      Bài làm học viên vừa nộp cần giảng viên chấm điểm & gửi nhận xét
                    </p>
                  </div>
                </div>

                <Badge
                  variant={pendingSubmissions.length > 0 ? 'destructive' : 'outline'}
                  className="text-xs font-semibold px-2.5 py-0.5 rounded-lg"
                >
                  {pendingSubmissions.length} bài chờ
                </Badge>
              </div>

              {pendingSubmissions.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-border rounded-xl bg-muted/20">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                  <p className="text-xs font-semibold text-foreground">
                    Tuyệt vời! Không còn bài nộp nào đang chờ chấm
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Tất cả học viên đã nộp bài đều đã nhận được điểm số và nhận xét phản hồi.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingSubmissions.map(sub => {
                    const asg = allAssignments.find(a => a.id === sub.assignmentId);
                    return (
                      <div
                        key={sub.id}
                        className="p-3.5 rounded-xl border border-border/70 bg-card hover:bg-muted/30 transition-all shadow-2xs space-y-2.5"
                      >
                        {/* Student Info & Submission Meta */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={sub.studentName} size="sm" />
                            <div>
                              <p className="text-xs font-bold text-foreground">{sub.studentName}</p>
                              <p className="text-[10px] text-muted-foreground">
                                Đã nộp lúc: <span className="font-medium text-foreground">{formatDateTime(sub.submittedAt)}</span>
                              </p>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            onClick={() => handleOpenGradeDialog(sub)}
                            className="h-8 rounded-xl text-xs gap-1.5 shadow-2xs cursor-pointer bg-rose-600 hover:bg-rose-700 text-white shrink-0"
                          >
                            <Award size={13} />
                            <span>Chấm điểm ngay</span>
                          </Button>
                        </div>

                        {/* Assignment Title & Course */}
                        <div className="bg-muted/40 p-2.5 rounded-lg text-xs space-y-1">
                          <div className="flex items-center gap-1.5 font-semibold text-foreground">
                            <FileText size={13} className="text-primary shrink-0" />
                            <span className="line-clamp-1">{asg ? asg.title : 'Bài tập tuần'}</span>
                          </div>
                          {sub.textContent && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2 italic pl-4">
                              "{sub.textContent}"
                            </p>
                          )}
                          {sub.fileName && (
                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-primary pl-4 pt-0.5">
                              <Download size={11} />
                              <span className="font-medium underline underline-offset-2">{sub.fileName}</span>
                              {sub.fileSize && <span className="text-muted-foreground">({sub.fileSize})</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* SECTION B: DANH SÁCH LỚP HỌC PHẦN PHỤ TRÁCH (CLASSES TAUGHT) */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-card-border p-3 rounded-2xl shadow-2xs">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Tìm kiếm môn học phụ trách..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-10 h-9 bg-background/60 text-xs rounded-xl border-border/80"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">
                  {teacherCourses.length} khóa học trong danh mục
                </span>
              </div>
            </div>

            {/* Course Cards Grid (Matching reference style) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teacherCourses.map(course => {
                return (
                  <Card
                    key={course.id}
                    className="overflow-hidden border-card-border hover:border-primary/40 transition-all duration-200 shadow-2xs hover:shadow-xs flex flex-col justify-between group bg-card"
                  >
                    <div>
                      {/* Top Banner with Accent & Tags */}
                      <div
                        className="p-4 h-28 relative flex flex-col justify-between"
                        style={{ background: course.coverImageUrl ? `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url("${encodeURI(course.coverImageUrl)}") center / cover` : 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff' }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-md bg-white/90 text-slate-900 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-2xs">
                              {course.category}
                            </span>
                            <span className="rounded-md bg-black/20 backdrop-blur-xs px-2 py-0.5 text-[9px] font-medium text-white">
                              {course.level}
                            </span>
                          </div>
                          <span className="rounded-md bg-black/40 backdrop-blur-xs px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-white">
                            {course.format || 'xAPI'}
                          </span>
                        </div>

                        <div className="flex items-center justify-end">
                          <div className="h-6 w-6 rounded-full bg-white/20 backdrop-blur-xs grid place-items-center text-white">
                            <GraduationCap size={13} />
                          </div>
                        </div>
                      </div>

                      {/* Course Body */}
                      <div className="p-4 space-y-3">
                        <div>
                          <Link
                            href={`/courses/${course.id}`}
                            className="font-display text-base font-bold text-foreground hover:text-primary transition-colors line-clamp-1 group-hover:underline underline-offset-2"
                          >
                            {course.title}
                          </Link>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Giảng viên: <span className="font-medium text-foreground">{user.name}</span>
                          </p>
                          <p className="text-xs text-muted-foreground/80 mt-1.5 line-clamp-2">
                            {course.description}
                          </p>
                        </div>

                        {/* Meta: Lessons, Duration, Students */}
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-2 border-t border-border/50">
                          <span className="flex items-center gap-1">
                            <BookOpen size={12} />
                            {course.lessons} bài
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock3 size={12} />
                            {course.duration || '2 giờ'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users size={12} />
                            {course.enrolled} học viên
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions & Progress */}
                    <div className="p-4 pt-0 space-y-3">
                      {/* Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-muted-foreground">Tiến độ lớp:</span>
                          <span className="font-mono font-bold text-primary">{course.progress}%</span>
                        </div>
                        <Progress value={course.progress} className="h-1.5" />
                      </div>

                      {/* Action CTA Buttons */}
                      <div className="pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenCreateAssignment(Number(course.id))}
                            className="h-7 text-[10px] px-2 rounded-lg border-border hover:bg-muted cursor-pointer"
                            title="Giao bài tập mới cho lớp này"
                          >
                            + Giao bài
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenCreateMaterial(Number(course.id))}
                            className="h-7 text-[10px] px-2 rounded-lg border-border hover:bg-muted cursor-pointer"
                            title="Đăng tài liệu PDF / Slide mới"
                          >
                            + Tài liệu
                          </Button>
                        </div>

                        <Link href={`/courses/${course.id}`}>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 text-[10px] px-2.5 rounded-lg gap-1 cursor-pointer"
                          >
                            <span>Vào lớp</span>
                            <ArrowUpRight size={11} />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        {/* ========================================================
            RIGHT COLUMN (4 / 12 Cols):
            - Lịch giảng dạy & Hạn nộp bài
            - Nhật ký hoạt động nộp bài gần đây
           ======================================================== */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          {/* COMPONENT 1: Lịch dạy trực tuyến sắp tới (các khóa học phụ trách) */}
          <UpcomingSessionsWidget
            title="Lịch dạy sắp tới"
            emptyText="Chưa có buổi dạy nào sắp tới. Thêm lịch trong tab Lịch học của khóa học."
          />

          {/* COMPONENT 2: Hoạt động học viên gần đây (Feed) */}
          <Card className="overflow-hidden border-card-border shadow-2xs">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
                    <Clock3 size={16} />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-foreground">Hoạt động lớp gần đây</h3>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">Realtime feed</span>
              </div>

              <div className="space-y-3 pt-1">
                <div className="flex items-start gap-2.5 text-xs">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-medium">
                      <span className="font-bold">Nguyễn Tú</span> vừa nộp bài tập Tuần 1.
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">21-11-2026 · 10:15</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 text-xs">
                  <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-medium">
                      <span className="font-bold">Trần Mỹ Uyên</span> vừa nộp bài tập Tuần 1.
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">21-11-2026 · 14:05</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 text-xs">
                  <div className="h-2 w-2 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-medium">
                      <span className="font-bold">Vũ Thành Đạt</span> vừa nộp bài thu hoạch giữa kỳ.
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">21-11-2026 · 16:40</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 text-xs">
                  <div className="h-2 w-2 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-medium">
                      <span className="font-bold">Ngann</span> đã nhận điểm 9.5 bài tập Tuần 1.
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">19-11-2026 · 09:15</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ========================================================
          DIALOGS: Course Dialog, Assignment Dialog, Material Dialog, Grade Dialog
         ======================================================== */}
      {/* 1. Course Dialog (Soạn khóa học) */}
      <CourseDialog
        open={courseDialogOpen}
        course={selectedCourseForDialog}
        onClose={() => setCourseDialogOpen(false)}
      />

      {/* 2. Create Assignment Dialog */}
      <CreateAssignmentDialog
        open={assignmentDialogOpen}
        courseId={activeCourseId}
        onClose={() => setAssignmentDialogOpen(false)}
      />

      {/* 3. Create Material Dialog */}
      <CreateMaterialDialog
        open={materialDialogOpen}
        courseId={activeCourseId}
        onClose={() => setMaterialDialogOpen(false)}
      />

      {/* 4. Grade Submission Dialog */}
      {selectedSubmission && selectedAssignment && (
        <GradeSubmissionDialog
          open={gradeDialogOpen}
          submission={selectedSubmission}
          assignment={selectedAssignment}
          onClose={() => {
            setGradeDialogOpen(false);
            setSelectedSubmission(null);
            setSelectedAssignment(null);
          }}
        />
      )}
    </div>
  );
}
