import crypto from "crypto";
import { and, asc, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { Router } from "express";
import {
  db,
  lmsActivitiesTable,
  lmsCourseInvitesTable,
  lmsCoursesTable,
  lmsEnrollmentRequestsTable,
  lmsEnrollmentsTable,
  lmsLearnersTable,
  type LmsCourse,
  type LmsCourseInvite,
} from "../db";
import { canViewCourse, findCourse, isEnrolled, loadCourseForWrite } from "../lib/access";
import { badRequest, conflict, forbidden, HttpError, notFound, parseOr400 } from "../lib/http";
import { currentUser, requireRole } from "../middlewares/auth";
import {
  AcceptInviteLinkParams,
  CancelJoinRequestParams,
  CreateCourseInviteBody,
  CreateCourseInviteParams,
  DecideEnrollmentRequestBody,
  DecideEnrollmentRequestParams,
  GetInviteLinkParams,
  JoinCourseBody,
  JoinCourseParams,
  ListCourseInvitesParams,
  ListEnrollmentRequestsParams,
  RevokeCourseInviteParams,
} from "../schemas";

const router = Router();

/**
 * Ghi danh một học viên (dùng chung cho: tự tham gia, được duyệt, liên kết mời).
 * Trả về true nếu vừa ghi danh mới.
 */
export async function enrollStudent(course: Pick<LmsCourse, "id" | "title">, learnerId: number): Promise<boolean> {
  const inserted = await db
    .insert(lmsEnrollmentsTable)
    .values({ learnerId, courseId: course.id, status: "Đang học", completedLessonIds: [] })
    .onConflictDoNothing()
    .returning({ id: lmsEnrollmentsTable.id });
  if (inserted.length === 0) return false;

  await db
    .update(lmsCoursesTable)
    .set({ enrolled: sql`${lmsCoursesTable.enrolled} + 1` })
    .where(eq(lmsCoursesTable.id, course.id));
  await db.update(lmsLearnersTable).set({ activeCourse: course.title }).where(eq(lmsLearnersTable.id, learnerId));
  // Yêu cầu đang chờ (nếu có) coi như đã được giải quyết
  await db
    .update(lmsEnrollmentRequestsTable)
    .set({ status: "approved", decidedAt: new Date() })
    .where(
      and(
        eq(lmsEnrollmentRequestsTable.courseId, course.id),
        eq(lmsEnrollmentRequestsTable.learnerId, learnerId),
        eq(lmsEnrollmentRequestsTable.status, "pending"),
      ),
    );
  await db.insert(lmsActivitiesTable).values({
    title: "Học viên mới tham gia khóa học",
    detail: course.title,
    time: "Vừa xong",
    kind: "enrollment",
  });
  return true;
}

// ---------------------------------------------------------------------------
// HỌC VIÊN THAM GIA KHÓA CÔNG KHAI
// ---------------------------------------------------------------------------
router.post("/lms/courses/:id/join", requireRole("student"), async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(JoinCourseParams, req.params);
  const { message } = parseOr400(JoinCourseBody, req.body ?? {});
  const course = await findCourse(id);
  if (!(await canViewCourse(user, course))) throw notFound("Không tìm thấy khóa học.");

  if (await isEnrolled(user.id, id)) {
    res.json({ courseId: id, status: "enrolled", message: "Bạn đã tham gia khóa học này." });
    return;
  }
  if (course.visibility === "private") throw forbidden("Khóa học riêng tư: chỉ tham gia được qua lời mời của giảng viên.");
  if (course.status !== "Đang hoạt động") throw forbidden("Khóa học chưa mở đăng ký.");

  if (course.enrollmentMethod !== "approval") {
    await enrollStudent(course, user.id);
    res.json({ courseId: id, status: "enrolled", message: "Đã tham gia khóa học." });
    return;
  }

  await db
    .insert(lmsEnrollmentRequestsTable)
    .values({ courseId: id, learnerId: user.id, status: "pending", message: message?.trim() || null })
    .onConflictDoUpdate({
      target: [lmsEnrollmentRequestsTable.courseId, lmsEnrollmentRequestsTable.learnerId],
      set: { status: "pending", message: message?.trim() || null, createdAt: new Date(), decidedAt: null, decidedBy: null },
    });
  res.json({ courseId: id, status: "pending", message: "Đã gửi yêu cầu tham gia. Giảng viên sẽ duyệt sớm." });
});

