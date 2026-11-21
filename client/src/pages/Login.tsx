import { useState } from 'react';
import {
  BookOpen,
  GraduationCap,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Notice, Field } from '@/components/common';
import { useRole, type UserRole } from '@/contexts/RoleContext';

export default function Login() {
  // Chuyển trang sau khi đăng nhập do LoginRoute (App.tsx) đảm nhận
  const { login, switchRole, canSwitchRole } = useRole();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const res = await login(email, password);
    setLoading(false);

    if (!res.success) {
      setErrorMsg(res.message || 'Email hoặc mật khẩu không chính xác.');
    }
  };

  const handleDemoQuickLogin = async (role: UserRole) => {
    setErrorMsg('');
    setLoading(true);
    const res = await switchRole(role);
    setLoading(false);
    if (!res.success) setErrorMsg(res.message || 'Không thể đăng nhập demo.');
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/20 px-4 py-8">
      <div className="w-full max-w-[460px] space-y-6">
        {/* Brand Header */}
        <div className="text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <GraduationCap size={30} />
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">nếp học</h1>
          <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
            Hệ sinh thái LMS Giáo dục
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-card-border shadow-lg">
          <CardContent className="p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="font-display text-xl font-bold">Đăng nhập tài khoản</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Nhập thông tin tài khoản của bạn để vào không gian học tập.
              </p>
            </div>

            {errorMsg && <Notice message={errorMsg} error onClose={() => setErrorMsg('')} />}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Địa chỉ Email" required>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="ngann@nova.vn"
                    className="pl-9"
                  />
                </div>
              </Field>

              <Field label="Mật khẩu" required>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••"
                    className="pl-9 pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>

              {canSwitchRole && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Mật khẩu mặc định demo: <code className="font-mono font-bold text-foreground">123456</code></span>
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full font-semibold">
                {loading ? 'Đang xác thực...' : 'Đăng nhập'}
              </Button>
            </form>

            {/* Khối Đăng nhập nhanh Demo cho 3 vai trò (chỉ khi máy chủ bật ENABLE_DEMO_LOGIN) */}
            {canSwitchRole && (
            <div className="mt-6 border-t border-border pt-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Sparkles size={13} className="text-amber-500" />
                  Đăng nhập nhanh theo vai trò (Demo)
                </span>
              </div>

              <div className="grid gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleDemoQuickLogin('student')}
                  className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-2.5 text-left text-xs transition hover:bg-emerald-500/10"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-600 text-white">
                      <GraduationCap size={15} />
                    </span>
                    <div>
                      <p className="font-bold text-emerald-950 dark:text-emerald-100">Học viên: Ngann</p>
                      <p className="text-[10px] text-muted-foreground">Bàn học cá nhân, bài tập H5P, Quiz</p>
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-emerald-600" />
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleDemoQuickLogin('lecturer')}
                  className="flex items-center justify-between rounded-xl border border-blue-500/30 bg-blue-500/5 px-3.5 py-2.5 text-left text-xs transition hover:bg-blue-500/10"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600 text-white">
                      <BookOpen size={15} />
                    </span>
                    <div>
                      <p className="font-bold text-blue-950 dark:text-blue-100">Giảng viên: Cô Bui Ngan</p>
                      <p className="text-[10px] text-muted-foreground">Soạn bài giảng, sổ theo dõi học sinh</p>
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-blue-600" />
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleDemoQuickLogin('admin')}
                  className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/5 px-3.5 py-2.5 text-left text-xs transition hover:bg-amber-500/10"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-600 text-white">
                      <ShieldCheck size={15} />
                    </span>
                    <div>
                      <p className="font-bold text-amber-950 dark:text-amber-100">Quản trị viên: Cô Ngân Bùi</p>
                      <p className="text-[10px] text-muted-foreground">Phòng điều hành BGH, phân quyền, chuẩn mở</p>
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-amber-600" />
                </button>
              </div>
            </div>
            )}

            <div className="mt-6 text-center text-xs text-muted-foreground">
              Chưa có tài khoản? Vui lòng liên hệ quản trị viên nhà trường để được cấp tài khoản.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
