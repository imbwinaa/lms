import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  db,
  lmsActivitiesTable,
  lmsBadgesTable,
  lmsCertificatesTable,
  lmsCoursesTable,
  lmsEnrollmentsTable,
  lmsLearnersTable,
  lmsLearningPathsTable,
  lmsXapiEventsTable,
  type LmsCourse,
} from "../db";
import { findCourse, isEnrolled, loadCourseForWrite } from "../lib/access";
import { toPublicLearner } from "../lib/auth";
import { assertSafeUrl } from "../lib/content";
import { badRequest, conflict, forbidden, notFound, parseOr400 } from "../lib/http";
import { currentUser, requireRole } from "../middlewares/auth";
import {
  AutoEnrollLearnersBody,
  AutoEnrollLearnersResponse,
  CreateLmsCourseBody,
  DeleteLmsCourseParams,
  GetLmsCourseParams,
  GetLmsDashboardResponse,
  GetLmsLeaderboardResponse,
  ListLmsBadgesResponse,
  ListCourseLearnersParams,
  ListLmsCertificatesResponse,
  ListLmsLearningPathsResponse,
  ListLmsPluginsResponse,
  RecordXapiEventBody,
  RecordXapiEventResponse,
  UpdateLmsCourseBody,
  UpdateLmsCourseParams,
} from "../schemas";

const router: IRouter = Router();
const courseAccents = ["teal", "violet", "amber", "blue", "rose"];

// ---------------------------------------------------------------------------
// TỔNG QUAN
// ---------------------------------------------------------------------------
router.get("/lms/dashboard", async (_req, res) => {
  const [activeCourseCount] = await db
    .select({ value: count() })
    .from(lmsCoursesTable)
    .where(eq(lmsCoursesTable.status, "Đang hoạt động"));
  const [learnerCount] = await db.select({ value: count() }).from(lmsLearnersTable);
  const [averageProgress] = await db
    .select({ value: sql<number>`coalesce(avg(${lmsLearnersTable.progress}), 0)` })
    .from(lmsLearnersTable);
  const [pendingCount] = await db
    .select({ value: count() })
    .from(lmsCertificatesTable)
    .where(eq(lmsCertificatesTable.status, "Chờ cấp"));
  const recentActivity = await db.select().from(lmsActivitiesTable).orderBy(desc(lmsActivitiesTable.id)).limit(6);

  const startDate = new Date();
  startDate.setUTCHours(0, 0, 0, 0);
  startDate.setUTCDate(startDate.getUTCDate() - 6);
  const events = await db
    .select({
      learnerId: lmsXapiEventsTable.learnerId,
      verb: lmsXapiEventsTable.verb,
      timestamp: lmsXapiEventsTable.timestamp,
    })
    .from(lmsXapiEventsTable)
    .where(gte(lmsXapiEventsTable.timestamp, startDate.toISOString()));
  const eventsByDate = new Map<string, { learners: Set<number>; completed: number }>();
  for (const event of events) {
    const dateKey = event.timestamp.slice(0, 10);
    const day = eventsByDate.get(dateKey) ?? { learners: new Set<number>(), completed: 0 };
    day.learners.add(event.learnerId);
    if (event.verb.includes("completed")) day.completed += 1;
    eventsByDate.set(dateKey, day);
  }
  const weekdayLabels = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const weeklyEngagement = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + index);
    const day = eventsByDate.get(date.toISOString().slice(0, 10));
    return {
      day: weekdayLabels[date.getUTCDay()]!,
      active: day?.learners.size ?? 0,
      completed: day?.completed ?? 0,
    };
  });

  res.json(
    GetLmsDashboardResponse.parse({
      activeCourses: Number(activeCourseCount?.value ?? 0),
      totalLearners: Number(learnerCount?.value ?? 0),
      completionRate: Math.round(Number(averageProgress?.value ?? 0)),
      pendingCertificates: Number(pendingCount?.value ?? 0),
      weeklyEngagement,
      recentActivity,
    }),
  );
});

// ---------------------------------------------------------------------------
// KHÓA HỌC
// ---------------------------------------------------------------------------
type CourseRow = { course: LmsCourse; instructor: { name: string } | null };

