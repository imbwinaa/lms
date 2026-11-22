import { useEffect, useState } from 'react';
import { Copy, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Field, Notice } from '@/components/common';
import { getErrorMessage, useResetLmsAccountPassword, type Learner } from '@/api';

export interface ResetPasswordDialogProps {
  account: Learner | null;
  onClose: () => void;
  onReset?: (message: string) => void;
}

// Bỏ các ký tự dễ nhầm (0/O, 1/l/I)
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generatePassword(length = 12) {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('');
}

/** Quản trị viên đặt mật khẩu mới; mọi phiên đăng nhập cũ của tài khoản bị thu hồi */
export function ResetPasswordDialog({ account, onClose, onReset }: ResetPasswordDialogProps) {
  const reset = useResetLmsAccountPassword();
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(true);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (account) {
      setPassword(generatePassword());
      setVisible(true);
      setCopied(false);
      setMessage('');
    }
  }, [account]);

  if (!account) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard bị chặn: người dùng tự sao chép */
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    if (password.length < 8) {
      setMessage('Mật khẩu mới cần tối thiểu 8 ký tự.');
      return;
    }
    try {
      const result = await reset.mutateAsync({ id: account.id, data: { password } });
      onReset?.(result.message);
      onClose();
    } catch (err) {
      setMessage(getErrorMessage(err, 'Chưa thể đặt lại mật khẩu.'));
    }
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="block w-[calc(100%-2rem)] max-w-md rounded-2xl bg-card shadow-2xl">
        <div className="border-b border-border pb-4 pr-8">
          <DialogTitle className="font-display text-lg font-bold leading-tight tracking-normal">Đặt lại mật khẩu</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {account.name} · {account.email}
          </p>
        </div>

        {message && (
          <div className="mt-4">
            <Notice message={message} error />
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <Field label="Mật khẩu mới (≥ 8 ký tự)" required>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={visible ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="pr-9 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setVisible(v => !v)}
                  aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  {visible ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => setPassword(generatePassword())} title="Tạo mật khẩu ngẫu nhiên">
                <RefreshCw size={14} />
              </Button>
              <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={copy} title={copied ? 'Đã sao chép' : 'Sao chép'}>
                <Copy size={14} className={copied ? 'text-primary' : ''} />
              </Button>
            </div>
          </Field>
          <p className="rounded-lg bg-muted/50 p-3 text-[11px] leading-relaxed text-muted-foreground">
            Người dùng sẽ bị đăng xuất khỏi mọi thiết bị. Hãy gửi mật khẩu mới cho họ qua kênh an toàn.
          </p>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={reset.isPending}>
              Hủy
            </Button>
            <Button type="submit" disabled={reset.isPending}>
              {reset.isPending ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
