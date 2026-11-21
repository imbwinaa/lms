import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, Notice } from '@/components/common';
import { getErrorMessage, invalidateLms, useCreateLmsLearner, type Learner, type UserRole } from '@/api';

export interface CreateAccountDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (account: Learner) => void;
}

/** Quản trị viên cấp tài khoản mới (thay cho tự đăng ký công khai) */
export function CreateAccountDialog({ open, onClose, onCreated }: CreateAccountDialogProps) {
  const queryClient = useQueryClient();
  const createAccount = useCreateLmsLearner();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [team, setTeam] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    if (password.length < 8) {
      setMessage('Mật khẩu khởi tạo cần tối thiểu 8 ký tự.');
      return;
    }
    try {
      const created = await createAccount.mutateAsync({
        data: { name: name.trim(), email: email.trim(), role, team: team.trim() || undefined, password },
      });
      await invalidateLms(queryClient);
      onCreated?.(created);
      setName('');
      setEmail('');
      setTeam('');
      setPassword('');
      setRole('student');
      onClose();
    } catch (err) {
      setMessage(getErrorMessage(err, 'Chưa thể tạo tài khoản.'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in-0 zoom-in-95">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h3 className="font-display text-lg font-bold">Cấp tài khoản mới</h3>
            <p className="text-xs text-muted-foreground">Gửi email và mật khẩu khởi tạo cho người dùng sau khi tạo.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {message && (
          <div className="mt-4">
            <Notice message={message} error />
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <Field label="Họ và tên *">
            <Input value={name} onChange={e => setName(e.target.value)} required minLength={2} placeholder="VD: Nguyễn Văn An" />
          </Field>
          <Field label="Email *">
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="an.nguyen@nova.vn" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vai trò">
              <select
                value={role}
                onChange={e => setRole(e.target.value as UserRole)}
                className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm font-medium"
              >
                <option value="student">🎓 Học viên</option>
                <option value="lecturer">👨‍🏫 Giảng viên</option>
                <option value="admin">⚙️ Quản trị</option>
              </select>
            </Field>
            <Field label="Lớp / Phòng ban">
              <Input value={team} onChange={e => setTeam(e.target.value)} placeholder="VD: Lớp 10A" />
            </Field>
          </div>
          <Field label="Mật khẩu khởi tạo * (≥ 8 ký tự)">
            <Input
              type="text"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </Field>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={createAccount.isPending}>
              Hủy
            </Button>
            <Button type="submit" disabled={createAccount.isPending}>
              {createAccount.isPending ? 'Đang tạo...' : 'Tạo tài khoản'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
