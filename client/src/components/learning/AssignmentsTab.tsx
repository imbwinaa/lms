import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Award,
  FileCheck2,
  UploadCloud,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  FileText,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, QueryState } from '@/components/common';
import { notify } from '@/lib/toast';
import {
  formatDate,
  formatDateTime,
  invalidateLms,
  useDeleteAssignment,
  useGetLmsCourse,
  useListAssignmentSubmissions,
  useListCourseAssignments,
  type Assignment,
  type Submission,
} from '@/api';
import { CreateAssignmentDialog } from '@/components/dialogs/CreateAssignmentDialog';
import { SubmitAssignmentDialog } from '@/components/dialogs/SubmitAssignmentDialog';
import { GradeSubmissionDialog } from '@/components/dialogs/GradeSubmissionDialog';
import { useRole } from '@/contexts/RoleContext';
import { PreviewLink } from '@/components/preview/FilePreviewDialog';

export interface AssignmentsTabProps {
  courseId: number;
}

export function AssignmentsTab({ courseId }: AssignmentsTabProps) {
  const { role, canManageCourse } = useRole();
  const courseQuery = useGetLmsCourse(courseId);
  const assignmentsQuery = useListCourseAssignments(courseId);
  const canManage = canManageCourse(courseQuery.data);
  const assignments = assignmentsQuery.data ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState<{ assignment: Assignment; existing?: Submission } | null>(null);
  const [grading, setGrading] = useState<{ assignment: Assignment; submission: Submission } | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-base font-bold text-foreground">
            {role === 'student' ? 'Bài tập & Nhiệm vụ cần hoàn thành' : 'Quản lý Bài tập & Chấm điểm học viên'}
          </h3>
          <p className="text-xs text-muted-foreground">
            {role === 'student'
              ? 'Theo dõi hạn nộp, tải lên bài làm và xem điểm số kèm lời phê của giảng viên.'
              : 'Giao bài tập định kỳ, theo dõi tiến độ nộp bài và chấm điểm trực tiếp.'}
          </p>
        </div>

        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)} className="h-9 gap-1.5 shrink-0">
            <Plus size={15} />
            <span>Giao bài tập mới</span>
          </Button>
        )}
      </div>

      <QueryState loading={assignmentsQuery.isLoading} error={assignmentsQuery.error} refetch={() => assignmentsQuery.refetch()}>
        {assignments.length === 0 ? (
          <Card className="border-dashed p-8 text-center text-muted-foreground">
            <FileCheck2 className="mx-auto mb-2 h-9 w-9 opacity-40" />
            <p className="text-sm font-semibold">Chưa có bài tập nào được giao cho khóa học này</p>
            <p className="text-xs text-muted-foreground mt-1">
              {canManage ? 'Bấm nút "Giao bài tập mới" để tạo bài tập cho học viên.' : 'Hiện tại chưa có bài tập nào cần nộp.'}
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {assignments.map(asg => (
              <AssignmentCard
                key={asg.id}
                assignment={asg}
                isStudent={role === 'student'}
                canManage={canManage}
                onSubmit={existing => setSubmitting({ assignment: asg, existing })}
                onGrade={submission => setGrading({ assignment: asg, submission })}
              />
            ))}
          </div>
        )}
      </QueryState>

      <CreateAssignmentDialog open={createOpen} courseId={courseId} onClose={() => setCreateOpen(false)} />

      {submitting && (
        <SubmitAssignmentDialog
          open
          assignment={submitting.assignment}
          existingSubmission={submitting.existing}
          onClose={() => setSubmitting(null)}
        />
      )}

      {grading && (
        <GradeSubmissionDialog
          open
          assignment={grading.assignment}
          submission={grading.submission}
          onClose={() => setGrading(null)}
        />
      )}
    </div>
  );
}