function formatCourse({ course, instructor }: CourseRow) {
  return {
    ...course,
    instructorId: course.instructorId ?? null,
    instructorName: instructor?.name ?? course.instructorName,
    mediaUrl: course.mediaUrl ?? null,
    mediaType: course.mediaType ?? null,
    coverImageUrl: course.coverImageUrl ?? null,
  };
}

function selectCourses() {
  return db
    .select({ course: lmsCoursesTable, instructor: { name: lmsLearnersTable.name } })
    .from(lmsCoursesTable)
    .leftJoin(lmsLearnersTable, eq(lmsCoursesTable.instructorId, lmsLearnersTable.id));
}

async function getCourseResponse(id: number) {
  const [row] = await selectCourses().where(eq(lmsCoursesTable.id, id)).limit(1);
  if (!row) throw notFound("Không tìm thấy khóa học.");
  return formatCourse(row);
}

/** Admin chỉ định giảng viên phụ trách: phải là lecturer hoặc admin */
async function resolveInstructor(instructorId: number) {
  const [instructor] = await db.select().from(lmsLearnersTable).where(eq(lmsLearnersTable.id, instructorId)).limit(1);
  if (!instructor || instructor.role === "student") throw badRequest("Giảng viên phụ trách không hợp lệ.");
  return instructor;
}

function isUniqueViolation(error: unknown) {
  const code = typeof error === "object" && error !== null ? String((error as { code?: unknown }).code) : "";
  return code.startsWith("SQLITE_CONSTRAINT_UNIQUE");
}

router.get("/lms/courses", async (req, res) => {
  const user = currentUser(req);
  let rows = await selectCourses().orderBy(desc(lmsCoursesTable.id));
  if (user.role === "student") {
    const enrolled = await db
      .select({ courseId: lmsEnrollmentsTable.courseId })
      .from(lmsEnrollmentsTable)
      .where(eq(lmsEnrollmentsTable.learnerId, user.id));
    const enrolledIds = new Set(enrolled.map((e) => e.courseId));
    rows = rows.filter((r) => r.course.status === "Đang hoạt động" || enrolledIds.has(r.course.id));
  }
  res.json(rows.map(formatCourse));
});

router.get("/lms/courses/:id", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(GetLmsCourseParams, req.params);
  const course = await getCourseResponse(id);
  if (user.role === "student" && course.status !== "Đang hoạt động" && !(await isEnrolled(user.id, id))) {
    throw notFound("Không tìm thấy khóa học.");
  }
  res.json(course);
});

router.post("/lms/courses", requireRole("lecturer", "admin"), async (req, res) => {
  const user = currentUser(req);
  // "lessons" bị bỏ qua: số bài học được đếm từ các bài đã xuất bản trong studio
  const {
    instructorId: requestedInstructorId,
    mediaUrl,
    mediaType,
    coverImageUrl,
    lessons: _ignoredLessons,
    ...fields
  } = parseOr400(CreateLmsCourseBody, req.body);

  const instructor =
    user.role === "admin" && requestedInstructorId !== undefined
      ? await resolveInstructor(requestedInstructorId)
      : { id: user.id, name: user.name };

  try {
    const [course] = await db
      .insert(lmsCoursesTable)
      .values({
        ...fields,
        title: fields.title.trim(),
        status: "Đang hoạt động",
        enrolled: 0,
        progress: 0,
        lessons: 0,
        accent: courseAccents[fields.title.length % courseAccents.length]!,
        instructorId: instructor.id,
        instructorName: instructor.name,
        mediaUrl: assertSafeUrl(mediaUrl, "Đường dẫn media"),
        mediaType: mediaType ?? "video",
        coverImageUrl: assertSafeUrl(coverImageUrl, "Ảnh bìa"),
      })
      .returning();
    res.status(201).json(await getCourseResponse(course!.id));
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict("Đã có khóa học trùng tên.");
    throw error;
  }
});

