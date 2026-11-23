import { useState } from 'react';
import { Download, ExternalLink, Eye, FileText, Paperclip } from 'lucide-react';
import { FilePreviewDialog, type PreviewFile } from '@/components/preview/FilePreviewDialog';
import { FileViewer } from '@/components/preview/FileViewer';
import { canPreview } from '@/components/preview/fileKind';
import type { Lesson, Material } from '@/api';

/** Link YouTube/Vimeo -> URL nhúng; null nếu là tệp video thường */
export function videoEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url, window.location.origin);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = u.searchParams.get('v') ?? (u.pathname.startsWith('/embed/') ? u.pathname.split('/')[2] : null);
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

const fileName = (url: string) => decodeURIComponent(url.split('?')[0]!.split('/').pop() ?? url).replace(/^\d+-/, '');

/** Hiển thị nội dung bài học cho người học (video / bài đọc / tài liệu). Quiz dùng QuizPlayer. */
export function LessonViewer({ lesson, materials }: { lesson: Lesson; materials: Material[] }) {
  const [preview, setPreview] = useState<PreviewFile | null>(null);
  return (
    <div className="space-y-5">
      {lesson.type === 'video' && lesson.mediaUrl && <VideoBlock url={lesson.mediaUrl} title={lesson.title} />}
      {lesson.type === 'document' && lesson.mediaUrl && <DocumentBlock url={lesson.mediaUrl} title={lesson.title} />}

      {lesson.contentHtml ? (
        // HTML đã được máy chủ làm sạch (sanitize-html) khi giảng viên lưu bài
        <article
          className="prose prose-sm max-w-none dark:prose-invert sm:prose-base"
          dangerouslySetInnerHTML={{ __html: lesson.contentHtml }}
        />
      ) : (
        lesson.type === 'text' && <p className="text-sm text-muted-foreground">Bài đọc chưa có nội dung.</p>
      )}

      {materials.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Tệp đính kèm</p>
          {materials.map(m => (
            <div key={m.id} className="flex items-center gap-1 rounded-lg border border-border pr-1 text-xs hover:bg-muted/50">
              <button
                type="button"
                onClick={() =>
                  canPreview(m.fileUrl, m.fileName)
                    ? setPreview({ url: m.fileUrl, name: m.fileName ?? m.title })
                    : window.open(m.fileUrl, '_blank', 'noopener')
                }
                className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left"
                title="Xem trước"
              >
                <Paperclip size={13} className="shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate font-medium">{m.fileName ?? m.title}</span>
                {m.fileSize && <span className="text-muted-foreground">{m.fileSize}</span>}
                {canPreview(m.fileUrl, m.fileName) && <Eye size={13} className="text-muted-foreground" />}
              </button>
              <a
                href={m.fileUrl}
                download={m.fileName ?? true}
                className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Tải về"
              >
                <Download size={13} />
              </a>
            </div>
          ))}
          <FilePreviewDialog file={preview} onClose={() => setPreview(null)} />
        </div>
      )}
    </div>
  );
}

function VideoBlock({ url, title }: { url: string; title: string }) {
  const embed = videoEmbedUrl(url);
  return (
    <div className="aspect-video overflow-hidden rounded-xl bg-black">
      {embed ? (
        <iframe
          src={embed}
          title={title}
          className="h-full w-full"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <video src={url} controls className="h-full w-full" preload="metadata">
          Trình duyệt không phát được video này.
        </video>
      )}
    </div>
  );
}

function DocumentBlock({ url }: { url: string; title: string }) {
  // Xem ngay trong bài học: PDF, Word, Excel, ảnh, văn bản... (loại chưa hỗ trợ: nút tải về)
  return (
    <div className="space-y-2">
      {canPreview(url) && <FileViewer url={url} name={fileName(url)} className="h-[70vh]" />}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
        <FileText size={18} className="shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{fileName(url)}</span>
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          <ExternalLink size={13} /> Mở tab mới
        </a>
        <a href={url} download className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          <Download size={13} /> Tải về
        </a>
      </div>
    </div>
  );
}
