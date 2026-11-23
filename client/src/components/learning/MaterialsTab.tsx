import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  FileVideo,
  Presentation,
  Link as LinkIcon,
  Download,
  Plus,
  Search,
  Trash2,
  ExternalLink,
  BookOpen,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  formatDate,
  invalidateLms,
  recordMaterialDownload,
  useDeleteMaterial,
  useGetCourseOutline,
  useGetLmsCourse,
  useListCourseMaterials,
  type Material,
} from '@/api';
import { QueryState } from '@/components/common';
import { notify } from '@/lib/toast';
import { CreateMaterialDialog } from '@/components/dialogs/CreateMaterialDialog';
import { useRole } from '@/contexts/RoleContext';
import { FilePreviewDialog, type PreviewFile } from '@/components/preview/FilePreviewDialog';
import { canPreview } from '@/components/preview/fileKind';

export interface MaterialsTabProps {
  courseId: number;
}

export function MaterialsTab({ courseId }: MaterialsTabProps) {
  const { canManageCourse } = useRole();
  const queryClient = useQueryClient();
  const courseQuery = useGetLmsCourse(courseId);
  const materialsQuery = useListCourseMaterials(courseId);
  // Tên bài học chứa từng tài liệu (tài liệu gắn bài học qua lessonId)
  const outlineQuery = useGetCourseOutline(courseId);
  const lessonTitles = new Map(
    (outlineQuery.data?.sections ?? []).flatMap(s => s.lessons.map(l => [l.id, l.title] as const)),
  );
  const deleteMaterial = useDeleteMaterial();
  const canManage = canManageCourse(courseQuery.data);
  const materials = materialsQuery.data ?? [];
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewFile | null>(null);

  const filtered = useMemo(() => {
    return materials.filter(m => {
      const matchType = filterType === 'all' || m.type === filterType;
      const matchSearch = `${m.title} ${m.fileName || ''} ${m.description || ''}`
        .toLowerCase()
        .includes(search.toLowerCase());
      return matchType && matchSearch;
    });
  }, [materials, filterType, search]);

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa tài liệu này khỏi khóa học?')) return;
    try {
      await deleteMaterial.mutateAsync({ id });
      await invalidateLms(queryClient);
      notify.success('Đã xóa tài liệu khỏi khóa học.');
    } catch (err) {
      notify.error(err, 'Chưa thể xóa tài liệu.');
    }
  };

  const handleDownload = (m: Material) => {
    // Ghi nhận lượt tải (không chặn việc mở tệp)
    recordMaterialDownload(m.id)
      .then(() => invalidateLms(queryClient))
      .catch(() => {});
    if (m.type === 'video' || m.type === 'link') {
      window.open(m.fileUrl, '_blank', 'noopener');
    } else {
      const link = document.createElement('a');
      link.href = m.fileUrl;
      link.download = m.fileName || `${m.title}.pdf`;
      link.target = '_blank';
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getTypeBadge = (type: Material['type']) => {
    switch (type) {
      case 'slide':
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1 text-[10px]">
            <Presentation size={12} /> Slide bài giảng
          </Badge>
        );
      case 'pdf':
        return (
          <Badge className="bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30 gap-1 text-[10px]">
            <FileText size={12} /> Tài liệu PDF
          </Badge>
        );
      case 'doc':
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 gap-1 text-[10px]">
            <FileText size={12} /> Văn bản Word
          </Badge>
        );
      case 'video':
        return (
          <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 gap-1 text-[10px]">
            <FileVideo size={12} /> Video học tập
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1 text-[10px]">
            <LinkIcon size={12} /> Liên kết ngoài
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Thanh tác vụ: Tìm kiếm & Đăng tài liệu */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {['all', 'slide', 'pdf', 'doc', 'video'].map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filterType === t
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/70 text-muted-foreground hover:bg-muted'
              }`}
            >
              {t === 'all'
                ? 'Tất cả học liệu'
                : t === 'slide'
                ? 'Slide bài giảng'
                : t === 'pdf'
                ? 'File PDF'
                : t === 'doc'
                ? 'Tài liệu Word'
                : 'Video'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm tài liệu..."
              className="h-9 pl-8 text-xs"
            />
          </div>

          {canManage && (
            <Button size="sm" onClick={() => setDialogOpen(true)} className="h-9 gap-1.5 shrink-0">
              <Plus size={15} />
              <span>Đăng tài liệu mới</span>
            </Button>
          )}
        </div>
      </div>

      {/* Danh sách học liệu */}
      <QueryState loading={materialsQuery.isLoading} error={materialsQuery.error} refetch={() => materialsQuery.refetch()}>
      {filtered.length === 0 ? (
        <Card className="border-dashed p-8 text-center text-muted-foreground">
          <BookOpen className="mx-auto mb-2 h-9 w-9 opacity-40" />
          <p className="text-sm font-semibold">Chưa có tài liệu nào trong danh mục này</p>
          <p className="text-xs text-muted-foreground mt-1">
            {canManage ? 'Bấm "Đăng tài liệu mới" để chia sẻ học liệu cho lớp.' : 'Giảng viên sẽ cập nhật tài liệu sớm.'}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(m => (
            <Card
              key={m.id}
              className="border-card-border shadow-2xs transition hover:border-primary/40 hover:shadow-sm"
            >
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3.5">
                  <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                    {m.type === 'slide' ? (
                      <Presentation size={20} />
                    ) : m.type === 'video' ? (
                      <FileVideo size={20} />
                    ) : (
                      <FileText size={20} />
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-display text-sm font-bold text-foreground">{m.title}</h4>
                      {getTypeBadge(m.type)}
                      {m.lessonId !== null && lessonTitles.has(m.lessonId) && (
                        <span className="text-[10px] font-medium text-muted-foreground">· {lessonTitles.get(m.lessonId)}</span>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{m.description}</p>

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                      <span>Người đăng: <b className="text-foreground">{m.uploadedBy}</b></span>
                      <span>·</span>
                      <span>Ngày đăng: {formatDate(m.createdAt)}</span>
                      <span>·</span>
                      {m.fileSize && (
                        <>
                          <span>Dung lượng: {m.fileSize}</span>
                          <span>·</span>
                        </>
                      )}
                      <span>{m.downloadCount} lượt tải</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {m.type !== 'link' && canPreview(m.fileUrl, m.fileName) && (
                    <Button
                      size="sm"
                      onClick={() => setPreview({ url: m.fileUrl, name: m.fileName })}
                      className="h-8 gap-1.5 text-xs font-semibold"
                    >
                      <Eye size={13} />
                      <span>Xem</span>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(m)}
                    className="h-8 gap-1.5 text-xs font-semibold"
                  >
                    {m.type === 'video' || m.type === 'link' ? <ExternalLink size={13} /> : <Download size={13} />}
                    <span>{m.type === 'video' || m.type === 'link' ? 'Mở liên kết' : 'Tải tài liệu'}</span>
                  </Button>

                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={deleteMaterial.isPending}
                      onClick={() => handleDelete(m.id)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      aria-label="Xóa tài liệu"
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </QueryState>

      {/* Modal đăng tài liệu mới */}
      <CreateMaterialDialog
        open={dialogOpen}
        courseId={courseId}
        onClose={() => setDialogOpen(false)}
      />
      <FilePreviewDialog file={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
