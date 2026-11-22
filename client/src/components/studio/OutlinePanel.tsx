import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, ChevronDown, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  getErrorMessage,
  getGetCourseOutlineQueryKey,
  invalidateLms,
  useCreateCourseLesson,
  useCreateCourseSection,
  useDeleteCourseSection,
  useReorderCourseOutline,
  useUpdateCourseSection,
  type CourseOutline,
  type LessonSummary,
  type LessonType,
} from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { cn } from '@/lib/utils';
import { LESSON_TYPES, lessonTypeMeta } from './lessonMeta';

type SectionState = { id: number; title: string; lessons: LessonSummary[] };

const sectionKey = (id: number) => `s-${id}`;
const lessonKey = (id: number) => `l-${id}`;
const dropKey = (id: number) => `drop-${id}`;
const parseKey = (key: string) => {
  const [kind, id] = key.split('-');
  return { kind, id: Number(id) };
};

export type OutlinePanelProps = {
  courseId: number;
  outline: CourseOutline;
  selectedLessonId: number | null;
  onSelect: (lessonId: number | null) => void;
  onError: (message: string) => void;
};

export function OutlinePanel({ courseId, outline, selectedLessonId, onSelect, onError }: OutlinePanelProps) {
  const queryClient = useQueryClient();
  const reorder = useReorderCourseOutline();
  const createSection = useCreateCourseSection();
  const createLesson = useCreateCourseLesson();

  const fromServer = useMemo<SectionState[]>(
    () => outline.sections.map(s => ({ id: s.id, title: s.title, lessons: s.lessons })),
    [outline],
  );
  const [sections, setSections] = useState<SectionState[]>(fromServer);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);

  useEffect(() => {
    if (!activeKey) setSections(fromServer);
  }, [fromServer, activeKey]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findSectionOfLesson = (state: SectionState[], lessonId: number) => state.find(s => s.lessons.some(l => l.id === lessonId));

  const refresh = () => invalidateLms(queryClient);

  const persistOrder = async (next: SectionState[]) => {
    try {
      const updated = await reorder.mutateAsync({
        id: courseId,
        data: { sections: next.map(s => ({ id: s.id, lessonIds: s.lessons.map(l => l.id) })) },
      });
      queryClient.setQueryData(getGetCourseOutlineQueryKey(courseId), updated);
    } catch (err) {
      setSections(fromServer);
      onError(getErrorMessage(err, 'Chưa lưu được thứ tự mới.'));
    }
  };

  const onDragStart = (event: DragStartEvent) => setActiveKey(String(event.active.id));

  // Kéo bài học sang chương khác: di chuyển ngay trong lúc kéo
  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const a = parseKey(String(active.id));
    if (a.kind !== 'l') return;
    const o = parseKey(String(over.id));
    setSections(prev => {
      const from = findSectionOfLesson(prev, a.id);
      const to =
        o.kind === 'l' ? findSectionOfLesson(prev, o.id) : prev.find(s => s.id === o.id && (o.kind === 'drop' || o.kind === 's'));
      if (!from || !to || from.id === to.id) return prev;
      const lesson = from.lessons.find(l => l.id === a.id)!;
      const overIndex = o.kind === 'l' ? to.lessons.findIndex(l => l.id === o.id) : to.lessons.length;
      return prev.map(s => {
        if (s.id === from.id) return { ...s, lessons: s.lessons.filter(l => l.id !== a.id) };
        if (s.id === to.id) {
          const lessons = [...s.lessons];
          lessons.splice(overIndex < 0 ? lessons.length : overIndex, 0, lesson);
          return { ...s, lessons };
        }
        return s;
      });
    });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveKey(null);
    if (!over) {
      setSections(fromServer);
      return;
    }
    const a = parseKey(String(active.id));
    const o = parseKey(String(over.id));
    let next = sections;
    if (a.kind === 's') {
      const targetId = o.kind === 'l' ? findSectionOfLesson(sections, o.id)?.id : o.id;
      const from = sections.findIndex(s => s.id === a.id);
      const to = sections.findIndex(s => s.id === targetId);
      if (from >= 0 && to >= 0 && from !== to) next = arrayMove(sections, from, to);
    } else if (a.kind === 'l' && o.kind === 'l') {
      const section = findSectionOfLesson(sections, a.id);
      if (section && section.lessons.some(l => l.id === o.id)) {
        const from = section.lessons.findIndex(l => l.id === a.id);
        const to = section.lessons.findIndex(l => l.id === o.id);
        if (from !== to) {
          next = sections.map(s => (s.id === section.id ? { ...s, lessons: arrayMove(s.lessons, from, to) } : s));
        }
      }
    }
    setSections(next);
    const changed =
      JSON.stringify(next.map(s => [s.id, s.lessons.map(l => l.id)])) !==
      JSON.stringify(fromServer.map(s => [s.id, s.lessons.map(l => l.id)]));
    if (changed) void persistOrder(next);
  };

  const addSection = async () => {
    try {
      const created = await createSection.mutateAsync({ id: courseId, data: { title: `Chương ${sections.length + 1}` } });
      await refresh();
      setEditingSectionId(created.id);
    } catch (err) {
      onError(getErrorMessage(err, 'Chưa thêm được chương.'));
    }
  };

  const addLesson = async (sectionId: number, type: LessonType) => {
    try {
      const created = await createLesson.mutateAsync({
        id: courseId,
        data: { sectionId, type, title: `${lessonTypeMeta(type).label} mới` },
      });
      await refresh();
      onSelect(created.id);
    } catch (err) {
      onError(getErrorMessage(err, 'Chưa thêm được bài học.'));
    }
  };

  const activeLesson =
    activeKey && parseKey(activeKey).kind === 'l'
      ? sections.flatMap(s => s.lessons).find(l => l.id === parseKey(activeKey).id)
      : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Đề cương</span>
        <span className="text-[11px] text-muted-foreground">
          {outline.sections.reduce((n, s) => n + s.lessons.length, 0)} bài
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-2 pb-3">
        {sections.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Khóa học chưa có nội dung. Bắt đầu bằng việc thêm chương đầu tiên.
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setActiveKey(null);
            setSections(fromServer);
          }}
        >
          <SortableContext items={sections.map(s => sectionKey(s.id))} strategy={verticalListSortingStrategy}>
            {sections.map((section, index) => (
              <SortableSection
                key={section.id}
                section={section}
                index={index}
                selectedLessonId={selectedLessonId}
                editing={editingSectionId === section.id}
                onEditingChange={editing => setEditingSectionId(editing ? section.id : null)}
                onSelect={onSelect}
                onAddLesson={type => addLesson(section.id, type)}
                onDeleted={deletedLessonIds => {
                  if (selectedLessonId && deletedLessonIds.includes(selectedLessonId)) onSelect(null);
                  void refresh();
                }}
                onError={onError}
              />
            ))}
          </SortableContext>
          <DragOverlay>
            {activeLesson ? <LessonRow lesson={activeLesson} selected={false} overlay /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      <div className="border-t border-border p-2">
        <Button variant="outline" size="sm" className="w-full" onClick={addSection} disabled={createSection.isPending}>
          <Plus size={14} className="mr-1.5" /> Thêm chương
        </Button>
      </div>
    </div>
  );
}

