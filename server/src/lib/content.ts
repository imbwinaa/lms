import { and, count, eq, inArray, sql } from "drizzle-orm";
import sanitizeHtml from "sanitize-html";
import {
  db,
  lmsActivitiesTable,
  lmsBadgesTable,
  lmsCertificatesTable,
  lmsCoursesTable,
  lmsEnrollmentsTable,
  lmsLearnersTable,
  lmsLessonCompletionsTable,
  lmsLessonsTable,
  type LmsCourse,
  type LmsLesson,
} from "../db";
import { badRequest } from "./http";

// ---------------------------------------------------------------------------
// Làm sạch HTML bài học (giáo viên soạn, học viên xem) — chống XSS
// ---------------------------------------------------------------------------
const SAFE_URL = /^(https?:\/\/|\/uploads\/|\/api\/upload\/r2\/)/i;

export function sanitizeLessonHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "hr", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "mark", "sub", "sup",
      "ul", "ol", "li", "blockquote", "code", "pre", "a", "img", "figure", "figcaption",
      "table", "thead", "tbody", "tr", "th", "td",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
      "*": ["style"],
    },
    allowedStyles: {
      "*": { "text-align": [/^(left|right|center|justify)$/] },
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" },
      }),
    },
  }).trim();
}

/** URL media/ảnh bìa: chỉ http(s) hoặc tệp đã tải lên — chặn javascript:, data:... */
export function assertSafeUrl(url: string | null | undefined, field: string): string | null {
  if (url === null || url === undefined) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (!SAFE_URL.test(trimmed)) throw badRequest(`${field} phải là đường dẫn http(s) hoặc tệp đã tải lên.`);
  return trimmed;
}

// ---------------------------------------------------------------------------
// Số bài học đã xuất bản & tiến độ
// ---------------------------------------------------------------------------
export async function refreshCourseLessonCount(courseId: number) {
  const [published] = await db
    .select({ value: count() })
    .from(lmsLessonsTable)
    .where(and(eq(lmsLessonsTable.courseId, courseId), eq(lmsLessonsTable.isPublished, true)));
  await db
    .update(lmsCoursesTable)
    .set({ lessons: Number(published?.value ?? 0) })
    .where(eq(lmsCoursesTable.id, courseId));
}

/** Tiến độ của một học viên trong khóa học: số bài đã xuất bản đã hoàn thành / tổng số bài đã xuất bản */
export async function learnerCourseProgress(learnerId: number, courseId: number) {
  const published = await db
    .select({ id: lmsLessonsTable.id })
    .from(lmsLessonsTable)
    .where(and(eq(lmsLessonsTable.courseId, courseId), eq(lmsLessonsTable.isPublished, true)));
  const total = published.length;
  if (total === 0) return { completed: 0, total: 0, percent: 0 };
  const [done] = await db
    .select({ value: count() })
    .from(lmsLessonCompletionsTable)
    .where(
      and(
        eq(lmsLessonCompletionsTable.learnerId, learnerId),
        inArray(
          lmsLessonCompletionsTable.lessonId,
          published.map((l) => l.id),
        ),
      ),
    );
  const completed = Number(done?.value ?? 0);
  return { completed, total, percent: Math.round((completed / total) * 100) };
}

/** Tiến độ trung bình của mọi học viên đã ghi danh */
async function averageCourseProgress(courseId: number): Promise<number> {
  const enrolled = await db
    .select({ learnerId: lmsEnrollmentsTable.learnerId })
    .from(lmsEnrollmentsTable)
    .where(eq(lmsEnrollmentsTable.courseId, courseId));
  if (enrolled.length === 0) return 0;
  let sum = 0;
  for (const e of enrolled) sum += (await learnerCourseProgress(e.learnerId, courseId)).percent;
  return Math.round(sum / enrolled.length);
}

