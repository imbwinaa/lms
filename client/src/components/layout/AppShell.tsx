import { type ReactNode, useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  Check,
  ChevronRight,
  Compass,
  FileBadge2,
  GraduationCap,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  MoreHorizontal,
  PanelLeft,
  Play,
  Settings2,
  ShieldCheck,
  Sun,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useRole, type UserRole } from '@/contexts/RoleContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getListLmsCoursesQueryKey, useListLmsCourses } from '@/api';

// Cấu hình menu riêng biệt cho từng vai trò
export const roleNavItems: Record<UserRole, Array<{ label: string; href: string; icon: typeof Users; group: string }>> = {
  student: [
    { label: 'Bảng điều khiển', href: '/dashboard', icon: LayoutDashboard, group: 'study' },
    { label: 'Bàn học cá nhân', href: '/learn', icon: Play, group: 'study' },
    { label: 'Danh mục khóa học', href: '/courses', icon: BookOpen, group: 'study' },
    { label: 'Lộ trình học tập', href: '/paths', icon: Compass, group: 'study' },
    { label: 'Chứng chỉ của tôi', href: '/certificates', icon: FileBadge2, group: 'achieve' },
    { label: 'Bảng vinh danh', href: '/leaderboard', icon: Trophy, group: 'achieve' },
    { label: 'Huy hiệu thành tích', href: '/gamification', icon: Award, group: 'achieve' },
  ],
  lecturer: [
    { label: 'Bảng điều khiển', href: '/dashboard', icon: LayoutDashboard, group: 'teaching' },
    { label: 'Danh mục khóa học', href: '/courses', icon: BookOpen, group: 'teaching' },
    { label: 'Sổ theo dõi học sinh', href: '/learners', icon: Users, group: 'teaching' },
    { label: 'Lộ trình bài giảng', href: '/paths', icon: Compass, group: 'teaching' },
    { label: 'Xem trước bài giảng', href: '/learn', icon: Play, group: 'review' },
    { label: 'Chứng chỉ lớp học', href: '/certificates', icon: FileBadge2, group: 'review' },
    { label: 'Thi đua của lớp', href: '/leaderboard', icon: Trophy, group: 'review' },
  ],
  admin: [
    { label: 'Phòng điều hành', href: '/dashboard', icon: LayoutDashboard, group: 'overview' },
    { label: 'Danh mục Khóa học', href: '/courses', icon: BookOpen, group: 'curriculum' },
    { label: 'Khung Lộ trình', href: '/paths', icon: Compass, group: 'curriculum' },
    { label: 'Người dùng & Phân quyền', href: '/learners', icon: Users, group: 'users' },
    { label: 'Sổ cấp Chứng chỉ', href: '/certificates', icon: FileBadge2, group: 'users' },
    { label: 'Bảng xếp hạng chung', href: '/leaderboard', icon: Trophy, group: 'insights' },
    { label: 'Thành tích & Huy hiệu', href: '/gamification', icon: Award, group: 'insights' },
    { label: 'Tích hợp e-Learning', href: '/plugins', icon: Settings2, group: 'system' },
    { label: 'Xem góc học sinh', href: '/learn', icon: Play, group: 'system' },
  ],
};

const groupLabels: Record<string, string> = {
  study: 'Góc học tập',
  achieve: 'Kết quả & Động lực',
  teaching: 'Nghiệp vụ giảng dạy',
  review: 'Kiểm tra & Ghi nhận',
  overview: 'Điều hành',
  curriculum: 'Chương trình học',
  users: 'Quản lý nhân sự',
  insights: 'Thống kê & Động lực',
  system: 'Hệ sinh thái',
};

