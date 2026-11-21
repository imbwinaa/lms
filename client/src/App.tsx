import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RoleProvider } from '@/contexts/RoleContext';
import { AppShell } from '@/components/layout';
import {
  Dashboard,
  Courses,
  CourseDetail,
  Learners,
  Paths,
  Certificates,
  Leaderboard,
  Gamification,
  LearningPortal,
  Plugins,
  Login,
  Signup,
  NotFound,
} from '@/pages';

const queryClient = new QueryClient();

function Router() {
  const [location] = useLocation();

  return (
    <ErrorBoundary resetKey={location}>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route>
          <AppShell>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/courses/:id" component={CourseDetail} />
              <Route path="/courses" component={Courses} />
              <Route path="/learners" component={Learners} />
              <Route path="/paths" component={Paths} />
              <Route path="/certificates" component={Certificates} />
              <Route path="/leaderboard" component={Leaderboard} />
              <Route path="/gamification" component={Gamification} />
              <Route path="/plugins" component={Plugins} />
              <Route path="/learn" component={LearningPortal} />
              <Route component={NotFound} />
            </Switch>
          </AppShell>
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
