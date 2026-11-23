import { and, eq } from "drizzle-orm";
import {
  db,
  lmsAssignmentsTable,
  lmsCoursesTable,
  lmsEnrollmentsTable,
  type LmsAssignment,
  type LmsCourse,
} from "../db";
import type { AuthUser } from "./auth";
import { forbidden, notFound } from "./http";

/**
 * Quy tắc phân quyền theo khóa học:
 *  - admin: toàn quyền
 *  - lecturer: quản lý (ghi) khóa học mình phụ trách; đọc mọi khóa học
 *  - student: chỉ đọc khóa học mình đã ghi danh
 */
export function canManageCourse(user: AuthUser, course: Pick<LmsCourse, "instructorId">): boolean {
  return user.role === "admin" || (user.role === "lecturer" && course.instructorId === user.id);
}

export async function isEnrolled(learnerId: number, courseId: number): Promise<boolean> {
  const rows = await db
    .select({ id: lmsEnrollmentsTable.id })
    .from(lmsEnrollmentsTable)
    .where(and(eq(lmsEnrollmentsTable.learnerId, learnerId), eq(lmsEnrollmentsTable.courseId, courseId)))
    .limit(1);
  return rows.length > 0;
}

export async function findCourse(courseId: number): Promise<LmsCourse> {
  const [course] = await db.select().from(lmsCoursesTable).where(eq(lmsCoursesTable.id, courseId)).limit(1);
  if (!course) throw notFound("Không tìm thấy khóa học.");
  return course;
}

/** Khóa học mà người dùng được phép ghi (giảng viên phụ trách hoặc admin) */
export async function loadCourseForWrite(user: AuthUser, courseId: number): Promise<LmsCourse> {
  const course = await findCourse(courseId);
  if (!canManageCourse(user, course)) {
    throw forbidden("Chỉ giảng viên phụ trách khóa học hoặc quản trị viên mới được thực hiện thao tác này.");
  }
  return course;
}

/** Khóa học mà người dùng được phép xem nội dung (tài liệu, bài tập) */
export async function loadCourseForRead(user: AuthUser, courseId: number): Promise<LmsCourse> {
  const course = await findCourse(courseId);
  if (user.role === "admin" || user.role === "lecturer") return course;
  if (await isEnrolled(user.id, courseId)) return course;
  throw forbidden("Bạn cần ghi danh vào khóa học để xem nội dung này.");
}

export async function findAssignment(assignmentId: number): Promise<LmsAssignment> {
  const [assignment] = await db
    .select()
    .from(lmsAssignmentsTable)
    .where(eq(lmsAssignmentsTable.id, assignmentId))
    .limit(1);
  if (!assignment) throw notFound("Không tìm thấy bài tập.");
  return assignment;
}

/** Xem được khóa học: admin/giảng viên; học viên khi khóa đang mở hoặc đã ghi danh */
export async function canViewCourse(user: AuthUser, course: Pick<LmsCourse, "id" | "status">): Promise<boolean> {
  if (user.role !== "student") return true;
  return course.status === "Đang hoạt động" || (await isEnrolled(user.id, course.id));
}
