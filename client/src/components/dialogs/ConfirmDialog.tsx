import type { ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/** Hộp xác nhận dùng chung cho các thao tác khó hoàn tác (khóa, xóa...) */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pendingLabel,
  destructive,
  pending,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={o => !o && !pending && onClose()}>
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl bg-card shadow-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-lg font-bold">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-xs leading-relaxed">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={pending}>Hủy</AlertDialogCancel>
          <Button variant={destructive ? 'destructive' : 'default'} disabled={pending} onClick={onConfirm}>
            {pending ? pendingLabel ?? 'Đang xử lý...' : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
