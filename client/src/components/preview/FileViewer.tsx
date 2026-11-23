import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Download, ExternalLink, FileQuestion, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { displayName, fileKind, publicAbsoluteUrl, type FileKind } from './fileKind';

const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_TABLE_ROWS = 500;

async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

export type FileViewerProps = {
  url: string;
  name?: string | null;
  /** Chiều cao vùng xem cho PDF / Office / tài liệu dài */
  className?: string;
};

/** Xem trước tệp ngay trong trang: PDF, ảnh, video, âm thanh, văn bản, CSV, Word (.docx), Excel (.xlsx) */
export function FileViewer({ url, name, className = 'h-[70vh]' }: FileViewerProps) {
  const kind = fileKind(url, name);
  const title = displayName(url, name);

  switch (kind) {
    case 'pdf':
      return <iframe src={url} title={title} className={cn('w-full rounded-xl border border-border bg-muted', className)} />;
    case 'image':
      return (
        <div className={cn('grid place-items-center overflow-auto rounded-xl bg-muted/40 p-2', className)}>
          <img src={url} alt={title} className="max-h-full max-w-full object-contain" />
        </div>
      );
    case 'video':
      return (
        <video src={url} controls preload="metadata" className="max-h-[75vh] w-full rounded-xl bg-black">
          Trình duyệt không phát được video này.
        </video>
      );
    case 'audio':
      return <audio src={url} controls preload="metadata" className="w-full" />;
    case 'text':
    case 'csv':
    case 'docx':
    case 'xlsx':
      return <FetchedViewer url={url} kind={kind} className={className} />;
    case 'office':
      return <OfficeOnlineViewer url={url} title={title} className={className} />;
    default:
      return <Unsupported url={url} name={title} />;
  }
}

/** Các loại cần tải nội dung về trình duyệt để hiển thị */
function FetchedViewer({ url, kind, className }: { url: string; kind: FileKind; className: string }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; text?: string; sheets?: Sheet[] }>({
    status: 'loading',
  });
  const docxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    (async () => {
      const blob = await fetchBlob(url);
      if (kind === 'text') {
        const text = blob.size > MAX_TEXT_BYTES ? `${await blob.slice(0, MAX_TEXT_BYTES).text()}\n…` : await blob.text();
        if (!cancelled) setState({ status: 'ready', text });
      } else if (kind === 'csv') {
        const text = await blob.slice(0, MAX_TEXT_BYTES).text();
        if (!cancelled) setState({ status: 'ready', sheets: [{ sheet: 'CSV', rows: parseCsv(text) }] });
      } else if (kind === 'xlsx') {
        const { default: readXlsxFile } = await import('read-excel-file/browser');
        const sheets = await readXlsxFile(blob);
        if (!cancelled) {
          setState({
            status: 'ready',
            sheets: sheets.map(s => ({ sheet: s.sheet, rows: s.data.map(row => row.map(cellText)) })),
          });
        }
      } else if (kind === 'docx') {
        const { renderAsync } = await import('docx-preview');
        if (cancelled || !docxRef.current) return;
        docxRef.current.innerHTML = '';
        await renderAsync(blob, docxRef.current, undefined, {
          className: 'docx',
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          // Không hiển thị khối HTML nhúng trong tệp Word (an toàn)
          renderAltChunks: false,
          useBase64URL: true,
        });
        if (!cancelled) setState({ status: 'ready' });
      }
    })().catch(() => {
      if (!cancelled) setState({ status: 'error' });
    });
    return () => {
      cancelled = true;
    };
  }, [url, kind]);

  if (state.status === 'error') {
    return <Unsupported url={url} name={displayName(url)} reason="Không đọc được nội dung tệp để xem trước." />;
  }

  return (
    <div className={cn('relative overflow-auto rounded-xl border border-border bg-muted/30', className)}>
      {state.status === 'loading' && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-background/60 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Loader2 size={16} className="animate-spin" /> Đang mở tệp…
          </span>
        </div>
      )}
      {kind === 'docx' && <div ref={docxRef} className="docx-preview-host min-h-full [&_.docx-wrapper]:!bg-muted/40 [&_.docx-wrapper]:!p-4 [&_section.docx]:!shadow-md" />}
      {kind === 'text' && state.text !== undefined && (
        <pre className="whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-foreground">{state.text}</pre>
      )}
      {(kind === 'csv' || kind === 'xlsx') && state.sheets && <SheetTabs sheets={state.sheets} />}
    </div>
  );
}

