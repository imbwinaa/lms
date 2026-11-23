import { useRoute, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Link2Off, Mail } from 'lucide-react';
import { invalidateLms, useAcceptInviteLink, useGetInviteLink } from '@/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { notify } from '@/lib/toast';

/** Trang mở liên kết mời: /invite/:token */
export default function InviteAccept() {
  const [, params] = useRoute('/invite/:token');
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const token = params?.token ?? '';
  const preview = useGetInviteLink(token, { query: { enabled: token.length > 0 } });
  const accept = useAcceptInviteLink();
  const data = preview.data;

  const goToCourse = (courseId: number) => setLocation(`/courses/${courseId}`);

  return (
    <div className="page-enter mx-auto max-w-lg py-10">
      <Card className="p-8 text-center shadow-sm">
        {preview.isLoading ? (
          <p className="text-sm text-muted-foreground">Đang kiểm tra liên kết mời...</p>
        ) : !data ? (
          <>
            <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
              <Link2Off size={26} />
            </div>
            <h1 className="font-display text-xl font-bold">Liên kết mời không tồn tại</h1>
            <p className="mt-1 text-sm text-muted-foreground">Hãy kiểm tra lại đường dẫn hoặc xin giảng viên một liên kết mới.</p>
            <Button className="mt-6" variant="outline" onClick={() => setLocation('/courses')}>
              Về danh mục khóa học
            </Button>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
              {data.alreadyEnrolled ? <CheckCircle2 size={26} /> : <Mail size={26} />}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Lời mời tham gia khóa học</p>
            <h1 className="mt-1 font-display text-2xl font-bold">{data.courseTitle}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Giảng viên: {data.instructorName}</p>
            {data.courseDescription && <p className="mt-4 text-sm text-foreground/80">{data.courseDescription}</p>}

            {data.alreadyEnrolled ? (
              <Button className="mt-6" onClick={() => goToCourse(data.courseId)}>
                Bạn đã tham gia — vào khóa học
              </Button>
            ) : data.valid ? (
              <Button
                className="mt-6"
                disabled={accept.isPending}
                onClick={() =>
                  accept.mutate(
                    { token },
                    {
                      onSuccess: result => {
                        void invalidateLms(qc);
                        notify.success('Đã tham gia khóa học', data.courseTitle);
                        goToCourse(result.courseId);
                      },
                      onError: e => {
                        notify.error(e);
                        void preview.refetch();
                      },
                    }
                  )
                }
              >
                {accept.isPending ? 'Đang tham gia...' : 'Chấp nhận lời mời'}
              </Button>
            ) : (
              <p className="mt-6 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{data.reason}</p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
