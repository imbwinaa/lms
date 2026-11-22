import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { Router } from "express";
import {
  db,
  lmsActivitiesTable,
  lmsAssignmentsTable,
  lmsCoursesTable,
  lmsEnrollmentsTable,
  lmsMaterialsTable,
  lmsSubmissionsTable,
  type LmsAssignment,
  type LmsMaterial,
  type LmsSubmission,
} from "../db";
import { canManageCourse, findAssignment, loadCourseForRead, loadCourseForWrite } from "../lib/access";
import { getAvatarInitials, type AuthUser } from "../lib/auth";
import { badRequest, conflict, forbidden, notFound, parseOr400, toIso } from "../lib/http";
import { currentUser, requireRole } from "../middlewares/auth";
import { assertSafeUrl } from "../lib/content";
import { assertLessonInCourse } from "./studio";
import {
  CreateCourseAssignmentBody,
  CreateCourseAssignmentParams,
  CreateCourseMaterialBody,
  CreateCourseMaterialParams,
  DeleteAssignmentParams,
  DeleteMaterialParams,
  GradeSubmissionBody,
  GradeSubmissionParams,
  ListAssignmentSubmissionsParams,
  ListCourseAssignmentsParams,
  ListCourseMaterialsParams,
  ListMySubmissionsQueryParams,
  RecordMaterialDownloadParams,
  SubmitAssignmentBody,
  SubmitAssignmentParams,
} from "../schemas";

const router = Router();

// ---------------------------------------------------------------------------
// Định dạng phản hồi (id số, thời gian ISO)
// ---------------------------------------------------------------------------
const nowIso = () => new Date().toISOString();

function formatMaterial(m: LmsMaterial) {
  return {
    id: m.id,
    courseId: m.courseId,
    lessonId: m.lessonId ?? null,
    lessonNumber: m.lessonNumber ?? 1,
    title: m.title,
    type: m.type,
    fileUrl: m.fileUrl,
    fileName: m.fileName ?? null,
    fileSize: m.fileSize ?? null,
    description: m.description ?? null,
    uploadedBy: m.uploadedBy,
    downloadCount: m.downloadCount,
    createdAt: toIso(m.createdAt) ?? nowIso(),
  };
}

function formatAssignment(a: LmsAssignment) {
  return {
    id: a.id,
    courseId: a.courseId,
    title: a.title,
    description: a.description ?? "",
    dueDate: a.dueDate,
    maxPoints: a.maxPoints,
    attachmentUrl: a.attachmentUrl ?? null,
    attachmentName: a.attachmentName ?? null,
    createdBy: a.createdBy,
    createdAt: toIso(a.createdAt) ?? nowIso(),
  };
}

function formatSubmission(s: LmsSubmission) {
  return {
    id: s.id,
    assignmentId: s.assignmentId,
    studentId: s.studentId,
    studentName: s.studentName,
    studentAvatar: s.studentAvatar,
    fileUrl: s.fileUrl ?? null,
    fileName: s.fileName ?? null,
    fileSize: s.fileSize ?? null,
    textContent: s.textContent ?? null,
    status: s.status === "graded" ? ("graded" as const) : ("submitted" as const),
    grade: s.grade ?? null,
    feedback: s.feedback ?? null,
    gradedBy: s.gradedBy ?? null,
    gradedAt: toIso(s.gradedAt),
    submittedAt: toIso(s.submittedAt) ?? nowIso(),
  };
}

/** Id các khóa học mà người dùng "thuộc về": giảng viên -> khóa phụ trách, học viên -> khóa đã ghi danh */
async function memberCourseIds(user: AuthUser): Promise<number[] | "all"> {
  if (user.role === "admin") return "all";
  if (user.role === "lecturer") {
    const rows = await db
      .select({ id: lmsCoursesTable.id })
      .from(lmsCoursesTable)
      .where(eq(lmsCoursesTable.instructorId, user.id));
    return rows.map((r) => r.id);
  }
  const rows = await db
    .select({ id: lmsEnrollmentsTable.courseId })
    .from(lmsEnrollmentsTable)
    .where(eq(lmsEnrollmentsTable.learnerId, user.id));
  return rows.map((r) => r.id);
}

async function logActivity(title: string, detail: string, kind: "enrollment" | "completion" | "certificate" | "quiz") {
  await db.insert(lmsActivitiesTable).values({ title, detail, time: "Vừa xong", kind });
}

// ---------------------------------------------------------------------------
// TÀI LIỆU (MATERIALS)
// ---------------------------------------------------------------------------
router.get("/lms/courses/:id/materials", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(ListCourseMaterialsParams, req.params);
  await loadCourseForRead(user, id);
  const rows = await db
    .select()
    .from(lmsMaterialsTable)
    .where(eq(lmsMaterialsTable.courseId, id))
    .orderBy(desc(lmsMaterialsTable.id));
  res.json(rows.map(formatMaterial));
});

