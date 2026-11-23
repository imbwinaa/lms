import { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flame,
  GraduationCap,
  ListChecks,
  Play,
  Search,
  Sparkles,
  Trophy,
  Users,
  Video,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Link } from 'wouter';
import {
  getListLmsCoursesQueryKey,
  useListLmsCourses,
} from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useRole } from '@/contexts/RoleContext';
import { UpcomingSessionsWidget } from '@/components/schedule/UpcomingSessionsWidget';

export function StudentDashboardView() {
  const { user } = useRole();
  const coursesQuery = useListLmsCourses({ query: { queryKey: getListLmsCoursesQueryKey() } });

  const [semester, setSemester] = useState('hk1');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'default' | 'progress' | 'title'>('default');
  const [rankingTab, setRankingTab] = useState<'class' | 'course'>('class');

  const rawCourses = coursesQuery.data ?? [];

  // Lọc và sắp xếp danh sách môn học
  const courses = useMemo(() => {
    let list = rawCourses.filter(c =>
      `${c.title} ${c.category} ${c.description}`.toLowerCase().includes(search.toLowerCase())
    );

    if (sort === 'progress') {
      list = [...list].sort((a, b) => b.progress - a.progress);
    } else if (sort === 'title') {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
  }, [rawCourses, search, sort]);


  return (
    <div className="page-enter space-y-6">
      {/* 1. Header Banner & Semester Filter Strip (Phong cách QES / Nếp Học) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
            Học kỳ hiện tại · Năm học 2025 - 2026
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground mt-0.5">
            Bảng điều khiển học tập
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Chào mừng bạn, <span className="font-semibold text-foreground">{user.name}</span>! Theo dõi lịch trình và các lớp học phần đang ghi danh.
          </p>
        </div>

        {/* Semester Selector Pills */}
        <div className="flex items-center rounded-2xl border border-border bg-muted/40 p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => setSemester('hk1')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              semester === 'hk1'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            2025-2026 — Học kỳ I
          </button>
          <button
            type="button"
            onClick={() => setSemester('hk2')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              semester === 'hk2'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            2025-2026 — Học kỳ II
          </button>
          <button
            type="button"
            onClick={() => setSemester('all')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              semester === 'all'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Tất cả
          </button>
        </div>
      </div>

      {/* 2. Main 2-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================
            CENTER COLUMN (8 / 12 Cols): Danh sách học phần dạng Row List
           ======================================================== */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* Search & Sort Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-card-border p-3 rounded-2xl shadow-2xs">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm lớp tín chỉ, môn học..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 h-9 bg-background/60 text-xs rounded-xl border-border/80"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">Sắp xếp:</span>
              <select
                value={sort}
                onChange={e => setSort(e.target.value as any)}
                className="h-9 rounded-xl border border-border/80 bg-background/60 px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="default">Mặc định</option>
                <option value="progress">Tiến độ giảm dần</option>
                <option value="title">Tên học phần (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Row List of Enrolled Courses */}
          <div className="space-y-3">
            {courses.length === 0 ? (
              <Card className="border-dashed border-border p-8 text-center bg-card">
                <BookOpen size={36} className="mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm font-semibold text-foreground">Không tìm thấy lớp học phần phù hợp</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Thử đổi từ khóa tìm kiếm hoặc đăng ký thêm khóa học mới trong danh mục.
                </p>
                <Link href="/courses">
                  <Button variant="outline" size="sm" className="mt-4 rounded-xl text-xs">
                    Xem danh mục khóa học
                  </Button>
                </Link>
              </Card>
            ) : (
              courses.map(course => {
                const courseCode = `HP-${String(course.id).padStart(4, '0')}`;
                const enrollDate = `15-05-2026`;

                return (
                  <Card
                    key={course.id}
                    className="overflow-hidden border-card-border hover:border-primary/40 transition-all duration-200 shadow-2xs hover:shadow-xs group bg-card"
                  >
                    <div className="flex flex-col sm:flex-row items-stretch">
                      {/* Course Thumbnail Box */}
                      <div className="relative sm:w-44 md:w-52 h-36 sm:h-auto shrink-0 overflow-hidden bg-muted flex items-center justify-center">
                        {course.coverImageUrl ? (
                          <img
                            src={course.coverImageUrl}
                            alt={course.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div
                            className="w-full h-full flex flex-col items-center justify-center p-3 text-center transition-transform duration-300 group-hover:scale-105"
                            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff' }}
                          >
                            <div className="grid h-10 w-10 place-items-center rounded-xl bg-black/10 backdrop-blur-xs mb-1.5 shadow-2xs">
                              <GraduationCap size={22} />
                            </div>
                            <span className="text-[10px] uppercase font-bold tracking-wider opacity-90">
                              {course.category}
                            </span>
                          </div>
                        )}

                        {/* Format Badge Overlay */}
                        <div className="absolute top-2 left-2">
                          <span className="rounded-md bg-black/60 backdrop-blur-xs px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-white">
                            {course.format || 'xAPI'}
                          </span>
                        </div>

                        {/* Level Overlay */}
                        <div className="absolute bottom-2 left-2">
                          <span className="rounded-md bg-background/80 backdrop-blur-xs px-2 py-0.5 text-[10px] font-medium text-foreground">
                            {course.level}
                          </span>
                        </div>
                      </div>

                      {/* Course Details (Main Body) */}
                      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between min-w-0">
                        <div>
                          {/* Row: Title & Link */}
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <Link
                                href={`/courses/${course.id}`}
                                className="font-display text-base font-bold text-foreground hover:text-primary transition-colors line-clamp-1 group-hover:underline underline-offset-2"
                              >
                                {course.title}
                              </Link>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {course.description}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className="shrink-0 text-[10px] font-medium border-border/80 text-muted-foreground"
                            >
                              Đang học
                            </Badge>
                          </div>

                          {/* Row: Metadata Pills */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/50 text-[11px] text-muted-foreground">
                            <div>
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 block">
                                Mã lớp tín chỉ
                              </span>
                              <span className="font-mono font-semibold text-foreground">{courseCode}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 block">
                                Ngày ghi danh
                              </span>
                              <span className="font-medium text-foreground">{enrollDate}</span>
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 block">
                                Bài giảng & Thời lượng
                              </span>
                              <span className="font-medium text-foreground">
                                {course.lessons} bài · {course.duration || '2 giờ'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Row: Progress Bar & Action CTA Buttons */}
                        <div className="mt-4 pt-3 border-t border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Progress */}
                          <div className="flex-1 max-w-xs">
                            <div className="flex items-center justify-between text-xs mb-1.5">
                              <span className="text-[11px] text-muted-foreground">Tiến độ hoàn thành:</span>
                              <span className="font-mono font-bold text-primary">{course.progress}%</span>
                            </div>
                            <Progress value={course.progress} className="h-1.5" />
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                            <Link href={`/courses/${course.id}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-xl text-xs gap-1.5 border-border hover:bg-muted cursor-pointer"
                              >
                                <BookOpen size={13} />
                                <span>Đề cương & Tài liệu</span>
                              </Button>
                            </Link>
                            <Link href={`/learn?courseId=${course.id}`}>
                              <Button
                                size="sm"
                                className="h-8 rounded-xl text-xs gap-1.5 shadow-2xs cursor-pointer"
                              >
                                <Play size={13} fill="currentColor" />
                                <span>Vào bàn học trực tuyến</span>
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================
            RIGHT COLUMN (4 / 12 Cols): "Lịch học" + "Bảng xếp hạng"
           ======================================================== */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          {/* COMPONENT 1: Lịch học trực tuyến sắp tới (dữ liệu thật từ các khóa đã ghi danh) */}
          <UpcomingSessionsWidget
            title="Lịch học sắp tới"
            emptyText="Chưa có buổi học trực tuyến nào sắp tới trong các khóa học của bạn."
          />

          {/* COMPONENT 2: "Bảng xếp hạng" (Ranking Component - Skeleton State as requested) */}
          <Card className="overflow-hidden border-card-border shadow-2xs">
            <CardContent className="p-4 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/15 text-amber-600">
                    <Trophy size={16} />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-foreground">Bảng xếp hạng</h3>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center rounded-xl border border-border bg-muted/40 p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setRankingTab('class')}
                    className={`rounded-lg px-2.5 py-1 font-semibold transition-colors cursor-pointer ${
                      rankingTab === 'class'
                        ? 'bg-background text-foreground shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Theo lớp tín chỉ
                  </button>
                  <button
                    type="button"
                    onClick={() => setRankingTab('course')}
                    className={`rounded-lg px-2.5 py-1 font-semibold transition-colors cursor-pointer ${
                      rankingTab === 'course'
                        ? 'bg-background text-foreground shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Theo môn học
                  </button>
                </div>
              </div>

              {/* SKELETON STATE (Podium + Learner rows) */}
              <div className="space-y-4">
                {/* Podium Skeleton (Top 3) */}
                <div className="grid grid-cols-3 gap-2 items-end pt-3 pb-2 px-1">
                  {/* Rank 2 (Silver) */}
                  <div className="flex flex-col items-center">
                    <div className="h-10 w-10 rounded-full bg-muted animate-pulse mb-1.5" />
                    <div className="h-3 w-14 bg-muted/80 rounded animate-pulse mb-1" />
                    <div className="h-2 w-8 bg-muted/50 rounded animate-pulse mb-2" />
                    <div className="w-full h-14 bg-slate-200/80 dark:bg-slate-800/80 rounded-t-xl flex items-center justify-center font-mono font-bold text-xs text-muted-foreground">
                      2
                    </div>
                  </div>

                  {/* Rank 1 (Gold - Center & Taller) */}
                  <div className="flex flex-col items-center">
                    <div className="h-12 w-12 rounded-full bg-amber-500/20 border-2 border-amber-500/40 animate-pulse mb-1.5 relative flex items-center justify-center">
                      <Sparkles size={16} className="text-amber-500/70" />
                    </div>
                    <div className="h-3.5 w-16 bg-muted rounded animate-pulse mb-1" />
                    <div className="h-2.5 w-10 bg-amber-500/30 rounded animate-pulse mb-2" />
                    <div className="w-full h-20 bg-amber-500/15 border-t border-x border-amber-500/30 rounded-t-xl flex items-center justify-center font-mono font-bold text-sm text-amber-600">
                      1 👑
                    </div>
                  </div>

                  {/* Rank 3 (Bronze) */}
                  <div className="flex flex-col items-center">
                    <div className="h-10 w-10 rounded-full bg-muted animate-pulse mb-1.5" />
                    <div className="h-3 w-14 bg-muted/80 rounded animate-pulse mb-1" />
                    <div className="h-2 w-8 bg-muted/50 rounded animate-pulse mb-2" />
                    <div className="w-full h-11 bg-slate-200/60 dark:bg-slate-800/60 rounded-t-xl flex items-center justify-center font-mono font-bold text-xs text-muted-foreground">
                      3
                    </div>
                  </div>
                </div>

                {/* Skeleton Rows (Ranks 4, 5, 6) */}
                <div className="space-y-2 pt-1 border-t border-border/50">
                  {[4, 5].map(rank => (
                    <div
                      key={rank}
                      className="flex items-center justify-between p-2 rounded-xl bg-muted/20 animate-pulse"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-bold text-muted-foreground/60 w-4 text-center">
                          {rank}
                        </span>
                        <div className="h-7 w-7 rounded-full bg-muted" />
                        <div className="space-y-1">
                          <div className="h-3 w-20 bg-muted rounded" />
                          <div className="h-2 w-12 bg-muted/60 rounded" />
                        </div>
                      </div>
                      <div className="h-3 w-10 bg-muted/70 rounded" />
                    </div>
                  ))}
                </div>

                <div className="text-center pt-1">
                  <span className="text-[10px] text-muted-foreground/70 italic">
                    Đang đồng bộ số liệu bảng xếp hạng học kỳ...
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