router.delete("/lms/courses/:id/join", requireRole("student"), async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(CancelJoinRequestParams, req.params);
  const deleted = await db
    .delete(lmsEnrollmentRequestsTable)
    .where(
      and(
        eq(lmsEnrollmentRequestsTable.courseId, id),
        eq(lmsEnrollmentRequestsTable.learnerId, user.id),
        eq(lmsEnrollmentRequestsTable.status, "pending"),
      ),
    )
    .returning({ id: lmsEnrollmentRequestsTable.id });
  if (deleted.length === 0) throw notFound("Không có yêu cầu nào đang chờ duyệt.");
  res.json({ courseId: id, status: "none", message: "Đã rút yêu cầu tham gia." });
});

// ---------------------------------------------------------------------------
// GIẢNG VIÊN DUYỆT YÊU CẦU
// ---------------------------------------------------------------------------
function selectRequests() {
  return db
    .select({
      request: lmsEnrollmentRequestsTable,
      learnerName: lmsLearnersTable.name,
      learnerEmail: lmsLearnersTable.email,
      learnerTeam: lmsLearnersTable.team,
    })
    .from(lmsEnrollmentRequestsTable)
    .innerJoin(lmsLearnersTable, eq(lmsEnrollmentRequestsTable.learnerId, lmsLearnersTable.id));
}

function formatRequest(row: Awaited<ReturnType<typeof selectRequests>>[number]) {
  return {
    id: row.request.id,
    courseId: row.request.courseId,
    learnerId: row.request.learnerId,
    learnerName: row.learnerName,
    learnerEmail: row.learnerEmail,
    learnerTeam: row.learnerTeam,
    message: row.request.message ?? null,
    status: row.request.status as "pending" | "approved" | "rejected",
    createdAt: new Date(row.request.createdAt).toISOString(),
  };
}

router.get("/lms/courses/:id/enrollment-requests", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(ListEnrollmentRequestsParams, req.params);
  await loadCourseForWrite(user, id);
  const rows = await selectRequests()
    .where(and(eq(lmsEnrollmentRequestsTable.courseId, id), eq(lmsEnrollmentRequestsTable.status, "pending")))
    .orderBy(asc(lmsEnrollmentRequestsTable.createdAt));
  res.json(rows.map(formatRequest));
});

router.post("/lms/enrollment-requests/:id/decision", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(DecideEnrollmentRequestParams, req.params);
  const { decision } = parseOr400(DecideEnrollmentRequestBody, req.body);
  const [request] = await db.select().from(lmsEnrollmentRequestsTable).where(eq(lmsEnrollmentRequestsTable.id, id)).limit(1);
  if (!request) throw notFound("Không tìm thấy yêu cầu.");
  const course = await loadCourseForWrite(user, request.courseId);
  if (request.status !== "pending") throw conflict("Yêu cầu này đã được xử lý.");

  if (decision === "approve") {
    await enrollStudent(course, request.learnerId);
  }
  await db
    .update(lmsEnrollmentRequestsTable)
    .set({ status: decision === "approve" ? "approved" : "rejected", decidedBy: user.id, decidedAt: new Date() })
    .where(eq(lmsEnrollmentRequestsTable.id, id));

  const [row] = await selectRequests().where(eq(lmsEnrollmentRequestsTable.id, id)).limit(1);
  res.json(formatRequest(row!));
});

// ---------------------------------------------------------------------------
// LIÊN KẾT MỜI (khóa riêng tư; dùng được cho cả khóa công khai)
// ---------------------------------------------------------------------------
function inviteProblem(invite: LmsCourseInvite, now = new Date()): string | null {
  if (invite.revokedAt) return "Liên kết mời đã bị thu hồi.";
  if (invite.expiresAt && new Date(invite.expiresAt) <= now) return "Liên kết mời đã hết hạn.";
  if (invite.maxUses !== null && invite.uses >= invite.maxUses) return "Liên kết mời đã hết lượt sử dụng.";
  return null;
}

function formatInvite(invite: LmsCourseInvite) {
  return {
    id: invite.id,
    courseId: invite.courseId,
    token: invite.token,
    expiresAt: invite.expiresAt ? new Date(invite.expiresAt).toISOString() : null,
    maxUses: invite.maxUses ?? null,
    uses: invite.uses,
    revoked: Boolean(invite.revokedAt),
    active: inviteProblem(invite) === null,
    createdAt: new Date(invite.createdAt).toISOString(),
  };
}

async function findInviteByToken(token: string) {
  const [invite] = await db.select().from(lmsCourseInvitesTable).where(eq(lmsCourseInvitesTable.token, token)).limit(1);
  if (!invite) throw notFound("Liên kết mời không tồn tại.");
  return invite;
}