function AssignmentCard({
  assignment: asg,
  isStudent,
  canManage,
  onSubmit,
  onGrade,
}: {
  assignment: Assignment;
  isStudent: boolean;
  canManage: boolean;
  onSubmit: (existing?: Submission) => void;
  onGrade: (submission: Submission) => void;
}) {
  const queryClient = useQueryClient();
  const deleteAssignment = useDeleteAssignment();
  // Học viên: chỉ nhận bài nộp của chính mình; giảng viên phụ trách: toàn bộ bài nộp
  const submissionsQuery = useListAssignmentSubmissions(asg.id, {
    query: { enabled: isStudent || canManage },
  });
  const submissions = submissionsQuery.data ?? [];
  const studentSub = isStudent ? submissions[0] : undefined;

  const handleDelete = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa bài tập này? Mọi bài nộp liên quan cũng sẽ bị xóa.')) return;
    try {
      await deleteAssignment.mutateAsync({ id: asg.id });
      await invalidateLms(queryClient);
      notify.success('Đã xóa bài tập.', asg.title);
    } catch (err) {
      notify.error(err, 'Chưa thể xóa bài tập.');
    }
  };

  return (
    <Card className="overflow-hidden border-card-border shadow-2xs transition hover:border-primary/40">
      <div className="p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-display text-base font-bold text-foreground">{asg.title}</h4>
              <Badge variant="outline" className="text-[10px] font-semibold gap-1">
                <Award size={12} className="text-primary" /> Thang điểm: {asg.maxPoints}
              </Badge>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar size={13} className="text-primary" />
                Hạn chót: <b>{formatDate(asg.dueDate)}</b>
              </span>
              <span>·</span>
              <span>Người giao: {asg.createdBy}</span>
            </div>
          </div>

          {canManage && (
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">{submissions.length} bài nộp</Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDelete}
                disabled={deleteAssignment.isPending}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                aria-label="Xóa bài tập"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          )}
        </div>

        <div className="mt-3 rounded-xl bg-muted/40 p-3.5 text-xs text-muted-foreground leading-relaxed">
          <p className="font-semibold text-foreground mb-1">Yêu cầu bài làm:</p>
          {asg.description || 'Hoàn thành bài tập theo hướng dẫn và nộp đúng hạn.'}
          {asg.attachmentName && asg.attachmentUrl && (
            <div className="mt-2.5 flex items-center gap-2 text-primary font-semibold">
              <FileText size={14} />
              <span>Tệp đề bài đính kèm: </span>
              <PreviewLink url={asg.attachmentUrl} name={asg.attachmentName} className="underline hover:opacity-80">
                {asg.attachmentName}
              </PreviewLink>
            </div>
          )}
        </div>

        {/* HỌC VIÊN: trạng thái nộp bài & điểm số */}
        {isStudent && (
          <div className="mt-4 border-t border-border pt-4">
            {submissionsQuery.isLoading ? (
              <p className="text-xs text-muted-foreground">Đang tải trạng thái bài nộp...</p>
            ) : studentSub ? (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {studentSub.status === 'graded' ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 text-xs font-bold">
                        <CheckCircle2 size={13} /> Đã chấm điểm: {studentSub.grade} / {asg.maxPoints}
                      </Badge>
                    ) : (
                      <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 gap-1 text-xs">
                        <Clock size={13} /> Đã nộp bài · Chờ chấm điểm
                      </Badge>
                    )}
                    <span className="text-[11px] text-muted-foreground">Nộp lúc: {formatDateTime(studentSub.submittedAt)}</span>
                  </div>

                  {studentSub.status !== 'graded' && (
                    <Button size="sm" variant="outline" onClick={() => onSubmit(studentSub)} className="h-8 text-xs font-semibold">
                      Nộp lại bài khác
                    </Button>
                  )}
                </div>

                {studentSub.fileName && (
                  <div className="flex items-center gap-2 text-xs font-medium text-foreground bg-muted/50 p-2.5 rounded-lg">
                    <FileText size={15} className="text-primary" />
                    {studentSub.fileUrl ? (
                      <PreviewLink url={studentSub.fileUrl} name={studentSub.fileName} className="hover:underline">
                        {studentSub.fileName}
                      </PreviewLink>
                    ) : (
                      <span>{studentSub.fileName}</span>
                    )}
                    {studentSub.fileSize && <span className="text-muted-foreground text-[11px]">({studentSub.fileSize})</span>}
                  </div>
                )}

                {studentSub.status === 'graded' && studentSub.feedback && (
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300 mb-1">
                      <MessageSquare size={14} />
                      <span>Lời phê từ Giảng viên ({studentSub.gradedBy}):</span>
                    </div>
                    <p className="text-emerald-950 dark:text-emerald-100 leading-relaxed">{studentSub.feedback}</p>
                    {studentSub.gradedAt && (
                      <p className="mt-1 text-[10px] text-emerald-700 dark:text-emerald-400">
                        Chấm vào lúc: {formatDateTime(studentSub.gradedAt)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5">
                <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
                  <AlertCircle size={16} className="text-amber-600 shrink-0" />
                  <span>
                    <b>Chưa nộp bài:</b> Hãy hoàn thành trước ngày {formatDate(asg.dueDate)} để không bị trừ điểm.
                  </span>
                </div>

                <Button size="sm" onClick={() => onSubmit()} className="h-8 gap-1.5 text-xs font-semibold shrink-0">
                  <UploadCloud size={14} />
                  <span>Nộp bài ngay</span>
                </Button>
              </div>
            )}
          </div>
        )}

        {/* GIẢNG VIÊN PHỤ TRÁCH: danh sách bài nộp & chấm điểm */}
        {canManage && (
          <div className="mt-4 border-t border-border pt-4">
            <h5 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Danh sách học viên đã nộp bài ({submissions.length})
            </h5>

            {submissions.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Chưa có học viên nào nộp bài cho bài tập này.</p>
            ) : (
              <div className="grid gap-2">
                {submissions.map(sub => (
                  <div
                    key={sub.id}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border bg-card p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={sub.studentName} size="sm" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-foreground">{sub.studentName}</p>
                          {sub.status === 'graded' ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                              Điểm: {sub.grade} / {asg.maxPoints}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">
                              Chờ chấm
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Tệp: <span className="font-medium text-foreground">{sub.fileName || 'Văn bản nộp'}</span> ·{' '}
                          {formatDateTime(sub.submittedAt)}
                        </p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant={sub.status === 'graded' ? 'outline' : 'default'}
                      onClick={() => onGrade(sub)}
                      className="h-8 text-xs font-semibold self-end sm:self-auto"
                    >
                      {sub.status === 'graded' ? 'Sửa điểm & Lời phê' : 'Chấm bài ngay'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