type Sheet = { sheet: string; rows: string[][] };

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toLocaleDateString('vi-VN');
  return String(value);
}

/** CSV đơn giản (hỗ trợ ngoặc kép, dấu phẩy / chấm phẩy) */
function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows;
}

function SheetTabs({ sheets }: { sheets: Sheet[] }) {
  const [active, setActive] = useState(0);
  const current = sheets[active] ?? sheets[0];
  if (!current) return null;
  const rows = current.rows.slice(0, MAX_TABLE_ROWS);
  const width = Math.max(0, ...rows.map(r => r.length));
  return (
    <div className="flex min-h-full flex-col">
      {sheets.length > 1 && (
        <div className="sticky top-0 z-[1] flex gap-1 overflow-x-auto border-b border-border bg-card px-2 py-1.5">
          {sheets.map((s, i) => (
            <button
              key={s.sheet + i}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                'shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold',
                i === active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {s.sheet}
            </button>
          ))}
        </div>
      )}
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">Trang tính trống.</p>
      ) : (
        <table className="w-max min-w-full border-collapse bg-card text-xs">
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className={r === 0 ? 'bg-muted/60 font-semibold' : 'hover:bg-muted/30'}>
                <td className="sticky left-0 border border-border bg-muted px-2 py-1 text-right font-mono text-[10px] text-muted-foreground">
                  {r + 1}
                </td>
                {Array.from({ length: width }, (_, c) => (
                  <td key={c} className="max-w-[24rem] border border-border px-2 py-1 align-top">
                    {row[c] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {current.rows.length > MAX_TABLE_ROWS && (
        <p className="p-2 text-center text-[11px] text-muted-foreground">
          Hiển thị {MAX_TABLE_ROWS}/{current.rows.length} dòng đầu — tải tệp về để xem đầy đủ.
        </p>
      )}
    </div>
  );
}

/**
 * PowerPoint, .doc/.xls đời cũ: dùng trình xem Microsoft Office Online.
 * Chỉ mở khi người dùng bấm (liên kết tệp được gửi tới Microsoft) và khi tệp có URL công khai.
 */
function OfficeOnlineViewer({ url, title, className }: { url: string; title: string; className: string }) {
  const [enabled, setEnabled] = useState(false);
  const publicUrl = publicAbsoluteUrl(url);

  if (!publicUrl) {
    return (
      <Unsupported
        url={url}
        name={title}
        reason="Tệp PowerPoint / Office đời cũ chỉ xem trước được khi ứng dụng chạy trên tên miền công khai (https). Hãy tải tệp về để xem."
      />
    );
  }
  if (!enabled) {
    return (
      <div className="space-y-3 rounded-xl border border-dashed border-border p-8 text-center">
        <p className="text-sm text-foreground">Xem tệp này bằng Microsoft Office Online?</p>
        <p className="mx-auto max-w-md text-xs text-muted-foreground">
          Liên kết của tệp sẽ được gửi tới máy chủ của Microsoft để hiển thị. Nếu không muốn, hãy tải tệp về.
        </p>
        <div className="flex justify-center gap-2">
          <Button size="sm" onClick={() => setEnabled(true)}>
            Xem bằng Office Online
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={url} download>
              <Download size={14} className="mr-1" /> Tải về
            </a>
          </Button>
        </div>
      </div>
    );
  }
  return (
    <iframe
      src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(publicUrl)}`}
      title={title}
      className={cn('w-full rounded-xl border border-border bg-white', className)}
    />
  );
}

function Unsupported({ url, name, reason }: { url: string; name: string; reason?: string }) {
  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border p-8 text-center">
      <div className="mx-auto grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
        {reason ? <AlertTriangle size={20} /> : <FileQuestion size={20} />}
      </div>
      <p className="text-sm text-muted-foreground">{reason ?? `Chưa hỗ trợ xem trước loại tệp này (${name}).`}</p>
      <div className="flex justify-center gap-2">
        <Button size="sm" variant="outline" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} className="mr-1" /> Mở tab mới
          </a>
        </Button>
        <Button size="sm" asChild>
          <a href={url} download>
            <Download size={14} className="mr-1" /> Tải về
          </a>
        </Button>
      </div>
    </div>
  );
}
