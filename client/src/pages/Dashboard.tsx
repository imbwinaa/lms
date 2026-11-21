import { useRole } from '@/contexts/RoleContext';
import {
  StudentDashboardView,
  TeacherDashboardView,
  AdminDashboardView,
} from '@/components/dashboard';

export default function Dashboard() {
  const { role } = useRole();

  if (role === 'lecturer') {
    return <TeacherDashboardView />;
  }

  if (role === 'admin') {
    return <AdminDashboardView />;
  }

  return <StudentDashboardView />;
}