router.patch("/lms/courses/:id", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(UpdateLmsCourseParams, req.params);
  const {
    instructorId: requestedInstructorId,
    lessons: _ignoredLessons,
    mediaUrl,
    coverImageUrl,
    ...fields
  } = parseOr400(UpdateLmsCourseBody, req.body);
  await loadCourseForWrite(user, id);

  const update: Partial<typeof lmsCoursesTable.$inferInsert> = { ...fields };
  if (mediaUrl !== undefined) update.mediaUrl = assertSafeUrl(mediaUrl, "Đường dẫn media");
  if (coverImageUrl !== undefined) update.coverImageUrl = assertSafeUrl(coverImageUrl, "Ảnh bìa");
  if (requestedInstructorId !== undefined) {
    if (user.role !== "admin") throw forbidden("Chỉ quản trị viên mới được đổi giảng viên phụ trách.");
    const instructor = await resolveInstructor(requestedInstructorId);
    update.instructorId = instructor.id;
    update.instructorName = instructor.name;
  }
  if (Object.keys(update).length > 0) {
    try {
      await db.update(lmsCoursesTable).set(update).where(eq(lmsCoursesTable.id, id));
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict("Đã có khóa học trùng tên.");
      throw error;
    }
  }
  res.json(await getCourseResponse(id));
});

router.delete("/lms/courses/:id", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(DeleteLmsCourseParams, req.params);
  const course = await loadCourseForWrite(user, id);
  await db.delete(lmsCoursesTable).where(eq(lmsCoursesTable.id, id));
  await db.insert(lmsActivitiesTable).values({
    title: `${user.name} đã xóa khóa học`,
    detail: course.title,
    time: "Vừa xong",
    kind: "enrollment",
  });
  res.json({ message: "Đã xóa khóa học." });
});

router.get("/lms/courses/:id/learners", async (req, res) => {
  const user = currentUser(req);
  const { id } = parseOr400(ListCourseLearnersParams, req.params);
  await loadCourseForWrite(user, id);
  const rows = await db
    .select({ learner: lmsLearnersTable })
    .from(lmsEnrollmentsTable)
    .innerJoin(lmsLearnersTable, eq(lmsEnrollmentsTable.learnerId, lmsLearnersTable.id))
    .where(eq(lmsEnrollmentsTable.courseId, id))
    .orderBy(desc(lmsLearnersTable.points));
  res.json(rows.map((r) => toPublicLearner(r.learner)));
});

// ---------------------------------------------------------------------------
// LỘ TRÌNH & GHI DANH
// ---------------------------------------------------------------------------
router.get("/lms/learning-paths", async (_req, res) => {
  const paths = await db.select().from(lmsLearningPathsTable).orderBy(desc(lmsLearningPathsTable.learners));
  res.json(ListLmsLearningPathsResponse.parse(paths));
});

router.post("/lms/enrollments/auto-enroll", async (req, res) => {
  const user = currentUser(req);
  const { courseId, learnerIds } = parseOr400(AutoEnrollLearnersBody, req.body);
  const course = await loadCourseForWrite(user, courseId);
  const uniqueIds = [...new Set(learnerIds)];
  const learners = await db
    .select()
    .from(lmsLearnersTable)
    .where(and(inArray(lmsLearnersTable.id, uniqueIds), eq(lmsLearnersTable.role, "student")));
  if (learners.length !== uniqueIds.length) {
    throw notFound("Không tìm thấy học viên (chỉ ghi danh được tài khoản học viên).");
  }

  // better-sqlite3: giao dịch phải đồng bộ (không dùng async/await bên trong)
  const result = db.transaction((tx) => {
    const existing = tx
      .select({ learnerId: lmsEnrollmentsTable.learnerId })
      .from(lmsEnrollmentsTable)
      .where(and(eq(lmsEnrollmentsTable.courseId, courseId), inArray(lmsEnrollmentsTable.learnerId, uniqueIds)))
      .all();
    const existingIds = new Set(existing.map((item) => item.learnerId));
    const newLearners = learners.filter((learner) => !existingIds.has(learner.id));
    if (newLearners.length > 0) {
      tx.insert(lmsEnrollmentsTable)
        .values(
          newLearners.map((learner) => ({
            learnerId: learner.id,
            courseId,
            status: "Đang học",
            completedLessonIds: [],
          })),
        )
        .run();
      tx.update(lmsCoursesTable)
        .set({ enrolled: sql`${lmsCoursesTable.enrolled} + ${newLearners.length}` })
        .where(eq(lmsCoursesTable.id, courseId))
        .run();
      tx.update(lmsLearnersTable)
        .set({ activeCourse: course.title })
        .where(inArray(lmsLearnersTable.id, newLearners.map((item) => item.id)))
        .run();
      tx.insert(lmsActivitiesTable)
        .values({
          title: `${newLearners.length} học viên vừa được ghi danh`,
          detail: course.title,
          time: "Vừa xong",
          kind: "enrollment",
        })
        .run();
    }
    return {
      enrolled: newLearners.length,
      skipped: learners.length - newLearners.length,
      message:
        newLearners.length > 0
          ? `Đã tự động ghi danh ${newLearners.length} học viên vào khóa học.`
          : "Tất cả học viên đã có trong khóa học này.",
    };
  });
  res.status(201).json(AutoEnrollLearnersResponse.parse(result));
});

