import crypto from "crypto";
import { and, asc, eq, gte, inArray, lt, sql, type SQL } from "drizzle-orm";
import { Router } from "express";
import {
  db,
  lmsClassSessionsTable,
  lmsCoursesTable,
  lmsEnrollmentsTable,
  lmsLessonsTable,
  type LmsClassSession,
  type LmsCourse,
} from "../db";
import { canManageCourse, canViewCourse, findCourse, isEnrolled, loadCourseForWrite } from "../lib/access";
import type { AuthUser } from "../lib/auth";
import { badRequest, notFound, parseOr400 } from "../lib/http";
import { currentUser } from "../middlewares/auth";
import {
  CreateCourseSessionsBody,
  CreateCourseSessionsParams,
  DeleteCourseSessionParams,
  DeleteCourseSessionQueryParams,
  ListCourseSessionsParams,
  ListCourseSessionsQueryParams,
  ListUpcomingSessionsQueryParams,
  UpdateCourseSessionBody,
  UpdateCourseSessionParams,
} from "../schemas";
import { assertLessonInCourse } from "./studio";

const router = Router();
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Liên kết họp: chỉ https; nhận diện Teams / Google Meet / Zoom để hiển thị biểu tượng
// ---------------------------------------------------------------------------
function parseMeetingUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw badRequest("Liên kết buổi học không hợp lệ.");
  }
  if (url.protocol !== "https:") throw badRequest("Liên kết buổi học phải bắt đầu bằng https://");
  return url.toString();
}

export function meetingPlatform(value: string): "teams" | "meet" | "zoom" | "other" {
  try {
    const host = new URL(value).hostname.toLowerCase();
    const is = (domain: string) => host === domain || host.endsWith(`.${domain}`);
    if (is("teams.microsoft.com") || is("teams.live.com")) return "teams";
    if (is("meet.google.com")) return "meet";
    if (is("zoom.us") || is("zoom.com")) return "zoom";
  } catch {
    // giữ "other"
  }
  return "other";
}

function parseStart(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest("Thời gian bắt đầu không hợp lệ.");
  return date;
}

/** Ai được thấy liên kết họp: giảng viên phụ trách, admin, học viên đã ghi danh */
async function linkAccess(user: AuthUser, course: Pick<LmsCourse, "id" | "instructorId">) {
  if (canManageCourse(user, course)) return true;
  return user.role === "student" && (await isEnrolled(user.id, course.id));
}

type SessionRow = { session: LmsClassSession; courseTitle: string; lessonTitle: string | null };

function formatSession({ session, courseTitle, lessonTitle }: SessionRow, canJoin: boolean) {
  const startsAt = new Date(session.startsAt);
  return {
    id: session.id,
    courseId: session.courseId,
    courseTitle,
    lessonId: session.lessonId ?? null,
    lessonTitle,
    title: session.title?.trim() || courseTitle,
    notes: session.notes ?? null,
    meetingUrl: canJoin ? session.meetingUrl : null,
    platform: meetingPlatform(session.meetingUrl),
    startsAt: startsAt.toISOString(),
    endsAt: new Date(startsAt.getTime() + session.durationMinutes * 60_000).toISOString(),
    durationMinutes: session.durationMinutes,
    seriesId: session.seriesId ?? null,
    canJoin,
  };
}

function selectSessions() {
  return db
    .select({ session: lmsClassSessionsTable, courseTitle: lmsCoursesTable.title, lessonTitle: lmsLessonsTable.title })
    .from(lmsClassSessionsTable)
    .innerJoin(lmsCoursesTable, eq(lmsClassSessionsTable.courseId, lmsCoursesTable.id))
    .leftJoin(lmsLessonsTable, eq(lmsClassSessionsTable.lessonId, lmsLessonsTable.id));
}

/** Thời điểm kết thúc của buổi học (tính trong SQL) */
const endsAtSql = sql`(${lmsClassSessionsTable.startsAt} + ${lmsClassSessionsTable.durationMinutes} * interval '1 minute')`;
/**
 * "Buổi học chưa kết thúc tính tới thời điểm `at`".
 * Truyền chuỗi ISO + ép kiểu timestamptz: driver `postgres` (Supabase) không nhận
 * đối tượng Date trong mẫu sql thô (PGlite thì nhận, nên kiểm thử không bắt được).
 */
const endsAfter = (at: Date) => sql`${endsAtSql} >= ${at.toISOString()}::timestamptz`;

async function findSession(id: number): Promise<LmsClassSession> {
  const [session] = await db.select().from(lmsClassSessionsTable).where(eq(lmsClassSessionsTable.id, id)).limit(1);
  if (!session) throw notFound("Không tìm thấy buổi học.");
  return session;
}

async function getSessionResponse(user: AuthUser, id: number) {
  const [row] = await selectSessions().where(eq(lmsClassSessionsTable.id, id)).limit(1);
  if (!row) throw notFound("Không tìm thấy buổi học.");
  const course = await findCourse(row.session.courseId);
  return formatSession(row, await linkAccess(user, course));
}

// ---------------------------------------------------------------------------
// LỊCH HỌC CỦA KHÓA HỌC
// ---------------------------------------------------------------------------
router.get("/lms/courses/:id/sessions", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(ListCourseSessionsParams, req.params);
  const { from, to } = parseOr400(ListCourseSessionsQueryParams, req.query);
  const course = await findCourse(id);
  if (!(await canViewCourse(user, course))) throw notFound("Không tìm thấy khóa học.");

  const conditions: SQL[] = [eq(lmsClassSessionsTable.courseId, id)];
  if (from) conditions.push(endsAfter(new Date(from)));
  if (to) conditions.push(lt(lmsClassSessionsTable.startsAt, new Date(to)));

  const rows = await selectSessions()
    .where(and(...conditions))
    .orderBy(asc(lmsClassSessionsTable.startsAt), asc(lmsClassSessionsTable.id));
  const canJoin = await linkAccess(user, course);
  res.json(rows.map((row) => formatSession(row, canJoin)));
});

