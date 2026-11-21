import { Download, ExternalLink, FileText, Paperclip } from 'lucide-react';
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
            <a
              key={m.id}
              href={m.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted/50"
            >
              <Paperclip size={13} className="text-muted-foreground" />
              <span className="flex-1 truncate font-medium">{m.fileName ?? m.title}</span>
              {m.fileSize && <span className="text-muted-foreground">{m.fileSize}</span>}
              <Download size={13} className="text-muted-foreground" />
            </a>
          ))}
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

function DocumentBlock({ url, title }: { url: string; title: string }) {
  const isPdf = /\.pdf($|\?)/i.test(url);
  return (
    <div className="space-y-2">
      {isPdf && (
        <iframe src={url} title={title} className="h-[70vh] w-full rounded-xl border border-border bg-muted" />
      )}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
        <FileText size={18} className="shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{fileName(url)}</span>
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          {isPdf ? <ExternalLink size={13} /> : <Download size={13} />} {isPdf ? 'Mở tab mới' : 'Tải về'}
        </a>
      </div>
    </div>
  );
}