router.post("/lms/courses/:id/materials", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(CreateCourseMaterialParams, req.params);
  const body = parseOr400(CreateCourseMaterialBody, req.body);
  await loadCourseForWrite(user, id);
  if (body.lessonId !== undefined) await assertLessonInCourse(body.lessonId, id);
  body.fileUrl = assertSafeUrl(body.fileUrl, "Đường dẫn tài liệu") ?? body.fileUrl;

  const [inserted] = await db
    .insert(lmsMaterialsTable)
    .values({
      courseId: id,
      lessonId: body.lessonId ?? null,
      lessonNumber: body.lessonNumber ?? 1,
      title: body.title.trim(),
      type: body.type,
      fileUrl: body.fileUrl,
      fileName: body.fileName ?? null,
      fileSize: body.fileSize ?? null,
      description: body.description?.trim() || null,
      uploadedBy: user.name,
      downloadCount: 0,
      createdAt: nowIso(),
    })
    .returning();

  await logActivity(`${user.name} vừa đăng tài liệu mới`, body.title, "quiz");
  res.status(201).json(formatMaterial(inserted!));
});

router.delete("/lms/materials/:id", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(DeleteMaterialParams, req.params);
  const [material] = await db.select().from(lmsMaterialsTable).where(eq(lmsMaterialsTable.id, id)).limit(1);
  if (!material) throw notFound("Không tìm thấy tài liệu.");
  await loadCourseForWrite(user, material.courseId);
  await db.delete(lmsMaterialsTable).where(eq(lmsMaterialsTable.id, id));
  res.json({ message: "Đã xóa tài liệu thành công." });
});

router.post("/lms/materials/:id/download", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(RecordMaterialDownloadParams, req.params);
  const [material] = await db.select().from(lmsMaterialsTable).where(eq(lmsMaterialsTable.id, id)).limit(1);
  if (!material) throw notFound("Không tìm thấy tài liệu.");
  await loadCourseForRead(user, material.courseId);
  const [updated] = await db
    .update(lmsMaterialsTable)
    .set({ downloadCount: sql`${lmsMaterialsTable.downloadCount} + 1` })
    .where(eq(lmsMaterialsTable.id, id))
    .returning();
  res.json({ downloadCount: updated!.downloadCount });
});

// ---------------------------------------------------------------------------
// BÀI TẬP (ASSIGNMENTS)
// ---------------------------------------------------------------------------
router.get("/lms/assignments", async (req, res) => {
  const user = currentUser(req);
  const courseIds = await memberCourseIds(user);
  if (courseIds !== "all" && courseIds.length === 0) {
    res.json([]);
    return;
  }
  const rows = await db
    .select()
    .from(lmsAssignmentsTable)
    .where(courseIds === "all" ? undefined : inArray(lmsAssignmentsTable.courseId, courseIds))
    .orderBy(desc(lmsAssignmentsTable.id));
  res.json(rows.map(formatAssignment));
});

router.get("/lms/courses/:id/assignments", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(ListCourseAssignmentsParams, req.params);
  await loadCourseForRead(user, id);
  const rows = await db
    .select()
    .from(lmsAssignmentsTable)
    .where(eq(lmsAssignmentsTable.courseId, id))
    .orderBy(desc(lmsAssignmentsTable.id));
  res.json(rows.map(formatAssignment));
});

router.post("/lms/courses/:id/assignments", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(CreateCourseAssignmentParams, req.params);
  const body = parseOr400(CreateCourseAssignmentBody, req.body);
  await loadCourseForWrite(user, id);

  const [inserted] = await db
    .insert(lmsAssignmentsTable)
    .values({
      courseId: id,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      dueDate: body.dueDate,
      maxPoints: body.maxPoints ?? 10,
      attachmentName: body.attachmentName ?? null,
      attachmentUrl: body.attachmentUrl ?? null,
      createdBy: user.name,
      createdAt: nowIso(),
    })
    .returning();

  await logActivity(`${user.name} vừa giao bài tập mới`, body.title, "enrollment");
  res.status(201).json(formatAssignment(inserted!));
});

router.delete("/lms/assignments/:id", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(DeleteAssignmentParams, req.params);
  const assignment = await findAssignment(id);
  await loadCourseForWrite(user, assignment.courseId);
  await db.delete(lmsAssignmentsTable).where(eq(lmsAssignmentsTable.id, id));
  res.json({ message: "Đã xóa bài tập thành công." });
});

