import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Certificate } from '@/api';

export type CertificateModalProps = {
  certificate: Certificate | null;
  onClose: () => void;
};

export function CertificateModal({ certificate, onClose }: CertificateModalProps) {
  if (!certificate) return null;

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="block w-[calc(100%-2rem)] max-w-lg rounded-3xl border-4 border-amber-500/30 bg-card p-8 text-center shadow-2xl"
      >
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/15 text-amber-600">
          <Award size={28} />
        </div>
        <p className="mt-3 text-[10px] font-bold uppercase tracking-[.25em] text-primary">Nếp học · Chứng nhận hoàn tất</p>
        <DialogTitle className="mt-2 font-display text-2xl font-extrabold leading-tight tracking-normal">{certificate.course}</DialogTitle>
        <p className="mt-2 text-xs text-muted-foreground">Chứng nhận học viên:</p>
        <p className="mt-1 font-display text-xl font-bold text-foreground">{certificate.learner}</p>
        <p className="mt-2 text-xs text-muted-foreground">Đã hoàn thành 100% nội dung và vượt qua bài kiểm tra năng lực.</p>
        <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-left text-[11px] text-muted-foreground">
          <div>
            <p className="font-mono font-bold text-foreground">{certificate.serial}</p>
            <p>Ngày cấp: {certificate.issuedAt}</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-emerald-600">Đã xác thực điện tử</p>
            <p>Ban Giám Hiệu Nova</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Đóng
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            In chứng chỉ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
