import { useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileBadge2,
  GraduationCap,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Video,
  ArrowUpRight,
} from 'lucide-react';
import { Link } from 'wouter';
import {
  getListLmsCoursesQueryKey,
  useListLmsCourses,
} from '@/api';
import type { Course } from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useRole } from '@/contexts/RoleContext';
import { CourseDialog } from '@/components/dialogs';
import { CourseCover } from '@/components/studio/CourseCover';

export function AdminDashboardView() {
  const { user } = useRole();
  const coursesQuery = useListLmsCourses({ query: { queryKey: getListLmsCoursesQueryKey() } });

  const [search, setSearch] = useState('');
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | undefined>(undefined);

  const rawCourses = coursesQuery.data ?? [];

  const filteredCourses = useMemo(() => {
    return rawCourses.filter(c =>
      `${c.title} ${c.category} ${c.description}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [rawCourses, search]);

  return (
    <div className="page-enter space-y-6">
      {/* 1. Admin Header & Quick Creation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Ban Giám Hiệu & Quản Trị Hệ Thống
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground mt-0.5">
            Phòng điều hành LMS
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Tổng quan hoạt động đào tạo số, phân quyền nhân sự, kiểm chuẩn chương trình học và tài nguyên toàn trường.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setEditingCourse(undefined);
              setCourseDialogOpen(true);
            }}
            className="rounded-xl text-xs font-semibold gap-1.5 shadow-2xs cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus size={15} />
            <span>Thêm khóa học mới</span>
          </Button>
        </div>
      </div>

      {/* 2. Admin Key Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-card-border bg-card shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Tổng số học viên
              </p>
              <h3 className="font-display text-2xl font-extrabold text-foreground mt-1">
                48 <span className="text-xs font-normal text-muted-foreground">người</span>
              </h3>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                ● 100% tài khoản kích hoạt
              </p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
              <Users size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-card-border bg-card shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Tổng số khóa học
              </p>
              <h3 className="font-display text-2xl font-extrabold text-foreground mt-1">
                {rawCourses.length} <span className="text-xs font-normal text-muted-foreground">khóa</span>
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Chuẩn SCORM & xAPI
              </p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
              <BookOpen size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-card-border bg-card shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Tỷ lệ hoàn thành
              </p>
              <h3 className="font-display text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                88.4%
              </h3>
              <p className="text-[10px] text-emerald-600/80 font-medium mt-0.5">
                +4.2% so với tháng trước
              </p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <TrendingUp size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-card-border bg-card shadow-2xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Lượt truy cập hôm nay
              </p>
              <h3 className="font-display text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
                142
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Tải hệ thống: Bình thường
              </p>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <ShieldCheck size={20} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Danh mục khóa học & Kiểm soát chất lượng */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          <Card className="overflow-hidden border-card-border shadow-2xs">
            <CardContent className="p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                <div>
                  <h2 className="font-display text-base font-bold text-foreground">
                    Kiểm duyệt chương trình đào tạo
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    Quản lý định dạng gói học liệu (SCORM, xAPI, H5P) và phân công giảng viên
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Tìm tên môn hoặc định dạng..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9 h-8 bg-background/60 text-xs rounded-xl"
                  />
                </div>
              </div>

              {/* Course Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/60 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                      <th className="py-2.5 px-3">Khóa học</th>
                      <th className="py-2.5 px-3">Phân loại</th>
                      <th className="py-2.5 px-3">Định dạng</th>
                      <th className="py-2.5 px-3">Tiến độ TB</th>
                      <th className="py-2.5 px-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredCourses.map(course => (
                      <tr key={course.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3">
                            <CourseCover course={course} className="hidden h-9 w-16 shrink-0 rounded-md 2xl:block [&_svg]:size-4" />
                            <div className="min-w-0">
                              <Link
                                href={`/courses/${course.id}`}
                                className="font-semibold text-foreground hover:text-primary transition-colors block line-clamp-1"
                              >
                                {course.title}
                              </Link>
                              <span className="text-[10px] text-muted-foreground">
                                {course.lessons} bài học · {course.duration || '2 giờ'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant="outline" className="text-[10px] font-medium border-border/70">
                            {course.category}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                            {course.format || 'xAPI'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <Progress value={course.progress} className="h-1.5 w-16" />
                            <span className="font-mono text-[11px] font-medium">{course.progress}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingCourse(course);
                                setCourseDialogOpen(true);
                              }}
                              className="h-7 px-2 text-[11px] rounded-lg cursor-pointer"
                            >
                              Sửa
                            </Button>
                            <Link href={`/courses/${course.id}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-[11px] rounded-lg gap-1 cursor-pointer"
                              >
                                <span>Xem</span>
                                <ArrowUpRight size={11} />
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (4 cols): Quản lý nhanh & Hoạt động hệ thống */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          {/* Quick Access Card */}
          <Card className="overflow-hidden border-card-border shadow-2xs">
            <CardContent className="p-4 space-y-3">
              <h3 className="font-display text-sm font-bold text-foreground border-b border-border/60 pb-2">
                Nghiệp vụ quản trị nhanh
              </h3>
              <div className="grid grid-cols-1 gap-2 pt-1">
                <Link
                  href="/accounts"
                  className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/50 transition-colors text-xs font-semibold text-foreground"
                >
                  <div className="flex items-center gap-2">
                    <Users size={15} className="text-blue-500" />
                    <span>Quản lý học viên & Phân quyền</span>
                  </div>
                  <ChevronRight size={13} className="text-muted-foreground" />
                </Link>

                {/* Sổ chứng chỉ đang phát triển (xem lib/features.ts) */}
                <div
                  aria-disabled="true"
                  title="Tính năng đang phát triển"
                  className="flex cursor-not-allowed items-center justify-between p-2.5 rounded-xl border border-dashed border-border/60 text-xs font-semibold text-muted-foreground/70"
                >
                  <div className="flex items-center gap-2">
                    <FileBadge2 size={15} className="opacity-60" />
                    <span>Sổ cấp phát chứng chỉ số</span>
                  </div>
                  <span className="rounded-full border border-border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide">
                    Sắp có
                  </span>
                </div>

                <Link
                  href="/paths"
                  className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/50 transition-colors text-xs font-semibold text-foreground"
                >
                  <div className="flex items-center gap-2">
                    <BookOpen size={15} className="text-purple-500" />
                    <span>Lộ trình đào tạo chuẩn khung</span>
                  </div>
                  <ChevronRight size={13} className="text-muted-foreground" />
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* System Audit Log Feed */}
          <Card className="overflow-hidden border-card-border shadow-2xs">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <h3 className="font-display text-sm font-bold text-foreground">
                  Nhật ký an toàn hệ thống
                </h3>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              </div>

              <div className="space-y-2.5 text-xs pt-1">
                <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                  <p className="font-semibold text-foreground">Đồng bộ Cloudflare R2 Bucket</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Bucket: lms-ngan · 15 tệp video/pdf sẵn sàng</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                  <p className="font-semibold text-foreground">Chứng chỉ SSL & Supabase Pooler</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Kết nối an toàn TLS 1.3 · Singapore region</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
                  <p className="font-semibold text-foreground">Đăng nhập tài khoản quản trị</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Cô Ngân Bùi (Ban Giám Hiệu) · Phiên hoạt động</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Course Edit/Create Dialog */}
      <CourseDialog
        open={courseDialogOpen}
        course={editingCourse}
        onClose={() => setCourseDialogOpen(false)}
      />
    </div>
  );
}
