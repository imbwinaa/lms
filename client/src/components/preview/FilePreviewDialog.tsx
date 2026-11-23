import { useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileViewer } from './FileViewer';
import { canPreview, displayName } from './fileKind';
import { cn } from '@/lib/utils';

export type PreviewFile = { url: string; name?: string | null };

/** Hộp thoại xem trước tệp, không cần tải về */
export function FilePreviewDialog({ file, onClose }: { file: PreviewFile | null; onClose: () => void }) {
  if (!file) return null;
  const name = displayName(file.url, file.name);
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="flex max-h-[95dvh] w-[calc(100%-1rem)] max-w-5xl flex-col gap-3 rounded-2xl bg-card p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center gap-2 pr-8">
          <DialogTitle className="min-w-0 flex-1 truncate text-base font-bold tracking-normal">{name}</DialogTitle>
          <Button size="sm" variant="ghost" asChild>
            <a href={file.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} className="mr-1" /> Tab mới
            </a>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={file.url} download={file.name ?? true}>
              <Download size={14} className="mr-1" /> Tải về
            </a>
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <FileViewer url={file.url} name={file.name} className="h-[75dvh]" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Liên kết tệp: bấm để xem trước (loại chưa hỗ trợ: mở tab mới) */
export function PreviewLink({
  url,
  name,
  className,
  children,
}: {
  url: string;
  name?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!canPreview(url, name)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn('text-left', className)} title="Xem trước">
        {children}
      </button>
      <FilePreviewDialog file={open ? { url, name } : null} onClose={() => setOpen(false)} />
    </>
  );
}
