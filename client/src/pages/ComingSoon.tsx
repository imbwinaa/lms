import { Construction } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

/** Trang tạm cho tính năng đang phát triển */
export default function ComingSoon() {
  return (
    <div className="page-enter grid min-h-[60vh] place-items-center">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <Construction size={26} />
        </div>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-[.2em] text-primary">Đang phát triển</p>
        <h1 className="mt-2 font-display text-2xl font-bold">Tính năng sắp ra mắt</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Trang này đang được hoàn thiện và tạm thời chưa mở. Vui lòng quay lại sau.
        </p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">Về bảng điều khiển</Link>
        </Button>
      </div>
    </div>
  );
}
