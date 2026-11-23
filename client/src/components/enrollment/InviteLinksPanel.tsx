import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Copy, Link2, Plus, Trash2 } from 'lucide-react';
import { formatDateTime, invalidateLms, useCreateCourseInvite, useListCourseInvites, useRevokeCourseInvite } from '@/api';
import type { CourseInvite } from '@/api';
import { Field } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { notify } from '@/lib/toast';

const EXPIRY_OPTIONS = [
  { value: '1', label: '1 ngày' },
  { value: '7', label: '7 ngày' },
  { value: '30', label: '30 ngày' },
  { value: 'custom', label: 'Chọn ngày...' },
  { value: 'never', label: 'Không hết hạn' },
];

export function inviteUrl(token: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${window.location.origin}${base}/invite/${token}`;
}

function statusOf(invite: CourseInvite): { label: string; tone: string } {
  if (invite.revoked) return { label: 'Đã thu hồi', tone: 'bg-muted text-muted-foreground' };
  if (invite.active) return { label: 'Đang hoạt động', tone: 'bg-emerald-500/10 text-emerald-600' };
  if (invite.maxUses !== null && invite.uses >= invite.maxUses) return { label: 'Hết lượt', tone: 'bg-muted text-muted-foreground' };
  return { label: 'Hết hạn', tone: 'bg-muted text-muted-foreground' };
}

/** Liên kết mời: có hạn dùng và giới hạn lượt; dùng được cho khóa riêng tư */
export function InviteLinksPanel({ courseId, isPrivate }: { courseId: number; isPrivate: boolean }) {
  const qc = useQueryClient();
  const invitesQuery = useListCourseInvites(courseId);
  const create = useCreateCourseInvite();
  const revoke = useRevokeCourseInvite();
  const [creating, setCreating] = useState(false);
  const [expiry, setExpiry] = useState('7');
  const [customDate, setCustomDate] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const invites = invitesQuery.data ?? [];

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      notify.success('Đã sao chép liên kết mời');
    } catch {
      notify.info('Liên kết mời', inviteUrl(token));
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    let expiresAt: string | null = null;
    if (expiry === 'custom') {
      if (!customDate) {
        notify.warning('Hãy chọn ngày hết hạn.');
        return;
      }
      expiresAt = new Date(`${customDate}T23:59:59`).toISOString();
    } else if (expiry !== 'never') {
      expiresAt = new Date(Date.now() + Number(expiry) * 86_400_000).toISOString();
    }
    const uses = maxUses.trim() ? Number(maxUses) : null;
    create.mutate(
      { id: courseId, data: { expiresAt, maxUses: uses } },
      {
        onSuccess: invite => {
          void invalidateLms(qc);
          setCreating(false);
          setMaxUses('');
          void copy(invite.token);
        },
        onError: err => notify.error(err),
      }
    );
  };

  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <Card className="p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Link2 size={16} className="text-primary" />
            <h3 className="font-display text-sm font-bold">Liên kết mời</h3>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isPrivate
              ? 'Khóa riêng tư: học viên chỉ tham gia được qua liên kết mời hoặc do bạn ghi danh.'
              : 'Học viên mở liên kết sẽ vào lớp ngay, không cần duyệt.'}
          </p>
        </div>
        {!creating && (
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <Plus size={14} className="mr-1" />
            Tạo liên kết
          </Button>
        )}
      </div>

      {creating && (
        <form onSubmit={submit} className="mt-3 grid gap-3 rounded-xl bg-muted/50 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Hết hạn sau">
            <select
              value={expiry}
              onChange={e => setExpiry(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              {EXPIRY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {expiry === 'custom' && (
              <Input type="date" min={minDate} className="mt-2" value={customDate} onChange={e => setCustomDate(e.target.value)} />
            )}
          </Field>
          <Field label="Số lượt tối đa">
            <Input
              type="number"
              min={1}
              max={1000}
              value={maxUses}
              onChange={e => setMaxUses(e.target.value)}
              placeholder="Không giới hạn"
            />
          </Field>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Đang tạo...' : 'Tạo & sao chép'}
            </Button>
          </div>
        </form>
      )}

      {invites.length > 0 && (
        <ul className="mt-3 divide-y divide-border">
          {invites.map(invite => {
            const status = statusOf(invite);
            return (
              <li key={invite.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-foreground/90">{inviteUrl(invite.token)}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Đã dùng {invite.uses}
                    {invite.maxUses !== null ? `/${invite.maxUses}` : ''} lượt ·{' '}
                    {invite.expiresAt ? `hết hạn ${formatDateTime(invite.expiresAt)}` : 'không hết hạn'}
                  </p>
                </div>
                <Badge variant="outline" className={`border-0 text-[10px] ${status.tone}`}>
                  {status.label}
                </Badge>
                {invite.active && (
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="size-8" title="Sao chép" onClick={() => void copy(invite.token)}>
                      <Copy size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-destructive hover:text-destructive"
                      title="Thu hồi"
                      disabled={revoke.isPending}
                      onClick={() =>
                        revoke.mutate(
                          { id: invite.id },
                          {
                            onSuccess: () => {
                              void invalidateLms(qc);
                              notify.info('Đã thu hồi liên kết mời.');
                            },
                            onError: e => notify.error(e),
                          }
                        )
                      }
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
