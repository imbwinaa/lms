import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { KeyRound, Lock, LockOpen, MoreHorizontal, Pencil, Plus, Search, Trash2, UserPlus, Users } from 'lucide-react';
import {
  getListLmsAccountsQueryKey,
  getListLmsCoursesQueryKey,
  invalidateLms,
  useDeleteLmsAccount,
  useListLmsAccounts,
  useListLmsCourses,
  useUpdateLmsAccountRole,
  useUpdateLmsAccountStatus,
  type Learner,
  type UserRole,
} from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Heading, QueryState, Avatar } from '@/components/common';
import {
  ConfirmDialog,
  CreateAccountDialog,
  EditAccountDialog,
  EnrollDialog,
  ResetPasswordDialog,
} from '@/components/dialogs';
import { useRole } from '@/contexts/RoleContext';
import { notify } from '@/lib/toast';

type Filter = 'all' | UserRole | 'locked';

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'student', label: 'Học viên' },
  { value: 'lecturer', label: 'Giảng viên' },
  { value: 'admin', label: 'Quản trị' },
  { value: 'locked', label: 'Đã khóa' },
];

type PendingConfirm = { kind: 'lock' | 'delete'; account: Learner } | null;

export default function Accounts() {
  const { role, user, canManageCourse } = useRole();
  const isAdmin = role === 'admin';
  const q = useListLmsAccounts({ query: { queryKey: getListLmsAccountsQueryKey() } });
  const c = useListLmsCourses({ query: { queryKey: getListLmsCoursesQueryKey() } });
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Learner | null>(null);
  const [resetting, setResetting] = useState<Learner | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm>(null);
  const updateRole = useUpdateLmsAccountRole();
  const updateStatus = useUpdateLmsAccountStatus();
  const deleteAccount = useDeleteLmsAccount();

  const accounts = q.data ?? [];
  // Chỉ ghi danh học viên đang hoạt động vào khóa học mình phụ trách (admin: mọi khóa)
  const enrollableCourses = (c.data ?? []).filter(course => canManageCourse(course));
  const students = accounts.filter(l => l.role === 'student' && l.status !== 'locked');

  const counts: Record<Filter, number> = {
    all: accounts.length,
    student: accounts.filter(a => a.role === 'student').length,
    lecturer: accounts.filter(a => a.role === 'lecturer').length,
    admin: accounts.filter(a => a.role === 'admin').length,
    locked: accounts.filter(a => a.status === 'locked').length,
  };

  const visible = accounts.filter(l => {
    if (filter === 'locked' ? l.status !== 'locked' : filter !== 'all' && l.role !== filter) return false;
    return `${l.name} ${l.email} ${l.team}`.toLowerCase().includes(search.toLowerCase());
  });

  const handleUpdateRole = async (account: Learner, newRole: UserRole) => {
    try {
      await updateRole.mutateAsync({ id: account.id, data: { role: newRole } });
      await invalidateLms(qc);
      notify.success(`Đã cập nhật vai trò của ${account.name}.`);
    } catch (err) {
      notify.error(err, 'Chưa thể đổi vai trò. Vui lòng thử lại.');
    }
  };

  const setStatus = async (account: Learner, status: 'active' | 'locked') => {
    try {
      await updateStatus.mutateAsync({ id: account.id, data: { status } });
      await invalidateLms(qc);
      if (status === 'locked') {
        notify.success(`Đã khóa tài khoản ${account.name}.`, 'Người dùng đã bị đăng xuất khỏi mọi thiết bị.');
      } else {
        notify.success(`Đã mở khóa tài khoản ${account.name}.`);
      }
    } catch (err) {
      notify.error(err, 'Chưa thể cập nhật trạng thái tài khoản.');
    } finally {
      setConfirm(null);
    }
  };

  const remove = async (account: Learner) => {
    try {
      const result = await deleteAccount.mutateAsync({ id: account.id });
      await invalidateLms(qc);
      notify.success(result.message);
    } catch (err) {
      notify.error(err, 'Chưa thể xóa tài khoản.');
    } finally {
      setConfirm(null);
    }
  };

  const eyebrow = role === 'lecturer' ? 'Tổ Sư Phạm · Theo dõi lớp' : 'Ban Giám Hiệu · Quản lý tài khoản';
  const title = role === 'lecturer' ? 'Sổ theo dõi học sinh' : 'Người dùng & Phân quyền';
  const description =
    role === 'lecturer'
      ? 'Theo dõi mức độ chuyên cần, bài tập và tiến độ của học sinh.'
      : 'Cấp tài khoản, phân quyền, sửa hồ sơ, đặt lại mật khẩu, khóa hoặc xóa tài khoản người dùng toàn trường.';

  const columns = isAdmin
    ? 'md:grid-cols-[1.5fr_1fr_1fr_0.9fr_130px_40px]'
    : 'md:grid-cols-[1.4fr_1fr_1fr_1fr_130px]';

  return (
    <div className="page-enter">
      <Heading
        eyebrow={eyebrow}
        title={title}
        description={description}
        action={
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <Button variant="outline" onClick={() => setCreateOpen(true)}>
                <UserPlus size={16} className="mr-2" />
                Cấp tài khoản mới
              </Button>
            )}
            <Button onClick={() => setEnrollOpen(true)} disabled={!students.length || !enrollableCourses.length}>
              <Plus size={16} className="mr-2" />
              Ghi danh học viên vào lớp
            </Button>
          </div>
        }
      />
      <Card className="mb-5 border-card-border shadow-2xs">
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary">
              <Users size={18} />
            </div>
            <div>
              <p className="font-display text-base font-bold">{visible.length} thành viên</p>
              <p className="text-[11px] text-muted-foreground">
                {isAdmin ? 'Học viên, Giảng viên và Quản lý' : 'Đang học tập tích cực'}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {isAdmin && (
              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Lọc tài khoản">
                {FILTERS.map(f => (
                  <button
                    key={f.value}
                    type="button"
                    role="tab"
                    aria-selected={filter === f.value}
                    onClick={() => setFilter(f.value)}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                      filter === f.value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {f.label} <span className="opacity-70">{counts[f.value]}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="relative w-full sm:w-[240px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên, email, lớp..." className="pl-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      <QueryState loading={q.isLoading} error={q.error} refetch={() => q.refetch()} empty={!!q.data && !q.data.length}>
        <div className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-2xs">
          <div
            className={`hidden gap-4 border-b border-border bg-muted/40 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground md:grid ${columns}`}
          >
            <span>Họ và tên</span>
            <span>Phòng ban / Lớp</span>
            <span>Khóa học hiện tại</span>
            <span>Hoạt động gần nhất</span>
            <span>{isAdmin ? 'Vai trò / Quyền' : 'Tiến độ'}</span>
            {isAdmin && <span className="sr-only">Thao tác</span>}
          </div>
          {!visible.length && (
            <p className="px-5 py-10 text-center text-xs text-muted-foreground">Không có tài khoản nào khớp bộ lọc.</p>
          )}
          {visible.map(l => {
            const isSelf = l.id === user.id;
            const locked = l.status === 'locked';
            return (
              <div
                key={l.id}
                className={`grid gap-3 border-b border-border px-4 py-3.5 last:border-0 hover:bg-muted/30 md:items-center md:gap-4 md:px-5 ${columns}`}
              >
                <div className={`flex items-center gap-3 ${locked ? 'opacity-60' : ''}`}>
                  <Avatar name={l.name} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-xs font-bold">
                      <span className="truncate">{l.name}</span>
                      {isSelf && (
                        <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-px text-[9px] font-semibold text-primary">Bạn</span>
                      )}
                      {locked && (
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-destructive/10 px-1.5 py-px text-[9px] font-semibold text-destructive">
                          <Lock size={9} /> Đã khóa
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">{l.email}</p>
                  </div>
                </div>
                <div className="text-xs">{l.team}</div>
                <div className="line-clamp-1 text-xs text-muted-foreground">{l.activeCourse || 'Chưa ghi danh'}</div>
                <div className="text-xs text-muted-foreground">{l.lastActive}</div>
                <div>
                  {isAdmin ? (
                    <select
                      value={l.role}
                      disabled={isSelf || updateRole.isPending}
                      title={isSelf ? 'Không thể tự đổi vai trò của chính mình' : undefined}
                      onChange={e => handleUpdateRole(l, e.target.value as UserRole)}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-[11px] font-medium"
                    >
                      <option value="student">🎓 Học viên</option>
                      <option value="lecturer">👨‍🏫 Giảng viên</option>
                      <option value="admin">⚙️ Quản trị</option>
                    </select>
                  ) : (
                    <div>
                      <div className="flex justify-between text-[10px]">
                        <span>Tiến độ</span>
                        <b>{l.progress}%</b>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(l.progress, 100)}%` }} />
                      </div>
                    </div>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Thao tác với ${l.name}`}
                          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-muted"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onSelect={() => setEditing(l)}>
                          <Pencil size={14} className="mr-2" /> Sửa thông tin
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setResetting(l)}>
                          <KeyRound size={14} className="mr-2" /> Đặt lại mật khẩu
                        </DropdownMenuItem>
                        {locked ? (
                          <DropdownMenuItem onSelect={() => setStatus(l, 'active')}>
                            <LockOpen size={14} className="mr-2" /> Mở khóa tài khoản
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem disabled={isSelf} onSelect={() => setConfirm({ kind: 'lock', account: l })}>
                            <Lock size={14} className="mr-2" /> Khóa tài khoản
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={isSelf}
                          onSelect={() => setConfirm({ kind: 'delete', account: l })}
                          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                        >
                          <Trash2 size={14} className="mr-2" /> Xóa tài khoản
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </QueryState>

      <EnrollDialog open={enrollOpen} onClose={() => setEnrollOpen(false)} learners={students} courses={enrollableCourses} />
      <CreateAccountDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={account => notify.success(`Đã cấp tài khoản cho ${account.name}.`, account.email)}
      />
      <EditAccountDialog
        account={editing}
        onClose={() => setEditing(null)}
        onSaved={account => notify.success(`Đã cập nhật thông tin của ${account.name}.`)}
      />
      <ResetPasswordDialog account={resetting} onClose={() => setResetting(null)} onReset={message => notify.success(message, 'Các phiên đăng nhập cũ đã bị thu hồi.')} />
      <ConfirmDialog
        open={confirm?.kind === 'lock'}
        title="Khóa tài khoản?"
        description={
          <>
            <b>{confirm?.account.name}</b> sẽ bị đăng xuất khỏi mọi thiết bị và không thể đăng nhập cho tới khi được mở khóa.
            Dữ liệu học tập vẫn được giữ nguyên.
          </>
        }
        confirmLabel="Khóa tài khoản"
        pendingLabel="Đang khóa..."
        destructive
        pending={updateStatus.isPending}
        onConfirm={() => confirm && setStatus(confirm.account, 'locked')}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === 'delete'}
        title="Xóa vĩnh viễn tài khoản?"
        description={
          <>
            Tài khoản <b>{confirm?.account.name}</b> cùng toàn bộ ghi danh, bài nộp, huy hiệu và phiên đăng nhập sẽ bị xóa.
            Thao tác này <b>không thể hoàn tác</b>. Nếu chỉ muốn tạm ngưng truy cập, hãy dùng “Khóa tài khoản”.
          </>
        }
        confirmLabel="Xóa vĩnh viễn"
        pendingLabel="Đang xóa..."
        destructive
        pending={deleteAccount.isPending}
        onConfirm={() => confirm && remove(confirm.account)}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