export function AppShell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<'system' | 'light' | 'dark'>(() => {
    return (localStorage.getItem('lms-theme-mode') as any) || (localStorage.getItem('lms-theme') === 'dark' ? 'dark' : 'system');
  });
  const { role, user, switchRole, logout, canSwitchRole } = useRole();

  const coursesQuery = useListLmsCourses({ query: { queryKey: getListLmsCoursesQueryKey() } });
  const allCourses = coursesQuery.data ?? [];

  // Parse path for dynamic course title in breadcrumb
  const courseMatch = location.match(/^\/courses\/(\d+)$/);
  const courseId = courseMatch ? Number(courseMatch[1]) : null;
  const currentCourse = courseId ? allCourses.find(c => Number(c.id) === courseId) : null;

  const handleLogout = async () => {
    await logout();
    setLocation('/login');
  };

  const handleThemeChange = (mode: 'system' | 'light' | 'dark') => {
    setThemeMode(mode);
    localStorage.setItem('lms-theme-mode', mode);
    if (mode === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', isDark);
      localStorage.setItem('lms-theme', isDark ? 'dark' : 'light');
    } else {
      document.documentElement.classList.toggle('dark', mode === 'dark');
      localStorage.setItem('lms-theme', mode);
    }
  };

  useEffect(() => {
    if (themeMode === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', isDark);
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        document.documentElement.classList.toggle('dark', e.matches);
      };
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    } else {
      document.documentElement.classList.toggle('dark', themeMode === 'dark');
    }
  }, [themeMode]);

  useEffect(() => setMobileOpen(false), [location]);

  const navList = roleNavItems[role];
  const groups = Array.from(new Set(navList.map(i => i.group)));

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Sidebar bên trái */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[265px] flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out ${
          mobileOpen
            ? 'translate-x-0'
            : sidebarCollapsed
            ? '-translate-x-full md:-translate-x-full'
            : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex h-[76px] items-center gap-3 border-b border-sidebar-border px-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-xs">
            <GraduationCap size={22} />
          </div>
          <div>
            <div className="font-display text-[19px] font-extrabold leading-none tracking-tight">nếp học</div>
            <div className="mt-1 text-[10px] uppercase tracking-[.18em] text-sidebar-foreground/55">LMS Giáo dục</div>
          </div>
          <button
            className="ml-auto rounded-lg p-2 text-sidebar-foreground/70 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Đóng menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Danh sách mục Menu theo vai trò */}
        <div className="overflow-y-auto px-4 pt-4">
          {groups.map((group, index) => (
            <div key={group} className={index ? 'mt-6' : ''}>
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-sidebar-foreground/45">
                {groupLabels[group] ?? group}
              </p>
              <nav className="space-y-1">
                {navList
                  .filter(item => item.group === group)
                  .map(item => {
                    const active = location === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        data-testid={`link-nav-${item.href.replace('/', '') || 'root'}`}
                        className={`group flex items-center gap-3 rounded-xl px-3 py-[9px] text-[13px] font-medium transition-colors ${
                          active
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-2xs'
                            : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'
                        }`}
                      >
                        <item.icon size={17} strokeWidth={active ? 2.3 : 1.8} />
                        <span>{item.label}</span>
                        {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />}
                      </Link>
                    );
                  })}
              </nav>
            </div>
          ))}
        </div>

        {/* Vercel-like User Section with Popover */}
        <div className="mt-auto p-3 border-t border-sidebar-border">
          <Popover open={userMenuOpen} onOpenChange={setUserMenuOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-sidebar-accent/80 data-[state=open]:bg-sidebar-accent cursor-pointer group"
              >
                <div
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full font-bold text-xs shadow-2xs ${
                    role === 'admin'
                      ? 'bg-[#f4e4d8] text-[#ad5e3c]'
                      : role === 'lecturer'
                      ? 'bg-[#dce8f2] text-[#315779]'
                      : 'bg-[#dce9df] text-[#2c533c]'
                  }`}
                >
                  {user.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold leading-tight text-sidebar-foreground">{user.name}</p>
                  <p className="truncate text-[10px] text-sidebar-foreground/50">{user.email || user.title}</p>
                </div>
                <div className="grid h-7 w-7 place-items-center rounded-lg text-sidebar-foreground/50 group-hover:text-sidebar-foreground transition-colors">
                  <MoreHorizontal size={16} />
                </div>
              </button>
            </PopoverTrigger>

            <PopoverContent
              side="top"
              align="start"
              sideOffset={10}
              className="w-[245px] p-0 rounded-2xl border border-border/80 bg-popover/95 backdrop-blur-xl shadow-2xl text-popover-foreground overflow-hidden"
            >
              {/* Header: Name + Email + Settings */}
              <div className="flex items-start justify-between p-3.5 pb-2.5 border-b border-border/50">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-xs text-foreground">{user.name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{user.email || 'ngann@nova.vn'}</p>
                </div>
                <div className="text-muted-foreground/60 hover:text-foreground cursor-pointer">
                  <Settings2 size={14} />
                </div>
              </div>

              {/* Role Switcher Section (Only visible for Admins / Privileged Testers) */}
              {canSwitchRole && (
                <>
                  <div className="p-1.5">
                    <p className="px-2.5 pt-1.5 pb-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80">
                      Chuyển vai trò truy cập
                    </p>

                    {/* Role 1: Student */}
                    <button
                      type="button"
                      data-testid="role-switch-student"
                      onClick={() => {
                        switchRole('student');
                        setUserMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
                        role === 'student'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <GraduationCap size={14} className={role === 'student' ? 'text-emerald-500' : 'text-muted-foreground'} />
                        <div className="text-left">
                          <p className="leading-tight">Học viên</p>
                          <p className="text-[9px] text-muted-foreground opacity-80">(Ngann · Lớp 10A)</p>
                        </div>
                      </div>
                      {role === 'student' && <Check size={14} className="text-emerald-500 shrink-0" />}
                    </button>

                    {/* Role 2: Lecturer */}
                    <button
                      type="button"
                      data-testid="role-switch-lecturer"
                      onClick={() => {
                        switchRole('lecturer');
                        setUserMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors cursor-pointer mt-0.5 ${
                        role === 'lecturer'
                          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <BookOpen size={14} className={role === 'lecturer' ? 'text-blue-500' : 'text-muted-foreground'} />
                        <div className="text-left">
                          <p className="leading-tight">Giảng viên</p>
                          <p className="text-[9px] text-muted-foreground opacity-80">(Cô Bui Ngan · Tổ Sư Phạm)</p>
                        </div>
                      </div>
                      {role === 'lecturer' && <Check size={14} className="text-blue-500 shrink-0" />}
                    </button>

                    {/* Role 3: Admin */}
                    <button
                      type="button"
                      data-testid="role-switch-admin"
                      onClick={() => {
                        switchRole('admin');
                        setUserMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors cursor-pointer mt-0.5 ${
                        role === 'admin'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ShieldCheck size={14} className={role === 'admin' ? 'text-amber-500' : 'text-muted-foreground'} />
                        <div className="text-left">
                          <p className="leading-tight">Quản trị viên</p>
                          <p className="text-[9px] text-muted-foreground opacity-80">(Cô Ngân Bùi · Ban Giám Hiệu)</p>
                        </div>
                      </div>
                      {role === 'admin' && <Check size={14} className="text-amber-500 shrink-0" />}
                    </button>
                  </div>

                  <div className="border-t border-border/50 my-1" />
                </>
              )}

              {/* Quick Actions & Vercel Style Items */}
              <div className="p-1.5 space-y-1">
                {/* Theme Selector (Pill toggle like Vercel) */}
                <div className="flex items-center justify-between px-2.5 py-1 text-xs text-muted-foreground">
                  <span className="text-[11px] font-medium">Giao diện</span>
                  <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
                    <button
                      type="button"
                      onClick={() => handleThemeChange('system')}
                      className={`rounded-md p-1 transition-colors ${
                        themeMode === 'system' ? 'bg-background text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title="Theo hệ thống"
                    >
                      <Monitor size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleThemeChange('light')}
                      className={`rounded-md p-1 transition-colors ${
                        themeMode === 'light' ? 'bg-background text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title="Sáng"
                    >
                      <Sun size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleThemeChange('dark')}
                      className={`rounded-md p-1 transition-colors ${
                        themeMode === 'dark' ? 'bg-background text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                      }`}
                      title="Tối"
                    >
                      <Moon size={12} />
                    </button>
                  </div>
                </div>

                {/* Home Page Link */}
                <Link
                  href="/"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Home size={14} />
                  <span>Trang chủ LMS</span>
                </Link>

                {/* Logout Button */}
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors text-left cursor-pointer"
                >
                  <LogOut size={14} />
                  <span>Đăng xuất</span>
                </button>
              </div>

              {/* Status Footer: All systems normal (like Vercel) */}
              <div className="flex items-center justify-between border-t border-border/50 bg-muted/30 px-3.5 py-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-2 font-medium">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  Hệ thống hoạt động tốt
                </span>
                <span className="text-[9px] font-mono opacity-70">v1.0.0</span>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </aside>

      {mobileOpen && (
        <button
          aria-label="Đóng điều hướng"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/35 md:hidden"
        />
      )}

      {/* Vùng nội dung chính */}
      <div
        className={`min-h-[100dvh] transition-all duration-300 ease-in-out ${
          sidebarCollapsed ? 'md:pl-0' : 'md:pl-[265px]'
        }`}
      >
        {/* Header trên cùng gọn gàng, tinh tế */}
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border/70 bg-background/90 px-4 backdrop-blur-xl md:px-8">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Nút đóng/mở sidebar (bên trái breadcrumb) */}
            <button
              type="button"
              onClick={() => {
                if (window.innerWidth < 768) {
                  setMobileOpen(!mobileOpen);
                } else {
                  setSidebarCollapsed(!sidebarCollapsed);
                }
              }}
              aria-label="Đóng/Mở thanh điều hướng"
              title={sidebarCollapsed ? 'Mở thanh điều hướng' : 'Thu gọn thanh điều hướng'}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <PanelLeft size={18} />
            </button>

            {/* Header Breadcrumb */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 overflow-hidden">
              <Link href="/dashboard" className="hover:text-foreground transition-colors font-medium shrink-0">
                Nếp học
              </Link>
              <ChevronRight size={13} className="shrink-0 text-muted-foreground/60" />

              {courseId && currentCourse ? (
                <>
                  <Link href="/courses" className="hover:text-foreground transition-colors shrink-0">
                    Danh mục khóa học
                  </Link>
                  <ChevronRight size={13} className="shrink-0 text-muted-foreground/60" />
                  <span className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-xs md:max-w-md">
                    {currentCourse.title}
                  </span>
                </>
              ) : location === '/courses' ? (
                <span className="font-semibold text-foreground">Danh mục khóa học</span>
              ) : location === '/dashboard' || location === '/' ? (
                <span className="font-semibold text-foreground">Bảng điều khiển</span>
              ) : location === '/learn' ? (
                <span className="font-semibold text-foreground">Bàn học trực tuyến</span>
              ) : location === '/learners' ? (
                <span className="font-semibold text-foreground">Sổ theo dõi học sinh</span>
              ) : location === '/paths' ? (
                <span className="font-semibold text-foreground">Lộ trình bài giảng</span>
              ) : location === '/certificates' ? (
                <span className="font-semibold text-foreground">Sổ cấp chứng chỉ</span>
              ) : location === '/leaderboard' ? (
                <span className="font-semibold text-foreground">Bảng vinh danh</span>
              ) : location === '/gamification' ? (
                <span className="font-semibold text-foreground">Huy hiệu thành tích</span>
              ) : location === '/plugins' ? (
                <span className="font-semibold text-foreground">Tích hợp e-Learning</span>
              ) : (
                <span className="font-semibold text-foreground">
                  {role === 'student' ? 'Góc Học Viên' : role === 'lecturer' ? 'Lớp Học Phụ Trách' : 'Khu Vực Quản Trị'}
                </span>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 ml-3">
            {/* Huy hiệu vai trò tối giản trên Header */}
            <div
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold shadow-2xs ${
                role === 'admin'
                  ? 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : role === 'lecturer'
                  ? 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              <span>{role === 'student' ? 'Học viên (Ngann)' : role === 'lecturer' ? 'Cô Bui Ngan' : 'Ban Giám Hiệu'}</span>
            </div>
          </div>
        </header>

        {/* Nội dung trang */}
        <main className="mx-auto max-w-[1440px] px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
