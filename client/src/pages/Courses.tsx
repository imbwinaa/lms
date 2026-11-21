import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Clock3,
  Globe2,
  ListChecks,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Users,
  Filter,
} from 'lucide-react';
import { Link } from 'wouter';
import { getListLmsCoursesQueryKey, useListLmsCourses } from '@/api';
import type { Course } from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Heading, QueryState, accentBackgrounds } from '@/components/common';
import { CourseDialog } from '@/components/dialogs';
import { useRole } from '@/contexts/RoleContext';

export default function Courses() {
  const { role } = useRole();
  const q = useListLmsCourses({ query: { queryKey: getListLmsCoursesQueryKey() } });

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<Course | undefined>();

  const allCourses = q.data ?? [];

  // Lấy danh sách các danh mục độc nhất
  const categories = useMemo(() => {
    const set = new Set<string>();
    allCourses.forEach(c => {
      if (c.category) set.add(c.category);
    });
    return Array.from(set);
  }, [allCourses]);

  // Bộ lọc khóa học
  const courses = useMemo(() => {
    return allCourses.filter(c => {
      const matchSearch = `${c.title} ${c.category} ${c.description}`
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchCat = selectedCategory === 'all' || c.category === selectedCategory;
      const matchFormat = selectedFormat === 'all' || c.format === selectedFormat;
      return matchSearch && matchCat && matchFormat;
    });
  }, [allCourses, search, selectedCategory, selectedFormat]);

  return (
    <div className="page-enter space-y-6">
      <Heading
        eyebrow="Chương trình Đào tạo · Công khai (Public)"
        title="Danh mục Khóa học Toàn trường"
        description="Tất cả khóa học đang mở của nhà trường. Chọn một khóa học để xem đề cương và bắt đầu học."
        action={
          role !== 'student' && (
            <Button
              onClick={() => {
                setEditing(undefined);
                setDialog(true);
              }}
            >
              <Plus size={16} className="mr-2" />
              Soạn khóa học mới
            </Button>
          )
        }
      />

      {/* Filter and Search Bar */}
      <div className="space-y-3">
        {/* Category Pills Filter */}
        <div className="flex flex-wrap items-center gap-1.5 pb-1">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            Tất cả ({allCourses.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search & Format Selector */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Hiển thị <b>{courses.length}</b> khóa học công khai
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-[260px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm kiếm môn học..."
                className="pl-9 h-9 text-xs"
              />
            </div>

            <select
              value={selectedFormat}
              onChange={e => setSelectedFormat(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="all">Tất cả định dạng</option>
              <option value="xAPI">Định dạng xAPI</option>
              <option value="SCORM 1.2">Định dạng SCORM 1.2</option>
              <option value="H5P">Định dạng H5P</option>
              <option value="Native">Định dạng Native</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid of Public Courses */}
      <QueryState loading={q.isLoading} error={q.error} refetch={() => q.refetch()} empty={courses.length === 0}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course, i) => (
            <Card
              key={course.id}
              data-testid={`card-course-${course.id}`}
              className="group overflow-hidden border-card-border shadow-2xs transition hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40 flex flex-col justify-between"
            >
              <div>
                <Link
                  href={`/courses/${course.id}`}
                  className="relative h-[120px] overflow-hidden block cursor-pointer"
                  style={{ background: accentBackgrounds[course.accent] ?? (i % 2 ? '#d6e2d8' : '#ead9c9') }}
                >
                  {course.coverImageUrl ? (
                    <img
                      src={course.coverImageUrl}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute -right-3 -top-8 h-32 w-32 rounded-full border-[20px] border-white/20 transition-transform group-hover:scale-105" />
                  )}

                  {/* Public visibility tag & Category */}
                  <div className="absolute bottom-3 left-4 flex items-center gap-2">
                    <span className="rounded-full bg-white/80 dark:bg-black/60 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-900 dark:text-white backdrop-blur-xs flex items-center gap-1">
                      <Globe2 size={10} className="text-emerald-500" />
                      Công khai
                    </span>
                    <span className="rounded-full bg-white/70 dark:bg-black/40 px-2 py-0.5 text-[9px] font-medium text-slate-800 dark:text-white/90">
                      {course.category}
                    </span>
                  </div>

                  {/* Format badge */}
                  <span className="absolute right-3 top-3 rounded-md bg-white/75 dark:bg-black/50 px-2 py-0.5 text-[9px] font-bold tracking-[.1em] text-slate-800 dark:text-white backdrop-blur-xs">
                    {course.format}
                  </span>
                </Link>

                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/courses/${course.id}`} className="hover:text-primary transition-colors">
                        <h2 className="font-display text-[16px] font-bold leading-snug">{course.title}</h2>
                      </Link>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Giảng viên:{' '}
                        <span className="font-semibold text-foreground">
                          {(course as any).instructor_name || (course as any).instructorName || 'Cô Bui Ngan'}
                        </span>
                      </p>
                    </div>
                    {role !== 'student' && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setEditing(course);
                          setDialog(true);
                        }}
                        aria-label={`Sửa ${course.title}`}
                        className="shrink-0 rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                      >
                        <Settings2 size={14} />
                      </button>
                    )}
                  </div>

                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {course.description}
                  </p>

                  <div className="mt-4 flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ListChecks size={13} />
                      {course.lessons} bài giảng
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock3 size={13} />
                      {course.duration}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={13} />
                      {course.enrolled} học viên
                    </span>
                  </div>
                </CardContent>
              </div>

              {/* Card Footer */}
              <div className="px-5 pb-5 pt-0">
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] text-emerald-600 bg-emerald-500/10 border-0">
                      {course.status}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{course.level}</span>
                  </div>

                  <Link
                    href={`/courses/${course.id}`}
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                  >
                    Xem chi tiết <ArrowUpRight size={12} />
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </QueryState>

      <CourseDialog open={dialog} course={editing} onClose={() => setDialog(false)} />
    </div>
  );
}