function SortableSection({
  section,
  index,
  selectedLessonId,
  editing,
  onEditingChange,
  onSelect,
  onAddLesson,
  onDeleted,
  onError,
}: {
  section: SectionState;
  index: number;
  selectedLessonId: number | null;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onSelect: (id: number) => void;
  onAddLesson: (type: LessonType) => void;
  onDeleted: (lessonIds: number[]) => void;
  onError: (message: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sectionKey(section.id) });
  const { setNodeRef: setDropRef } = useDroppable({ id: dropKey(section.id) });
  const rename = useUpdateCourseSection();
  const remove = useDeleteCourseSection();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(section.title);
  const [collapsed, setCollapsed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => setTitle(section.title), [section.title]);

  const saveTitle = async () => {
    const next = title.trim();
    onEditingChange(false);
    if (!next || next === section.title) {
      setTitle(section.title);
      return;
    }
    try {
      await rename.mutateAsync({ id: section.id, data: { title: next } });
      await invalidateLms(queryClient);
    } catch (err) {
      setTitle(section.title);
      onError(getErrorMessage(err, 'Chưa đổi được tên chương.'));
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('rounded-xl border border-border bg-card', isDragging && 'opacity-50')}
    >
      <div className="group flex items-center gap-1 px-1.5 py-1.5">
        <button
          type="button"
          className="cursor-grab rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
          aria-label={`Kéo để sắp xếp chương ${index + 1}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </button>
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted"
          aria-label={collapsed ? 'Mở chương' : 'Thu gọn chương'}
        >
          <ChevronDown size={14} className={cn('transition', collapsed && '-rotate-90')} />
        </button>
        {editing ? (
          <form
            className="flex flex-1 items-center gap-1"
            onSubmit={e => {
              e.preventDefault();
              void saveTitle();
            }}
          >
            <Input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={() => void saveTitle()}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  setTitle(section.title);
                  onEditingChange(false);
                }
              }}
              className="h-7 text-xs"
              maxLength={200}
            />
            <button type="submit" className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Lưu tên chương">
              <Check size={13} />
            </button>
          </form>
        ) : (
          <>
            <span className="flex-1 truncate text-xs font-bold" title={section.title}>
              {section.title}
            </span>
            <button
              type="button"
              onClick={() => onEditingChange(true)}
              className="rounded p-1 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100 focus:opacity-100"
              aria-label="Đổi tên chương"
            >
              <Pencil size={12} />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
              aria-label="Xóa chương"
            >
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>

      {!collapsed && (
        <div ref={setDropRef} className="min-h-[8px] space-y-0.5 px-1.5 pb-1.5">
          <SortableContext items={section.lessons.map(l => lessonKey(l.id))} strategy={verticalListSortingStrategy}>
            {section.lessons.map(lesson => (
              <SortableLesson
                key={lesson.id}
                lesson={lesson}
                selected={lesson.id === selectedLessonId}
                onSelect={() => onSelect(lesson.id)}
              />
            ))}
          </SortableContext>
          {section.lessons.length === 0 && (
            <p className="px-2 py-1 text-[11px] text-muted-foreground">Kéo bài học vào đây hoặc thêm mới.</p>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Plus size={12} /> Thêm bài học
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              {LESSON_TYPES.map(t => (
                <DropdownMenuItem key={t.type} onSelect={() => onAddLesson(t.type)} className="items-start gap-2 py-2">
                  <t.icon size={15} className="mt-0.5 shrink-0" />
                  <span>
                    <span className="block text-xs font-semibold">{t.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{t.hint}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={`Xóa "${section.title}"?`}
        description={
          section.lessons.length
            ? `Chương này có ${section.lessons.length} bài học. Tất cả bài học, câu hỏi và tiến độ của học viên trong chương sẽ bị xóa vĩnh viễn.`
            : 'Chương trống sẽ bị xóa.'
        }
        confirmLabel="Xóa chương"
        pendingLabel="Đang xóa…"
        destructive
        pending={remove.isPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try {
            await remove.mutateAsync({ id: section.id });
            setConfirmDelete(false);
            onDeleted(section.lessons.map(l => l.id));
          } catch (err) {
            onError(getErrorMessage(err, 'Chưa xóa được chương.'));
          }
        }}
      />
    </div>
  );
}

function SortableLesson({ lesson, selected, onSelect }: { lesson: LessonSummary; selected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lessonKey(lesson.id) });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cn(isDragging && 'opacity-40')}>
      <LessonRow lesson={lesson} selected={selected} onSelect={onSelect} handleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function LessonRow({
  lesson,
  selected,
  onSelect,
  handleProps,
  overlay,
}: {
  lesson: LessonSummary;
  selected: boolean;
  onSelect?: () => void;
  handleProps?: Record<string, unknown>;
  overlay?: boolean;
}) {
  const meta = lessonTypeMeta(lesson.type);
  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-lg pr-2 text-xs transition',
        selected ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
        overlay && 'border border-border bg-card shadow-lg',
      )}
    >
      <button
        type="button"
        className="cursor-grab rounded p-1 text-muted-foreground/70 hover:text-foreground active:cursor-grabbing"
        aria-label={`Kéo để sắp xếp bài ${lesson.title}`}
        {...handleProps}
      >
        <GripVertical size={13} />
      </button>
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left">
        <meta.icon size={14} className="shrink-0" />
        <span className={cn('truncate', !lesson.isPublished && 'text-muted-foreground')}>{lesson.title}</span>
        {!lesson.isPublished && (
          <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-px text-[10px] font-semibold text-muted-foreground">
            Nháp
          </span>
        )}
      </button>
    </div>
  );
}

