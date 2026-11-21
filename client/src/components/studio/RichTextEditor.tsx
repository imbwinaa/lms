import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react';
import { getErrorMessage, uploadBrowserFile } from '@/api';
import { cn } from '@/lib/utils';

export type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Đổi khóa để nạp lại nội dung (VD: khi chuyển sang bài học khác) */
  resetKey?: string | number;
};

/** Trình soạn thảo văn bản giàu định dạng (Tiptap). HTML được máy chủ làm sạch khi lưu. */
export function RichTextEditor({ value, onChange, placeholder, resetKey }: RichTextEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      Image,
      Placeholder.configure({ placeholder: placeholder ?? 'Soạn nội dung bài học…' }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none min-h-[260px] px-4 py-3 focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => onChangeRef.current(editor.isEmpty ? '' : editor.getHTML()),
  });

  // Nạp nội dung mới khi chuyển bài học
  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.commands.setContent(value || '', { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, resetKey]);

  return (
    <div className="overflow-hidden rounded-xl border border-input bg-card focus-within:ring-2 focus-within:ring-ring/40">
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      link: e.isActive('link'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Dán đường dẫn (để trống để gỡ liên kết)', previous ?? 'https://');
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  const insertImage = async (file: File) => {
    setError('');
    setUploading(true);
    try {
      const uploaded = await uploadBrowserFile(file);
      editor.chain().focus().setImage({ src: uploaded.url, alt: file.name }).run();
    } catch (err) {
      setError(err instanceof Error && !('status' in err) ? err.message : getErrorMessage(err, 'Không tải được ảnh.'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const buttons: Array<{ label: string; icon: typeof Bold; active?: boolean; disabled?: boolean; run: () => void }> = [
    { label: 'Đậm', icon: Bold, active: state.bold, run: () => editor.chain().focus().toggleBold().run() },
    { label: 'Nghiêng', icon: Italic, active: state.italic, run: () => editor.chain().focus().toggleItalic().run() },
    { label: 'Gạch chân', icon: UnderlineIcon, active: state.underline, run: () => editor.chain().focus().toggleUnderline().run() },
    { label: 'Gạch ngang', icon: Strikethrough, active: state.strike, run: () => editor.chain().focus().toggleStrike().run() },
    { label: 'Tiêu đề lớn', icon: Heading2, active: state.h2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: 'Tiêu đề nhỏ', icon: Heading3, active: state.h3, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: 'Danh sách', icon: List, active: state.bullet, run: () => editor.chain().focus().toggleBulletList().run() },
    { label: 'Danh sách số', icon: ListOrdered, active: state.ordered, run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: 'Trích dẫn', icon: Quote, active: state.quote, run: () => editor.chain().focus().toggleBlockquote().run() },
    { label: 'Liên kết', icon: Link2, active: state.link, run: setLink },
  ];

  return (
    <div className="border-b border-border bg-muted/40">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5">
        {buttons.map(b => (
          <ToolbarButton key={b.label} {...b} />
        ))}
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton
          label={uploading ? 'Đang tải ảnh…' : 'Chèn ảnh'}
          icon={uploading ? Loader2 : ImagePlus}
          disabled={uploading}
          spin={uploading}
          run={() => fileRef.current?.click()}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) void insertImage(file);
          }}
        />
        <span className="ml-auto flex gap-0.5">
          <ToolbarButton label="Hoàn tác" icon={Undo2} disabled={!state.canUndo} run={() => editor.chain().focus().undo().run()} />
          <ToolbarButton label="Làm lại" icon={Redo2} disabled={!state.canRedo} run={() => editor.chain().focus().redo().run()} />
        </span>
      </div>
      {error && <p className="px-3 pb-1.5 text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

function ToolbarButton({
  label,
  icon: Icon,
  active,
  disabled,
  spin,
  run,
}: {
  label: string;
  icon: typeof Bold;
  active?: boolean;
  disabled?: boolean;
  spin?: boolean;
  run: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={e => e.preventDefault()}
      onClick={run}
      className={cn(
        'grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition hover:bg-background hover:text-foreground disabled:opacity-40',
        active && 'bg-background text-foreground shadow-2xs',
      )}
    >
      <Icon size={15} className={spin ? 'animate-spin' : undefined} />
    </button>
  );
}