// ---------------------------------------------------------------------------
// Hoàn thành bài học: ghi danh (nếu cần), điểm thưởng, huy hiệu, chứng chỉ
// ---------------------------------------------------------------------------
export async function recordLessonCompletion(options: {
  learnerId: number;
  lesson: LmsLesson;
  course: LmsCourse;
  pointsAwarded: number;
  /** Điểm quiz (nếu là bài quiz) — dùng cho huy hiệu & nhật ký hoạt động */
  quizScore?: number;
}) {
  const { learnerId, lesson, course, quizScore } = options;
  const [learner] = await db.select().from(lmsLearnersTable).where(eq(lmsLearnersTable.id, learnerId)).limit(1);
  if (!learner) throw badRequest("Không tìm thấy học viên.");

  // Tự ghi danh khi học viên tự học trong khóa học đang mở
  const [enrollment] = await db
    .select()
    .from(lmsEnrollmentsTable)
    .where(and(eq(lmsEnrollmentsTable.learnerId, learnerId), eq(lmsEnrollmentsTable.courseId, course.id)))
    .limit(1);
  if (!enrollment) {
    await db.insert(lmsEnrollmentsTable).values({ learnerId, courseId: course.id, status: "Đang học", completedLessonIds: [] });
    await db
      .update(lmsCoursesTable)
      .set({ enrolled: sql`${lmsCoursesTable.enrolled} + 1` })
      .where(eq(lmsCoursesTable.id, course.id));
  }

  const inserted = await db
    .insert(lmsLessonCompletionsTable)
    .values({ lessonId: lesson.id, learnerId })
    .onConflictDoNothing()
    .returning();
  const isNew = inserted.length > 0;
  const pointsAwarded = isNew ? options.pointsAwarded : 0;

  const progress = await learnerCourseProgress(learnerId, course.id);
  await db
    .update(lmsEnrollmentsTable)
    .set({ status: progress.percent >= 100 ? "Hoàn thành" : "Đang học" })
    .where(and(eq(lmsEnrollmentsTable.learnerId, learnerId), eq(lmsEnrollmentsTable.courseId, course.id)));
  await db
    .update(lmsLearnersTable)
    .set({
      progress: progress.percent,
      activeCourse: course.title,
      lastActive: "Vừa hoạt động",
      ...(pointsAwarded > 0 ? { points: sql`${lmsLearnersTable.points} + ${pointsAwarded}` } : {}),
    })
    .where(eq(lmsLearnersTable.id, learnerId));
  await db
    .update(lmsCoursesTable)
    .set({ progress: await averageCourseProgress(course.id) })
    .where(eq(lmsCoursesTable.id, course.id));

  const today = new Date().toISOString().slice(0, 10);
  if (isNew && quizScore !== undefined && quizScore >= 90) {
    await db
      .insert(lmsBadgesTable)
      .values({
        learnerId,
        name: "Chinh phục thử thách",
        description: "Đạt từ 90 điểm trong bài kiểm tra.",
        icon: "award",
        awardedAt: today,
      })
      .onConflictDoNothing();
  }

  let certificateIssued = false;
  if (progress.total > 0 && progress.percent >= 100) {
    await db
      .insert(lmsBadgesTable)
      .values({
        learnerId,
        name: `Hoàn thành ${course.title}`,
        description: `Hoàn thành tất cả bài học trong ${course.title}.`,
        icon: "graduation-cap",
        awardedAt: today,
      })
      .onConflictDoNothing();
    const serial = `NOVA-${new Date().getFullYear()}-${String(course.id).padStart(3, "0")}-${String(learnerId).padStart(4, "0")}`;
    const certificate = await db
      .insert(lmsCertificatesTable)
      .values({ learner: learner.name, course: course.title, serial, issuedAt: today, status: "Đã cấp" })
      .onConflictDoNothing()
      .returning();
    certificateIssued = certificate.length > 0;
  }

  if (isNew) {
    await db.insert(lmsActivitiesTable).values({
      title: `${learner.name} vừa hoàn thành bài học`,
      detail: `${course.title} · ${lesson.title}${quizScore !== undefined ? ` · ${quizScore} điểm` : ""}`,
      time: "Vừa xong",
      kind: "completion",
    });
  }
  if (certificateIssued) {
    await db.insert(lmsActivitiesTable).values({
      title: "Chứng chỉ được cấp tự động",
      detail: `${learner.name} · ${course.title}`,
      time: "Vừa xong",
      kind: "certificate",
    });
  }

  return { progress: progress.percent, certificateIssued, pointsAwarded };
}