// ---------------------------------------------------------------------------
// BÀI NỘP & CHẤM ĐIỂM (SUBMISSIONS)
// ---------------------------------------------------------------------------
router.get("/lms/submissions", async (req, res) => {
  const user = currentUser(req);
  const { status } = parseOr400(ListMySubmissionsQueryParams, req.query);

  const conditions: SQL[] = [];
  if (status) conditions.push(eq(lmsSubmissionsTable.status, status));
  if (user.role === "student") {
    conditions.push(eq(lmsSubmissionsTable.studentId, user.id));
  } else if (user.role === "lecturer") {
    const courseIds = await memberCourseIds(user);
    if (courseIds !== "all") {
      if (courseIds.length === 0) {
        res.json([]);
        return;
      }
      conditions.push(inArray(lmsAssignmentsTable.courseId, courseIds));
    }
  }

  const rows = await db
    .select({ submission: lmsSubmissionsTable })
    .from(lmsSubmissionsTable)
    .innerJoin(lmsAssignmentsTable, eq(lmsSubmissionsTable.assignmentId, lmsAssignmentsTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(lmsSubmissionsTable.id));
  res.json(rows.map((r) => formatSubmission(r.submission)));
});

router.get("/lms/assignments/:id/submissions", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(ListAssignmentSubmissionsParams, req.params);
  const assignment = await findAssignment(id);
  const course = await loadCourseForRead(user, assignment.courseId);

  const conditions: SQL[] = [eq(lmsSubmissionsTable.assignmentId, id)];
  if (user.role === "student") {
    conditions.push(eq(lmsSubmissionsTable.studentId, user.id));
  } else if (!canManageCourse(user, course)) {
    throw forbidden("Chỉ giảng viên phụ trách mới xem được bài nộp của khóa học này.");
  }

  const rows = await db
    .select()
    .from(lmsSubmissionsTable)
    .where(and(...conditions))
    .orderBy(desc(lmsSubmissionsTable.id));
  res.json(rows.map(formatSubmission));
});

router.post("/lms/assignments/:id/submissions", requireRole("student"), async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(SubmitAssignmentParams, req.params);
  const body = parseOr400(SubmitAssignmentBody, req.body);
  const assignment = await findAssignment(id);
  await loadCourseForRead(user, assignment.courseId);

  const textContent = body.textContent?.trim() || null;
  const fileUrl = body.fileUrl?.trim() || null;
  if (!textContent && !fileUrl) throw badRequest("Vui lòng đính kèm tệp hoặc nhập nội dung bài làm.");

  const [existing] = await db
    .select()
    .from(lmsSubmissionsTable)
    .where(and(eq(lmsSubmissionsTable.assignmentId, id), eq(lmsSubmissionsTable.studentId, user.id)))
    .limit(1);
  if (existing?.status === "graded") {
    throw conflict("Bài tập đã được chấm điểm, không thể nộp lại.");
  }

  const values = {
    fileUrl,
    fileName: fileUrl ? body.fileName ?? null : null,
    fileSize: fileUrl ? body.fileSize ?? null : null,
    textContent,
    status: "submitted",
    submittedAt: nowIso(),
  };

  const [saved] = existing
    ? await db.update(lmsSubmissionsTable).set(values).where(eq(lmsSubmissionsTable.id, existing.id)).returning()
    : await db
        .insert(lmsSubmissionsTable)
        .values({
          ...values,
          assignmentId: id,
          studentId: user.id,
          studentName: user.name,
          studentAvatar: getAvatarInitials(user.name),
        })
        .returning();

  await logActivity(`${user.name} vừa nộp bài tập`, assignment.title, "completion");
  res.status(201).json(formatSubmission(saved!));
});

router.patch("/lms/submissions/:id/grade", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(GradeSubmissionParams, req.params);
  const body = parseOr400(GradeSubmissionBody, req.body);

  const [submission] = await db.select().from(lmsSubmissionsTable).where(eq(lmsSubmissionsTable.id, id)).limit(1);
  if (!submission) throw notFound("Không tìm thấy bài nộp.");
  const assignment = await findAssignment(submission.assignmentId);
  await loadCourseForWrite(user, assignment.courseId);
  if (body.grade > assignment.maxPoints) {
    throw badRequest(`Điểm không được vượt quá ${assignment.maxPoints}.`);
  }

  const [updated] = await db
    .update(lmsSubmissionsTable)
    .set({
      status: "graded",
      grade: body.grade,
      feedback: body.feedback?.trim() || null,
      gradedBy: user.name,
      gradedAt: nowIso(),
    })
    .where(eq(lmsSubmissionsTable.id, id))
    .returning();

  await logActivity(`${user.name} vừa chấm điểm bài tập`, `${submission.studentName} · ${body.grade} điểm`, "quiz");
  res.json(formatSubmission(updated!));
});

export default router;
