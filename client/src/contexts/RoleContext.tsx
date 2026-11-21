import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setAuthTokenGetter } from '@/api/custom-fetch';
import {
  demoLogin as demoLoginRequest,
  getAuthConfig,
  getCurrentUser,
  getErrorMessage,
  login as loginRequest,
  logout as logoutRequest,
  type AuthUser,
  type Course,
} from '@/api';

export type UserRole = 'student' | 'lecturer' | 'admin';
export type RoleUser = AuthUser;

const TOKEN_KEY = 'lms_auth_token';
const USER_KEY = 'lms_user';
/** Sự kiện phát ra khi API trả 401 (xem App.tsx) */
export const UNAUTHORIZED_EVENT = 'lms:unauthorized';

/** Hồ sơ rỗng khi chưa đăng nhập — không mang quyền gì, chỉ để giao diện không bị lỗi */
const GUEST_USER: RoleUser = {
  id: 0,
  name: 'Khách',
  email: '',
  role: 'student',
  team: '',
  avatar: '?',
  title: 'Chưa đăng nhập',
  points: 0,
  streak: 0,
  progress: 0,
  activeCourse: '',
};

interface RoleContextType {
  role: UserRole;
  user: RoleUser;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Chỉ bật khi máy chủ cho phép đăng nhập demo (ENABLE_DEMO_LOGIN=true) */
  canSwitchRole: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  switchRole: (role: UserRole) => Promise<{ success: boolean; message?: string }>;
  /** Giảng viên phụ trách hoặc admin */
  canManageCourse: (course: Pick<Course, 'instructorId'> | null | undefined) => boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // trình duyệt chặn localStorage -> phiên chỉ tồn tại trong bộ nhớ
  }
}

// Gắn Bearer token cho mọi request đi qua customFetch (các hook sinh tự động)
setAuthTokenGetter(() => readStorage(TOKEN_KEY));

export function RoleProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => readStorage(TOKEN_KEY));
  const [user, setUser] = useState<RoleUser | null>(() => {
    const saved = readStorage(USER_KEY);
    if (!saved) return null;
    try {
      return JSON.parse(saved) as RoleUser;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(readStorage(TOKEN_KEY)));
  const [demoLoginEnabled, setDemoLoginEnabled] = useState(false);

  const applySession = useCallback(
    (nextToken: string | null, nextUser: RoleUser | null) => {
      writeStorage(TOKEN_KEY, nextToken);
      writeStorage(USER_KEY, nextUser ? JSON.stringify(nextUser) : null);
      setToken(nextToken);
      setUser(nextUser);
      // Dữ liệu cũ thuộc về người dùng trước -> xóa cache
      queryClient.removeQueries({ predicate: q => String(q.queryKey[0]).startsWith('/api/lms') || String(q.queryKey[0]).startsWith('/api/upload') });
    },
    [queryClient],
  );

  // Kiểm tra phiên với máy chủ khi tải trang
  useEffect(() => {
    let active = true;
    getAuthConfig()
      .then(cfg => active && setDemoLoginEnabled(cfg.demoLoginEnabled))
      .catch(() => {});

    if (!readStorage(TOKEN_KEY)) {
      setIsLoading(false);
      return;
    }
    getCurrentUser()
      .then(me => {
        if (!active) return;
        setUser(me);
        writeStorage(USER_KEY, JSON.stringify(me));
      })
      .catch(() => {
        // 401 được xử lý bởi UNAUTHORIZED_EVENT; lỗi mạng -> giữ phiên đã lưu
      })
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // Bất kỳ API nào trả 401 -> phiên hết hạn
  useEffect(() => {
    const onUnauthorized = () => {
      if (readStorage(TOKEN_KEY)) applySession(null, null);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [applySession]);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const session = await loginRequest({ email, password });
        applySession(session.token, session.user);
        return { success: true, message: session.message };
      } catch (error) {
        return { success: false, message: getErrorMessage(error, 'Đăng nhập không thành công.') };
      }
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    if (readStorage(TOKEN_KEY)) {
      try {
        await logoutRequest();
      } catch {
        // bỏ qua: phiên có thể đã hết hạn
      }
    }
    applySession(null, null);
  }, [applySession]);

  const switchRole = useCallback(
    async (role: UserRole) => {
      if (!demoLoginEnabled) return { success: false, message: 'Đăng nhập demo đang tắt.' };
      try {
        const session = await demoLoginRequest({ role });
        applySession(session.token, session.user);
        return { success: true, message: session.message };
      } catch (error) {
        return { success: false, message: getErrorMessage(error, 'Không thể đăng nhập demo.') };
      }
    },
    [applySession, demoLoginEnabled],
  );

  const value = useMemo<RoleContextType>(() => {
    const current = user ?? GUEST_USER;
    return {
      role: current.role,
      user: current,
      token,
      isAuthenticated: Boolean(token && user),
      isLoading,
      canSwitchRole: demoLoginEnabled,
      login,
      logout,
      switchRole,
      canManageCourse: course =>
        Boolean(user && course && (user.role === 'admin' || (user.role === 'lecturer' && course.instructorId === user.id))),
    };
  }, [user, token, isLoading, demoLoginEnabled, login, logout, switchRole]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) throw new Error('useRole must be used within a RoleProvider');
  return context;
}

/** Ẩn/hiện nội dung theo vai trò */
export function RequireRole({ roles, children, fallback = null }: { roles: UserRole[]; children: ReactNode; fallback?: ReactNode }) {
  const { role, isAuthenticated } = useRole();
  return <>{isAuthenticated && roles.includes(role) ? children : fallback}</>;
}
