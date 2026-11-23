import type { ComponentType } from 'react';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ApiError } from '@/api';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RoleProvider, UNAUTHORIZED_EVENT, useRole, type UserRole } from '@/contexts/RoleContext';
import { AppShell } from '@/components/layout';
import {
  Dashboard,
  Courses,
  CourseDetail,
  Accounts,
  Paths,
  Certificates,
  Leaderboard,
  Gamification,
  LearningPortal,
  Plugins,
  Login,
  NotFound,
  ComingSoon,
  InviteAccept,
} from '@/pages';
import { isWipPath } from '@/lib/features';
import CourseStudio from '@/pages/CourseStudio';

// 401 từ bất kỳ request nào -> phát sự kiện để RoleProvider đăng xuất
function notifyUnauthorized(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: notifyUnauthorized }),
  mutationCache: new MutationCache({ onError: notifyUnauthorized }),
  defaultOptions: {
    queries: {
      // Không thử lại với lỗi phía client (401/403/404...)
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2,
      staleTime: 15_000,
    },
  },
});

const ALL_ROLES: UserRole[] = ['student', 'lecturer', 'admin'];

/** Quyền truy cập từng trang (khớp với menu trong AppShell) */
const appRoutes: Array<{ path: string; component: ComponentType; roles: UserRole[] }> = [
  { path: '/', component: Dashboard, roles: ALL_ROLES },
  { path: '/dashboard', component: Dashboard, roles: ALL_ROLES },
  { path: '/courses/:id/studio', component: CourseStudio, roles: ['lecturer', 'admin'] },
  { path: '/courses/:id', component: CourseDetail, roles: ALL_ROLES },
  { path: '/courses', component: Courses, roles: ALL_ROLES },
  { path: '/accounts', component: Accounts, roles: ['lecturer', 'admin'] },
  { path: '/paths', component: Paths, roles: ALL_ROLES },
  { path: '/certificates', component: Certificates, roles: ALL_ROLES },
  { path: '/leaderboard', component: Leaderboard, roles: ALL_ROLES },
  { path: '/gamification', component: Gamification, roles: ALL_ROLES },
  { path: '/plugins', component: Plugins, roles: ['admin'] },
  { path: '/learn', component: LearningPortal, roles: ALL_ROLES },
  { path: '/invite/:token', component: InviteAccept, roles: ALL_ROLES },
];

function FullPageSpinner() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-background text-sm text-muted-foreground">
      Đang kiểm tra phiên đăng nhập...
    </div>
  );
}

function ProtectedApp() {
  const { isAuthenticated, isLoading, role } = useRole();
  const [location] = useLocation();

  if (isLoading) return <FullPageSpinner />;
  if (!isAuthenticated) {
    const next = location && location !== '/' ? `?next=${encodeURIComponent(location)}` : '';
    return <Redirect to={`/login${next}`} replace />;
  }

  return (
    <AppShell>
      <Switch>
        {appRoutes.map(({ path, component: Page, roles }) => (
          <Route key={path} path={path}>
            {!roles.includes(role) ? (
              <Redirect to="/dashboard" replace />
            ) : isWipPath(path) ? (
              <ComingSoon />
            ) : (
              <Page />
            )}
          </Route>
        ))}
        {/* Đường dẫn cũ, giữ để không làm hỏng bookmark */}
        <Route path="/learners">
          <Redirect to="/accounts" replace />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function LoginRoute() {
  const { isAuthenticated, isLoading } = useRole();
  if (isLoading) return <FullPageSpinner />;
  if (isAuthenticated) {
    const next = new URLSearchParams(window.location.search).get('next');
    return <Redirect to={next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'} replace />;
  }
  return <Login />;
}

function Router() {
  const [location] = useLocation();

  return (
    <ErrorBoundary resetKey={location}>
      <Switch>
        <Route path="/login" component={LoginRoute} />
        <Route path="/signup">
          <Redirect to="/login" replace />
        </Route>
        <Route>
          <ProtectedApp />
        </Route>
      </Switch>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RoleProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </RoleProvider>
    </QueryClientProvider>
  );
}
