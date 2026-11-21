import { type ReactNode } from 'react';
import { Layers3, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError, getErrorMessage } from '@/api';

export function LoadingState() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-32 animate-pulse rounded-2xl border border-border bg-card/60" />
      ))}
    </div>
  );
}

export function QueryState({
  loading,
  error,
  refetch,
  empty,
  children,
}: {
  loading: boolean;
  error: unknown;
  refetch: () => void;
  empty?: boolean;
  children: ReactNode;
}) {
  if (loading) return <LoadingState />;
  if (error)
    return (
      <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center">
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-destructive/10 text-destructive">
          <RefreshCw size={18} />
        </div>
        <h3 className="font-display text-base font-bold">Chưa thể tải dữ liệu</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {error instanceof ApiError && error.status < 500
            ? getErrorMessage(error)
            : 'Vui lòng kiểm tra lại kết nối và thử lại nhé.'}
        </p>
        <Button onClick={refetch} variant="outline" size="sm" className="mt-4">
          <RefreshCw size={14} className="mr-2" />
          Thử lại
        </Button>
      </div>
    );
  if (empty)
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
          <Layers3 size={20} />
        </div>
        <h3 className="font-display text-base font-bold">Chưa có dữ liệu</h3>
        <p className="mt-1 text-xs text-muted-foreground">Nội dung sẽ tự động xuất hiện tại đây khi được thêm vào hệ thống.</p>
      </div>
    );
  return <>{children}</>;
}