router.get("/lms/courses/:id/invites", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(ListCourseInvitesParams, req.params);
  await loadCourseForWrite(user, id);
  const invites = await db
    .select()
    .from(lmsCourseInvitesTable)
    .where(eq(lmsCourseInvitesTable.courseId, id))
    .orderBy(desc(lmsCourseInvitesTable.createdAt));
  res.json(invites.map(formatInvite));
});

router.post("/lms/courses/:id/invites", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(CreateCourseInviteParams, req.params);
  const body = parseOr400(CreateCourseInviteBody, req.body);
  await loadCourseForWrite(user, id);

  let expiresAt: Date | null = null;
  if (body.expiresAt) {
    expiresAt = new Date(body.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) throw badRequest("Hạn dùng phải ở tương lai.");
  }
  const [invite] = await db
    .insert(lmsCourseInvitesTable)
    .values({
      courseId: id,
      token: crypto.randomBytes(18).toString("base64url"),
      expiresAt,
      maxUses: body.maxUses ?? null,
      createdBy: user.id,
    })
    .returning();
  res.status(201).json(formatInvite(invite!));
});

router.delete("/lms/invites/:id", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(RevokeCourseInviteParams, req.params);
  const [invite] = await db.select().from(lmsCourseInvitesTable).where(eq(lmsCourseInvitesTable.id, id)).limit(1);
  if (!invite) throw notFound("Không tìm thấy liên kết mời.");
  await loadCourseForWrite(user, invite.courseId);
  await db.update(lmsCourseInvitesTable).set({ revokedAt: new Date() }).where(eq(lmsCourseInvitesTable.id, id));
  res.json({ message: "Đã thu hồi liên kết mời." });
});

router.get("/lms/invite-links/:token", async (req, res) => {
  const user = currentUser(req);
  const { token } = parseOr400(GetInviteLinkParams, req.params);
  const invite = await findInviteByToken(token);
  const [row] = await db
    .select({ course: lmsCoursesTable, instructorName: lmsLearnersTable.name })
    .from(lmsCoursesTable)
    .leftJoin(lmsLearnersTable, eq(lmsCoursesTable.instructorId, lmsLearnersTable.id))
    .where(eq(lmsCoursesTable.id, invite.courseId))
    .limit(1);
  if (!row) throw notFound("Khóa học không còn tồn tại.");
  const alreadyEnrolled = user.role === "student" && (await isEnrolled(user.id, invite.courseId));
  const reason =
    user.role !== "student" ? "Liên kết mời dành cho tài khoản học viên." : alreadyEnrolled ? null : inviteProblem(invite);
  res.json({
    courseId: row.course.id,
    courseTitle: row.course.title,
    courseDescription: row.course.description,
    instructorName: row.instructorName ?? row.course.instructorName,
    valid: reason === null,
    reason,
    alreadyEnrolled,
  });
});

router.post("/lms/invite-links/:token", requireRole("student"), async (req, res) => {
  const user = currentUser(req);
  const { token } = parseOr400(AcceptInviteLinkParams, req.params);
  const invite = await findInviteByToken(token);
  const course = await findCourse(invite.courseId);

  if (await isEnrolled(user.id, course.id)) {
    res.json({ courseId: course.id, status: "enrolled", message: "Bạn đã tham gia khóa học này." });
    return;
  }

  // Dùng một lượt mời (nguyên tử): chỉ thành công khi chưa thu hồi, chưa hết hạn, còn lượt
  const claimed = await db
    .update(lmsCourseInvitesTable)
    .set({ uses: sql`${lmsCourseInvitesTable.uses} + 1` })
    .where(
      and(
        eq(lmsCourseInvitesTable.id, invite.id),
        isNull(lmsCourseInvitesTable.revokedAt),
        or(isNull(lmsCourseInvitesTable.expiresAt), gt(lmsCourseInvitesTable.expiresAt, new Date())),
        or(isNull(lmsCourseInvitesTable.maxUses), lt(lmsCourseInvitesTable.uses, lmsCourseInvitesTable.maxUses)),
      ),
    )
    .returning({ id: lmsCourseInvitesTable.id });
  if (claimed.length === 0) throw new HttpError(410, inviteProblem(invite) ?? "Liên kết mời không còn hiệu lực.");

  await enrollStudent(course, user.id);
  res.json({ courseId: course.id, status: "enrolled", message: `Đã tham gia khóa học "${course.title}".` });
});

export default router;
