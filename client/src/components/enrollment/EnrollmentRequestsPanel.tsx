import { useQueryClient } from '@tanstack/react-query';
import { Check, UserPlus, X } from 'lucide-react';
import { formatDateTime, invalidateLms, useDecideEnrollmentRequest, useListEnrollmentRequests } from '@/api';
import { Avatar } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { notify } from '@/lib/toast';

/** Yêu cầu tham gia đang chờ duyệt (khóa "Cần duyệt") */
export function EnrollmentRequestsPanel({ courseId }: { courseId: number }) {
  const qc = useQueryClient();
  const requestsQuery = useListEnrollmentRequests(courseId);
  const decide = useDecideEnrollmentRequest();
  const requests = requestsQuery.data ?? [];

  if (requests.length === 0) return null;

  const act = (id: number, decision: 'approve' | 'reject', name: string) =>
    decide.mutate(
      { id, data: { decision } },
      {
        onSuccess: () => {
          void invalidateLms(qc);
          notify.success(decision === 'approve' ? 'Đã duyệt vào lớp' : 'Đã từ chối yêu cầu', name);
        },
        onError: e => notify.error(e),
      }
    );

  return (
    <Card className="border-amber-500/30 bg-amber-500/5 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <UserPlus size={16} className="text-amber-600" />
        <h3 className="font-display text-sm font-bold">Yêu cầu tham gia chờ duyệt ({requests.length})</h3>
      </div>
      <ul className="divide-y divide-border">
        {requests.map(r => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <Avatar name={r.learnerName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {r.learnerName} <span className="text-xs font-normal text-muted-foreground">· {r.learnerTeam}</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {r.learnerEmail} · gửi {formatDateTime(r.createdAt)}
              </p>
              {r.message && <p className="mt-1 text-xs italic text-foreground/80">“{r.message}”</p>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => act(r.id, 'reject', r.learnerName)}>
                <X size={14} className="mr-1" />
                Từ chối
              </Button>
              <Button size="sm" disabled={decide.isPending} onClick={() => act(r.id, 'approve', r.learnerName)}>
                <Check size={14} className="mr-1" />
                Duyệt
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
