import { useState, useEffect } from 'react';
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
  Eye,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/common';
import {
  lmsStorage,
  type CourseAssignment,
  type AssignmentSubmission,
} from '@/services/lmsStorage';
import { CreateAssignmentDialog } from '@/components/dialogs/CreateAssignmentDialog';
import { SubmitAssignmentDialog } from '@/components/dialogs/SubmitAssignmentDialog';
import { GradeSubmissionDialog } from '@/components/dialogs/GradeSubmissionDialog';
import { useRole } from '@/contexts/RoleContext';

export interface AssignmentsTabProps {
  courseId: number;
}

export function AssignmentsTab({ courseId }: AssignmentsTabProps) {
  const { role, user } = useRole();
  const [assignments, setAssignments] = useState<CourseAssignment[]>(() =>
    lmsStorage.getAssignments(courseId)
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [submittingAssignment, setSubmittingAssignment] = useState<CourseAssignment | null>(null);
  const [gradingSubmission, setGradingSubmission] = useState<{
    assignment: CourseAssignment;
    submission: AssignmentSubmission;
  } | null>(null);

  useEffect(() => {
    lmsStorage.fetchAssignments(courseId).then(items => {
      if (items && items.length > 0) {
        setAssignments(items);
        items.forEach(asg => {
          lmsStorage.fetchSubmissions(asg.id);
        });
      }
    });
  }, [courseId]);

  const reloadData = () => {
    setAssignments(lmsStorage.getAssignments(courseId));
    lmsStorage.fetchAssignments(courseId).then(items => {
      if (items && items.length > 0) {
        setAssignments(items);
        items.forEach(asg => lmsStorage.fetchSubmissions(asg.id));
      }
    });
  };

  const handleDeleteAssignment = (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa bài tập này?')) {
      lmsStorage.deleteAssignment(id);
      reloadData();
    }
  };

  return (
    <div className="space-y-5">
      {/* Tiêu đề & Nút giao bài mới cho Giảng viên */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-base font-bold text-foreground">
            {role === 'student' ? 'Bài tập & Nhiệm vụ cần hoàn thành' : 'Quản lý Bài tập & Chấm điểm học viên'}
          </h3>
          <p className="text-xs text-muted-foreground">
            {role === 'student'
              ? 'Theo dõi hạn nộp, tải lên bài làm và xem điểm số kèm lời phê của cô giáo.'
              : 'Giao bài tập định kỳ, theo dõi tiến độ nộp bài và chấm điểm trực tiếp.'}
          </p>
        </div>

        {role !== 'student' && (
          <Button size="sm" onClick={() => setCreateOpen(true)} className="h-9 gap-1.5 shrink-0">
            <Plus size={15} />
            <span>Giao bài tập mới</span>
          </Button>
        )}
      </div>

      {assignments.length === 0 ? (
        <Card className="border-dashed p-8 text-center text-muted-foreground">
          <FileCheck2 className="mx-auto mb-2 h-9 w-9 opacity-40" />
          <p className="text-sm font-semibold">Chưa có bài tập nào được giao cho khóa học này</p>
          <p className="text-xs text-muted-foreground mt-1">
            {role !== 'student'
              ? 'Bấm nút "Giao bài tập mới" để tạo bài tập cho học viên.'
              : 'Hiện tại bạn không có bài tập nào cần nộp.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {assignments.map(asg => {
            const studentSub = lmsStorage.getStudentSubmission(asg.id, user.id || 3);
            const allSubs = lmsStorage.getSubmissions(asg.id);
            const isDuePassed = new Date(asg.dueDate) < new Date();

            return (
              <Card
                key={asg.id}
                className="overflow-hidden border-card-border shadow-2xs transition hover:border-primary/40"
              >
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
                          Hạn chót: <b>{new Date(asg.dueDate).toLocaleDateString('vi-VN')}</b>
                        </span>
                        <span>·</span>
                        <span>Người giao: {asg.createdBy}</span>
                      </div>
                    </div>

                    {/* Nút tác vụ cho Giảng viên: Xóa bài tập */}
                    {role !== 'student' && (
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                          {allSubs.length} bài nộp
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteAssignment(asg.id)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Nội dung yêu cầu bài tập */}
                  <div className="mt-3 rounded-xl bg-muted/40 p-3.5 text-xs text-muted-foreground leading-relaxed">
                    <p className="font-semibold text-foreground mb-1">Yêu cầu bài làm:</p>
                    {asg.description}
                    {asg.attachmentName && (
                      <div className="mt-2.5 flex items-center gap-2 text-primary font-semibold">
                        <FileText size={14} />
                        <span>Tệp đề bài đính kèm: </span>
                        <a href={asg.attachmentUrl || '#'} className="underline hover:opacity-80">
                          {asg.attachmentName}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* VÙNG DÀNH CHO HỌC VIÊN: Hiển thị trạng thái nộp bài & Điểm số */}
                  {role === 'student' && (
                    <div className="mt-4 border-t border-border pt-4">
                      {studentSub ? (
                        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {studentSub.status === 'graded' ? (
                                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 text-xs font-bold">
                                  <CheckCircle2 size={13} /> Đã chấm điểm: {studentSub.grade} / {asg.maxPoints}
                                </Badge>
                              ) : (
                                <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 gap-1 text-xs">
                                  <Clock size={13} /> Đã nộp bài · Chờ chấm điểm
                                </Badge>
                              )}
                              <span className="text-[11px] text-muted-foreground">
                                Nộp lúc: {studentSub.submittedAt}
                              </span>
                            </div>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSubmittingAssignment(asg)}
                              className="h-8 text-xs font-semibold"
                            >
                              Nộp lại bài khác
                            </Button>
                          </div>

                          {studentSub.fileName && (
                            <div className="flex items-center gap-2 text-xs font-medium text-foreground bg-muted/50 p-2.5 rounded-lg">
                              <FileText size={15} className="text-primary" />
                              <span>{studentSub.fileName}</span>
                              {studentSub.fileSize && (
                                <span className="text-muted-foreground text-[11px]">({studentSub.fileSize})</span>
                              )}
                            </div>
                          )}

                          {/* Nhận xét của Giảng viên khi đã chấm điểm */}
                          {studentSub.status === 'graded' && studentSub.feedback && (
                            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs">
                              <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300 mb-1">
                                <MessageSquare size={14} />
                                <span>Lời phê từ Giảng viên ({studentSub.gradedBy}):</span>
                              </div>
                              <p className="text-emerald-950 dark:text-emerald-100 leading-relaxed">
                                {studentSub.feedback}
                              </p>
                              {studentSub.gradedAt && (
                                <p className="mt-1 text-[10px] text-emerald-700 dark:text-emerald-400">
                                  Chấm vào lúc: {studentSub.gradedAt}
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
                              <b>Chưa nộp bài:</b> Hãy hoàn thành trước ngày{' '}
                              {new Date(asg.dueDate).toLocaleDateString('vi-VN')} để không bị trừ điểm.
                            </span>
                          </div>

                          <Button
                            size="sm"
                            onClick={() => setSubmittingAssignment(asg)}
                            className="h-8 gap-1.5 text-xs font-semibold shrink-0"
                          >
                            <UploadCloud size={14} />
                            <span>Nộp bài ngay</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* VÙNG DÀNH CHO GIẢNG VIÊN: Danh sách học sinh đã nộp và nút chấm điểm */}
                  {role !== 'student' && (
                    <div className="mt-4 border-t border-border pt-4">
                      <h5 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                        Danh sách học viên đã nộp bài ({allSubs.length})
                      </h5>

                      {allSubs.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">
                          Chưa có học viên nào nộp bài cho bài tập này.
                        </p>
                      ) : (
                        <div className="grid gap-2">
                          {allSubs.map(sub => (
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
                                    Tệp: <span className="font-medium text-foreground">{sub.fileName || 'Văn bản nộp'}</span> · {sub.submittedAt}
                                  </p>
                                </div>
                              </div>

                              <Button
                                size="sm"
                                variant={sub.status === 'graded' ? 'outline' : 'default'}
                                onClick={() => setGradingSubmission({ assignment: asg, submission: sub })}
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
          })}
        </div>
      )}

      {/* Modal giao bài tập mới */}
      <CreateAssignmentDialog
        open={createOpen}
        courseId={courseId}
        onClose={() => setCreateOpen(false)}
        onCreated={reloadData}
      />

      {/* Modal nộp bài tập của học viên */}
      {submittingAssignment && (
        <SubmitAssignmentDialog
          open={!!submittingAssignment}
          assignment={submittingAssignment}
          existingSubmission={lmsStorage.getStudentSubmission(submittingAssignment.id, user.id || 3)}
          onClose={() => setSubmittingAssignment(null)}
          onSubmitted={reloadData}
        />
      )}

      {/* Modal chấm điểm của Giảng viên */}
      {gradingSubmission && (
        <GradeSubmissionDialog
          open={!!gradingSubmission}
          assignment={gradingSubmission.assignment}
          submission={gradingSubmission.submission}
          onClose={() => setGradingSubmission(null)}
          onGraded={reloadData}
        />
      )}
    </div>
  );
}