router.post("/lms/courses/:id/sessions", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(CreateCourseSessionsParams, req.params);
  const body = parseOr400(CreateCourseSessionsBody, req.body);
  await loadCourseForWrite(user, id);

  const meetingUrl = parseMeetingUrl(body.meetingUrl);
  const start = parseStart(body.startsAt);
  if (body.lessonId !== undefined && body.lessonId !== null) await assertLessonInCourse(body.lessonId, id);

  const weeks = body.repeatWeeks ?? 1;
  const seriesId = weeks > 1 ? crypto.randomUUID() : null;
  const inserted = await db
    .insert(lmsClassSessionsTable)
    .values(
      Array.from({ length: weeks }, (_, week) => ({
        courseId: id,
        lessonId: body.lessonId ?? null,
        title: body.title?.trim() || null,
        notes: body.notes?.trim() || null,
        meetingUrl,
        startsAt: new Date(start.getTime() + week * WEEK_MS),
        durationMinutes: body.durationMinutes,
        seriesId,
        createdBy: user.id,
      })),
    )
    .returning({ id: lmsClassSessionsTable.id });

  const rows = await selectSessions()
    .where(inArray(lmsClassSessionsTable.id, inserted.map((r) => r.id)))
    .orderBy(asc(lmsClassSessionsTable.startsAt));
  res.status(201).json(rows.map((row) => formatSession(row, true)));
});

// ---------------------------------------------------------------------------
// BUỔI HỌC SẮP TỚI (bảng điều khiển)
// ---------------------------------------------------------------------------
router.get("/lms/sessions/upcoming", async (req, res) => {
  const user = currentUser(req);
  const { limit } = parseOr400(ListUpcomingSessionsQueryParams, req.query);

  let courseIds: number[] | "all" = "all";
  if (user.role === "student") {
    const rows = await db
      .select({ id: lmsEnrollmentsTable.courseId })
      .from(lmsEnrollmentsTable)
      .where(eq(lmsEnrollmentsTable.learnerId, user.id));
    courseIds = rows.map((r) => r.id);
  } else if (user.role === "lecturer") {
    const rows = await db
      .select({ id: lmsCoursesTable.id })
      .from(lmsCoursesTable)
      .where(eq(lmsCoursesTable.instructorId, user.id));
    courseIds = rows.map((r) => r.id);
  }
  if (courseIds !== "all" && courseIds.length === 0) {
    res.json([]);
    return;
  }

  const conditions: SQL[] = [endsAfter(new Date())];
  if (courseIds !== "all") conditions.push(inArray(lmsClassSessionsTable.courseId, courseIds));
  const rows = await selectSessions()
    .where(and(...conditions))
    .orderBy(asc(lmsClassSessionsTable.startsAt))
    .limit(limit ?? 5);
  // Đã lọc theo khóa học của chính người dùng -> luôn được tham gia
  res.json(rows.map((row) => formatSession(row, true)));
});

// ---------------------------------------------------------------------------
// SỬA / HỦY BUỔI HỌC
// ---------------------------------------------------------------------------
router.patch("/lms/sessions/:id", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(UpdateCourseSessionParams, req.params);
  const body = parseOr400(UpdateCourseSessionBody, req.body);
  const session = await findSession(id);
  await loadCourseForWrite(user, session.courseId);

  const changes: Partial<typeof lmsClassSessionsTable.$inferInsert> = {};
  if (body.title !== undefined) changes.title = body.title.trim() || null;
  if (body.notes !== undefined) changes.notes = body.notes.trim() || null;
  if (body.meetingUrl !== undefined) changes.meetingUrl = parseMeetingUrl(body.meetingUrl);
  if (body.startsAt !== undefined) changes.startsAt = parseStart(body.startsAt);
  if (body.durationMinutes !== undefined) changes.durationMinutes = body.durationMinutes;
  if (body.lessonId !== undefined) {
    if (body.lessonId !== null) await assertLessonInCourse(body.lessonId, session.courseId);
    changes.lessonId = body.lessonId;
  }

  if (Object.keys(changes).length > 0) {
    await db
      .update(lmsClassSessionsTable)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(lmsClassSessionsTable.id, id));
  }
  res.json(await getSessionResponse(user, id));
});

router.delete("/lms/sessions/:id", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(DeleteCourseSessionParams, req.params);
  const { scope } = parseOr400(DeleteCourseSessionQueryParams, req.query);
  const session = await findSession(id);
  await loadCourseForWrite(user, session.courseId);

  const deleted =
    scope === "following" && session.seriesId
      ? await db
          .delete(lmsClassSessionsTable)
          .where(
            and(
              eq(lmsClassSessionsTable.seriesId, session.seriesId),
              gte(lmsClassSessionsTable.startsAt, session.startsAt),
            ),
          )
          .returning({ id: lmsClassSessionsTable.id })
      : await db
          .delete(lmsClassSessionsTable)
          .where(eq(lmsClassSessionsTable.id, id))
          .returning({ id: lmsClassSessionsTable.id });

  res.json({
    deleted: deleted.length,
    message: deleted.length > 1 ? `Đã hủy ${deleted.length} buổi học.` : "Đã hủy buổi học.",
  });
});

export default router;
