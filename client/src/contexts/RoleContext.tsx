import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { setAuthTokenGetter } from '@/api/custom-fetch';

export type UserRole = 'student' | 'lecturer' | 'admin';

export interface RoleUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  team: string;
  avatar: string;
  title: string;
  points?: number;
  streak?: number;
  progress?: number;
}

export interface SignupData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  team?: string;
}

export const ROLE_PROFILES: Record<UserRole, RoleUser> = {
  student: {
    id: 3,
    name: 'Ngann',
    email: 'ngann@nova.vn',
    role: 'student',
    team: 'Lớp 10A',
    avatar: 'NG',
    title: 'Học viên',
  },
  lecturer: {
    id: 2,
    name: 'Cô Bui Ngan',
    email: 'bui.ngan@nova.vn',
    role: 'lecturer',
    team: 'Tổ Sư Phạm & Đào Tạo',
    avatar: 'BN',
    title: 'Giảng viên phụ trách',
  },
  admin: {
    id: 1,
    name: 'Cô Ngân Bùi',
    email: 'ngan.bui@nova.vn',
    role: 'admin',
    team: 'Ban Giám Hiệu',
    avatar: 'NB',
    title: 'Quản trị viên hệ thống',
  },
};

interface RoleContextType {
  role: UserRole;
  user: RoleUser;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  canSwitchRole: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  signup: (data: SignupData) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  setRole: (role: UserRole) => void;
  switchRole: (role: UserRole) => Promise<void>;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

// Đăng ký token getter cho fetch client
setAuthTokenGetter(() => {
  return typeof window !== 'undefined' ? localStorage.getItem('lms_auth_token') : null;
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('lms_auth_token') : null;
  });

  const [activeUser, setActiveUser] = useState<RoleUser | null>(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('lms_user');
      if (savedUser) {
        try {
          return JSON.parse(savedUser) as RoleUser;
        } catch {}
      }
    }
    return null;
  });

  const [role, setRoleState] = useState<UserRole>(() => {
    if (activeUser) return activeUser.role;
    const savedRole = localStorage.getItem('lms_active_role') as UserRole;
    return savedRole && ['student', 'lecturer', 'admin'].includes(savedRole) ? savedRole : 'student';
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Đồng bộ phiên đăng nhập từ máy chủ qua GET /api/auth/me
  useEffect(() => {
    let isMounted = true;
    const verifyAuth = async () => {
      const currentToken = localStorage.getItem('lms_auth_token');
      if (!currentToken) {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${currentToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success && data.user) {
            setActiveUser(data.user);
            setRoleState(data.user.role);
            localStorage.setItem('lms_user', JSON.stringify(data.user));
            localStorage.setItem('lms_active_role', data.user.role);
          }
        } else {
          // Phiên hết hạn -> dọn dẹp
          if (isMounted) {
            setToken(null);
            setActiveUser(null);
            localStorage.removeItem('lms_auth_token');
            localStorage.removeItem('lms_user');
          }
        }
      } catch (err) {
        console.warn('Không thể kiểm tra phiên đăng nhập:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    verifyAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  // 1. Đăng nhập
  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, message: data.message || 'Đăng nhập không thành công.' };
      }

      setToken(data.token);
      setActiveUser(data.user);
      setRoleState(data.user.role);
      localStorage.setItem('lms_auth_token', data.token);
      localStorage.setItem('lms_user', JSON.stringify(data.user));
      localStorage.setItem('lms_active_role', data.user.role);
      if (data.user.role === 'admin') {
        localStorage.setItem('lms_admin_access', 'true');
      } else {
        localStorage.removeItem('lms_admin_access');
      }

      return { success: true, message: data.message };
    } catch {
      return { success: false, message: 'Lỗi kết nối máy chủ khi đăng nhập.' };
    }
  };

  // 2. Đăng ký
  const signup = async (data: SignupData) => {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        return { success: false, message: result.message || 'Đăng ký không thành công.' };
      }

      setToken(result.token);
      setActiveUser(result.user);
      setRoleState(result.user.role);
      localStorage.setItem('lms_auth_token', result.token);
      localStorage.setItem('lms_user', JSON.stringify(result.user));
      localStorage.setItem('lms_active_role', result.user.role);

      return { success: true, message: result.message };
    } catch {
      return { success: false, message: 'Lỗi kết nối máy chủ khi đăng ký.' };
    }
  };

  // 3. Đăng xuất
  const logout = async () => {
    const currentToken = token || localStorage.getItem('lms_auth_token');
    if (currentToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${currentToken}` },
        });
      } catch {}
    }
    setToken(null);
    setActiveUser(null);
    localStorage.removeItem('lms_auth_token');
    localStorage.removeItem('lms_user');
    localStorage.removeItem('lms_admin_access');
  };

  // 4. Chuyển đổi vai trò / Demo fast login
  const switchRole = async (newRole: UserRole) => {
    setRoleState(newRole);
    localStorage.setItem('lms_active_role', newRole);
    if (newRole === 'admin') {
      localStorage.setItem('lms_admin_access', 'true');
    }

    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          setToken(data.token);
          setActiveUser(data.user);
          localStorage.setItem('lms_auth_token', data.token);
          localStorage.setItem('lms_user', JSON.stringify(data.user));
          if (data.user.role === 'admin') {
            localStorage.setItem('lms_admin_access', 'true');
          }
          return;
        }
      }
    } catch {}

    // Fallback nếu không có kết nối
    const fallbackUser = ROLE_PROFILES[newRole];
    setActiveUser(fallbackUser);
    localStorage.setItem('lms_user', JSON.stringify(fallbackUser));
  };

  const setRole = (newRole: UserRole) => {
    void switchRole(newRole);
  };

  // Người dùng hiện tại (nếu có tài khoản đăng nhập thì dùng tài khoản đó, ngược lại fallback sang profile của role)
  const user: RoleUser = activeUser ?? ROLE_PROFILES[role];
  const isAuthenticated = Boolean(token && activeUser);
  const canSwitchRole = Boolean(
    role === 'admin' ||
    user.role === 'admin' ||
    (typeof window !== 'undefined' && localStorage.getItem('lms_admin_access') === 'true')
  );

  return (
    <RoleContext.Provider
      value={{
        role,
        user,
        token,
        isAuthenticated,
        isLoading,
        canSwitchRole,
        login,
        signup,
        logout,
        setRole,
        switchRole,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