// ---------------------------------------------------------------------------
// CHỨNG CHỈ, XẾP HẠNG, HUY HIỆU, PLUGIN
// ---------------------------------------------------------------------------
router.get("/lms/certificates", async (_req, res) => {
  const certificates = await db.select().from(lmsCertificatesTable).orderBy(desc(lmsCertificatesTable.id));
  res.json(ListLmsCertificatesResponse.parse(certificates));
});

router.get("/lms/leaderboard", async (_req, res) => {
  const learners = await db
    .select()
    .from(lmsLearnersTable)
    .where(eq(lmsLearnersTable.role, "student"))
    .orderBy(desc(lmsLearnersTable.points));
  const badgeRows = await db
    .select({ learnerId: lmsBadgesTable.learnerId, badgeCount: count() })
    .from(lmsBadgesTable)
    .groupBy(lmsBadgesTable.learnerId);
  const badgeCounts = new Map(badgeRows.map((row) => [row.learnerId, Number(row.badgeCount)]));
  const response = learners.map((learner, index) => ({
    id: learner.id,
    name: learner.name,
    team: learner.team,
    points: learner.points,
    streak: learner.streak,
    badges: badgeCounts.get(learner.id) ?? 0,
    rank: index + 1,
  }));
  res.json(GetLmsLeaderboardResponse.parse(response));
});

router.get("/lms/badges", async (_req, res) => {
  const rows = await db
    .select({
      id: lmsBadgesTable.id,
      learner: lmsLearnersTable.name,
      name: lmsBadgesTable.name,
      description: lmsBadgesTable.description,
      icon: lmsBadgesTable.icon,
      awardedAt: lmsBadgesTable.awardedAt,
    })
    .from(lmsBadgesTable)
    .innerJoin(lmsLearnersTable, eq(lmsBadgesTable.learnerId, lmsLearnersTable.id))
    .orderBy(desc(lmsBadgesTable.id));
  res.json(ListLmsBadgesResponse.parse(rows));
});

router.get("/lms/plugins", (_req, res) => {
  const plugins = [
    {
      id: 1,
      name: "H5P Interactive",
      description: "Video tương tác, câu hỏi nhúng và hoạt động kéo thả.",
      standard: "H5P",
      status: "Đang bật",
      icon: "puzzle",
    },
    {
      id: 2,
      name: "SCORM Player",
      description: "Theo dõi tiến độ và điểm số của gói học SCORM.",
      standard: "SCORM 1.2",
      status: "Sẵn sàng",
      icon: "layers",
    },
    {
      id: 3,
      name: "xAPI Learning Record Store",
      description: "Ghi nhận hoạt động học tập theo chuẩn xAPI.",
      standard: "xAPI",
      status: "Đang bật",
      icon: "activity",
    },
  ];
  res.json(ListLmsPluginsResponse.parse(plugins));
});

// ---------------------------------------------------------------------------
// xAPI (luôn ghi cho người dùng hiện tại). Tiến độ bài học: xem routes/studio.ts
// ---------------------------------------------------------------------------
router.post("/lms/xapi/events", async (req, res) => {
  const user = currentUser(req);
  const body = parseOr400(RecordXapiEventBody, req.body);
  const [event] = await db
    .insert(lmsXapiEventsTable)
    .values({ ...body, learnerId: user.id, timestamp: new Date().toISOString() })
    .returning();
  await db.insert(lmsActivitiesTable).values({
    title: `Đã ghi nhận sự kiện xAPI: ${body.verb}`,
    detail: body.objectId,
    time: "Vừa xong",
    kind: "quiz",
  });
  res.status(201).json(RecordXapiEventResponse.parse(event));
});

export default router;
