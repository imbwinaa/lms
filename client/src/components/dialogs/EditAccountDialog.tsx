import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Field, Notice } from '@/components/common';
import { getErrorMessage, invalidateLms, useUpdateLmsAccount, type Learner } from '@/api';

export interface EditAccountDialogProps {
  account: Learner | null;
  onClose: () => void;
  onSaved?: (account: Learner) => void;
}

/** Quản trị viên sửa họ tên, email, lớp / phòng ban của một tài khoản */
export function EditAccountDialog({ account, onClose, onSaved }: EditAccountDialogProps) {
  const queryClient = useQueryClient();
  const update = useUpdateLmsAccount();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [team, setTeam] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (account) {
      setName(account.name);
      setEmail(account.email);
      setTeam(account.team);
      setMessage('');
    }
  }, [account]);

  if (!account) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    try {
      const saved = await update.mutateAsync({
        id: account.id,
        data: { name: name.trim(), email: email.trim(), team: team.trim() },
      });
      await invalidateLms(queryClient);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setMessage(getErrorMessage(err, 'Chưa thể cập nhật tài khoản.'));
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="block w-[calc(100%-2rem)] max-w-md rounded-2xl bg-card shadow-2xl">
        <div className="border-b border-border pb-4 pr-8">
          <DialogTitle className="font-display text-lg font-bold leading-tight tracking-normal">Sửa thông tin tài khoản</DialogTitle>
          <p className="text-xs text-muted-foreground">Cập nhật hồ sơ của {account.name}.</p>
        </div>

        {message && (
          <div className="mt-4">
            <Notice message={message} error />
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <Field label="Họ và tên" required>
            <Input value={name} onChange={e => setName(e.target.value)} required minLength={2} />
          </Field>
          <Field label="Email đăng nhập" required>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </Field>
          <Field label="Lớp / Phòng ban" required>
            <Input value={team} onChange={e => setTeam(e.target.value)} required />
          </Field>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={update.isPending}>
              Hủy
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
