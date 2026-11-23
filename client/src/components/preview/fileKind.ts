export type FileKind =
  | 'pdf'
  | 'image'
  | 'video'
  | 'audio'
  | 'text'
  | 'csv'
  | 'docx'
  | 'xlsx'
  /** PowerPoint, Word/Excel đời cũ, OpenDocument: chỉ xem được qua Office Online */
  | 'office'
  | 'unknown';

const EXT: Record<string, FileKind> = {
  pdf: 'pdf',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image', avif: 'image', bmp: 'image',
  mp4: 'video', webm: 'video', mov: 'video', m4v: 'video', ogv: 'video',
  mp3: 'audio', wav: 'audio', m4a: 'audio', aac: 'audio', oga: 'audio', ogg: 'audio', flac: 'audio',
  txt: 'text', md: 'text', json: 'text', log: 'text',
  csv: 'csv',
  docx: 'docx',
  xlsx: 'xlsx',
  pptx: 'office', ppt: 'office', doc: 'office', xls: 'office', odt: 'office', ods: 'office', odp: 'office',
};

function extensionOf(value: string | null | undefined): string {
  if (!value) return '';
  const clean = value.split(/[?#]/)[0] ?? '';
  const last = clean.split('/').pop() ?? '';
  const dot = last.lastIndexOf('.');
  return dot >= 0 ? last.slice(dot + 1).toLowerCase() : '';
}

/** Loại tệp theo tên tệp (ưu tiên) hoặc đuôi URL */
export function fileKind(url: string, name?: string | null): FileKind {
  return EXT[extensionOf(name)] ?? EXT[extensionOf(url)] ?? 'unknown';
}

/** Có xem trước ngay trong ứng dụng được không */
export const canPreview = (url: string, name?: string | null) => fileKind(url, name) !== 'unknown';

/** Tên hiển thị: tên tệp hoặc phần cuối URL (bỏ tiền tố thời gian của tệp tải lên) */
export function displayName(url: string, name?: string | null): string {
  if (name) return name;
  const last = decodeURIComponent((url.split(/[?#]/)[0] ?? '').split('/').pop() ?? '');
  return last.replace(/^\d{10,}-/, '') || 'Tệp';
}

/** URL tuyệt đối truy cập được từ Internet (Office Online cần tải tệp từ máy chủ của Microsoft) */
export function publicAbsoluteUrl(url: string): string | null {
  try {
    const absolute = new URL(url, window.location.origin);
    const host = absolute.hostname;
    const isLocal =
      host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.local') || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(host);
    return isLocal || absolute.protocol !== 'https:' ? null : absolute.toString();
  } catch {
    return null;
  }
}
