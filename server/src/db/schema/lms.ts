import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { z } from "zod";

export const lmsCoursesTable = pgTable("lms_courses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull().unique(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  level: text("level").notNull(),
  duration: text("duration").notNull(),
  lessons: integer("lessons").notNull(),
  enrolled: integer("enrolled").notNull().default(0),
  progress: real("progress").notNull().default(0),
  status: text("status").notNull().default("Đang hoạt động"),
  format: text("format").notNull().default("Native"),
  accent: text("accent").notNull().default("teal"),
  instructorName: text("instructor_name").notNull().default("Cô Bui Ngan"),
  // Giảng viên phụ trách (chủ sở hữu khóa học)
  instructorId: integer("instructor_id").references((): AnyPgColumn => lmsLearnersTable.id, { onDelete: "set null" }),
  mediaUrl: text("media_url"),
  mediaType: text("media_type").default("video"),
  coverImageUrl: text("cover_image_url"),
  // "public": mọi học viên thấy (khi đang hoạt động); "private": chỉ học viên được mời/ghi danh
  visibility: text("visibility").notNull().default("public"),
  // Khóa công khai: "open" tham gia ngay, "approval" cần giảng viên duyệt
  enrollmentMethod: text("enrollment_method").notNull().default("open"),
}, (t) => [index("lms_courses_instructor_idx").on(t.instructorId)]);

export const lmsLearnersTable = pgTable("lms_learners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("student"),
  // "active" | "locked" — tài khoản bị khóa không thể đăng nhập
  status: text("status").notNull().default("active"),
  team: text("team").notNull(),
  points: integer("points").notNull().default(0),
  streak: integer("streak").notNull().default(0),
  progress: real("progress").notNull().default(0),
  activeCourse: text("active_course").notNull().default("Chưa ghi danh"),
  lastActive: text("last_active").notNull().default("Chưa hoạt động"),
});

export const lmsSessionsTable = pgTable("lms_sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => lmsLearnersTable.id, { onDelete: "cascade" }),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  expiresAt: text("expires_at").notNull(),
}, (t) => [index("lms_sessions_user_idx").on(t.userId)]);

export const lmsLearningPathsTable = pgTable("lms_learning_paths", {
  id: serial("id").primaryKey(),
  title: text("title").notNull().unique(),
  description: text("description").notNull(),
  courses: integer("courses").notNull(),
  courseTitles: jsonb("course_titles")
    .$type<string[]>()
    .notNull()
    .default([]),
  duration: text("duration").notNull(),
  completion: real("completion").notNull().default(0),
  learners: integer("learners").notNull().default(0),
  accent: text("accent").notNull().default("teal"),
});

export const lmsEnrollmentsTable = pgTable(
  "lms_enrollments",
  {
    id: serial("id").primaryKey(),
    learnerId: integer("learner_id")
      .notNull()
      .references(() => lmsLearnersTable.id, { onDelete: "cascade" }),
    courseId: integer("course_id")
      .notNull()
      .references(() => lmsCoursesTable.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("Đang học"),
    completedLessonIds: jsonb("completed_lesson_ids")
      .$type<string[]>()
      .notNull()
      .default([]),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex("lms_enrollments_learner_course_unique").on(
      table.learnerId,
      table.courseId,
    ),
  ],
);

export const lmsCertificatesTable = pgTable("lms_certificates", {
  id: serial("id").primaryKey(),
  learner: text("learner").notNull(),
  course: text("course").notNull(),
  serial: text("serial").notNull().unique(),
  issuedAt: text("issued_at").notNull(),
  status: text("status").notNull().default("Đã cấp"),
});

export const lmsActivitiesTable = pgTable("lms_activities", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  time: text("time").notNull(),
  kind: text("kind").notNull(),
});

export const lmsBadgesTable = pgTable(
  "lms_badges",
  {
    id: serial("id").primaryKey(),
    learnerId: integer("learner_id")
      .notNull()
      .references(() => lmsLearnersTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull(),
    icon: text("icon").notNull(),
    awardedAt: text("awarded_at").notNull(),
  },
  (table) => [
    uniqueIndex("lms_badges_learner_name_unique").on(
      table.learnerId,
      table.name,
    ),
  ],
);

export const lmsXapiEventsTable = pgTable("lms_xapi_events", {
  id: serial("id").primaryKey(),
  learnerId: integer("learner_id")
    .notNull()
    .references(() => lmsLearnersTable.id, { onDelete: "cascade" }),
  verb: text("verb").notNull(),
  objectId: text("object_id").notNull(),
  score: real("score").notNull(),
  timestamp: text("timestamp").notNull(),
  raw: jsonb("raw").$type<Record<string, unknown>>(),
});

export const insertLmsCourseSchema = createInsertSchema(lmsCoursesTable).omit({
  id: true,
});
export const insertLmsLearnerSchema = createInsertSchema(
  lmsLearnersTable,
).omit({ id: true });
export const insertLmsLearningPathSchema = createInsertSchema(
  lmsLearningPathsTable,
).omit({ id: true });
export const insertLmsEnrollmentSchema = createInsertSchema(
  lmsEnrollmentsTable,
).omit({ id: true, createdAt: true });
export const insertLmsCertificateSchema = createInsertSchema(
  lmsCertificatesTable,
).omit({ id: true });
export const insertLmsActivitySchema = createInsertSchema(
  lmsActivitiesTable,
).omit({ id: true });
export const insertLmsBadgeSchema = createInsertSchema(lmsBadgesTable).omit({
  id: true,
});
export const insertLmsXapiEventSchema = createInsertSchema(
  lmsXapiEventsTable,
).omit({ id: true });

export const lmsMaterialsTable = pgTable("lms_materials", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id")
    .notNull()
    .references(() => lmsCoursesTable.id, { onDelete: "cascade" }),
  lessonNumber: integer("lesson_number").default(1),
  // Bài học chứa tài liệu
  lessonId: integer("lesson_id").references((): AnyPgColumn => lmsLessonsTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  type: text("type").notNull().default("pdf"),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name"),
  fileSize: text("file_size"),
  description: text("description"),
  uploadedBy: text("uploaded_by").notNull().default("Cô Bui Ngan"),
  downloadCount: integer("download_count").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (t) => [index("lms_materials_course_idx").on(t.courseId)]);

export const lmsAssignmentsTable = pgTable("lms_assignments", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id")
    .notNull()
    .references(() => lmsCoursesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: text("due_date").notNull(),
  maxPoints: real("max_points").notNull().default(10),
  attachmentUrl: text("attachment_url"),
  attachmentName: text("attachment_name"),
  createdBy: text("created_by").notNull().default("Cô Bui Ngan"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (t) => [index("lms_assignments_course_idx").on(t.courseId)]);

export const lmsSubmissionsTable = pgTable(
  "lms_submissions",
  {
    id: serial("id").primaryKey(),
    assignmentId: integer("assignment_id")
      .notNull()
      .references(() => lmsAssignmentsTable.id, { onDelete: "cascade" }),
    studentId: integer("student_id")
      .notNull()
      .references(() => lmsLearnersTable.id, { onDelete: "cascade" }),
    studentName: text("student_name").notNull().default("Ngann"),
    studentAvatar: text("student_avatar").notNull().default("NG"),
    fileUrl: text("file_url"),
    fileName: text("file_name"),
    fileSize: text("file_size"),
    textContent: text("text_content"),
    status: text("status").notNull().default("submitted"),
    grade: real("grade"),
    feedback: text("feedback"),
    gradedBy: text("graded_by"),
    gradedAt: text("graded_at"),
    submittedAt: text("submitted_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex("lms_submissions_assignment_student_unique").on(
      table.assignmentId,
      table.studentId,
    ),
  ],
);

export const insertLmsMaterialSchema = createInsertSchema(
  lmsMaterialsTable,
).omit({ id: true });
export const insertLmsAssignmentSchema = createInsertSchema(
  lmsAssignmentsTable,
).omit({ id: true });
export const insertLmsSubmissionSchema = createInsertSchema(
  lmsSubmissionsTable,
).omit({ id: true });

export type LmsCourse = typeof lmsCoursesTable.$inferSelect;
export type LmsLearner = typeof lmsLearnersTable.$inferSelect;
export type LmsLearningPath = typeof lmsLearningPathsTable.$inferSelect;
export type LmsEnrollment = typeof lmsEnrollmentsTable.$inferSelect;
export type LmsCertificate = typeof lmsCertificatesTable.$inferSelect;
export type LmsBadge = typeof lmsBadgesTable.$inferSelect;
export type LmsXapiEvent = typeof lmsXapiEventsTable.$inferSelect;
export type LmsSession = typeof lmsSessionsTable.$inferSelect;
export type LmsCourseInput = typeof lmsCoursesTable.$inferInsert;
export type LmsMaterial = typeof lmsMaterialsTable.$inferSelect;
export type LmsAssignment = typeof lmsAssignmentsTable.$inferSelect;
export type LmsSubmission = typeof lmsSubmissionsTable.$inferSelect;

// ---------------------------------------------------------------------------
// Nội dung khóa học: chương -> bài học -> câu hỏi quiz, và tiến độ học viên
// ---------------------------------------------------------------------------
export const lmsCourseSectionsTable = pgTable("lms_course_sections", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id")
    .notNull()
    .references(() => lmsCoursesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (t) => [index("lms_course_sections_course_idx").on(t.courseId, t.position)]);

export const lmsLessonsTable = pgTable("lms_lessons", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id")
    .notNull()
    .references(() => lmsCoursesTable.id, { onDelete: "cascade" }),
  sectionId: integer("section_id")
    .notNull()
    .references(() => lmsCourseSectionsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  type: text("type").notNull().default("text"),
  position: integer("position").notNull().default(0),
  contentHtml: text("content_html").notNull().default(""),
  mediaUrl: text("media_url"),
  durationMinutes: integer("duration_minutes").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(false),
  passScore: integer("pass_score").notNull().default(70),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index("lms_lessons_section_idx").on(t.sectionId, t.position),
  index("lms_lessons_course_idx").on(t.courseId),
]);

export const lmsQuizQuestionsTable = pgTable("lms_quiz_questions", {
  id: serial("id").primaryKey(),
  lessonId: integer("lesson_id")
    .notNull()
    .references(() => lmsLessonsTable.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  prompt: text("prompt").notNull(),
  options: jsonb("options").$type<string[]>().notNull().default([]),
  correctIndex: integer("correct_index").notNull(),
  explanation: text("explanation"),
}, (t) => [index("lms_quiz_questions_lesson_idx").on(t.lessonId, t.position)]);

export const lmsQuizAttemptsTable = pgTable("lms_quiz_attempts", {
  id: serial("id").primaryKey(),
  lessonId: integer("lesson_id")
    .notNull()
    .references(() => lmsLessonsTable.id, { onDelete: "cascade" }),
  learnerId: integer("learner_id")
    .notNull()
    .references(() => lmsLearnersTable.id, { onDelete: "cascade" }),
  answers: jsonb("answers").$type<number[]>().notNull().default([]),
  score: integer("score").notNull(),
  passed: boolean("passed").notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}, (t) => [index("lms_quiz_attempts_lesson_learner_idx").on(t.lessonId, t.learnerId)]);

export const lmsLessonCompletionsTable = pgTable(
  "lms_lesson_completions",
  {
    id: serial("id").primaryKey(),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => lmsLessonsTable.id, { onDelete: "cascade" }),
    learnerId: integer("learner_id")
      .notNull()
      .references(() => lmsLearnersTable.id, { onDelete: "cascade" }),
    completedAt: text("completed_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [uniqueIndex("lms_lesson_completions_unique").on(table.lessonId, table.learnerId)],
);

export type LmsCourseSection = typeof lmsCourseSectionsTable.$inferSelect;
export type LmsLesson = typeof lmsLessonsTable.$inferSelect;
export type LmsQuizQuestion = typeof lmsQuizQuestionsTable.$inferSelect;

// ---------------------------------------------------------------------------
// Lịch học: buổi học trực tuyến (Teams / Google Meet / Zoom) của khóa học
// ---------------------------------------------------------------------------
export const lmsClassSessionsTable = pgTable(
  "lms_class_sessions",
  {
    id: serial("id").primaryKey(),
    courseId: integer("course_id")
      .notNull()
      .references(() => lmsCoursesTable.id, { onDelete: "cascade" }),
    lessonId: integer("lesson_id").references(() => lmsLessonsTable.id, { onDelete: "set null" }),
    title: text("title"),
    notes: text("notes"),
    meetingUrl: text("meeting_url").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(60),
    // Các buổi tạo cùng lúc theo lịch lặp hằng tuần dùng chung seriesId
    seriesId: text("series_id"),
    createdBy: integer("created_by").references(() => lmsLearnersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("lms_class_sessions_course_start_idx").on(t.courseId, t.startsAt),
    index("lms_class_sessions_series_idx").on(t.seriesId),
  ],
);

export type LmsClassSession = typeof lmsClassSessionsTable.$inferSelect;

// ---------------------------------------------------------------------------
// Yêu cầu tham gia khóa học (khóa "cần duyệt") và liên kết mời (khóa riêng tư)
// ---------------------------------------------------------------------------
export const lmsEnrollmentRequestsTable = pgTable(
  "lms_enrollment_requests",
  {
    id: serial("id").primaryKey(),
    courseId: integer("course_id")
      .notNull()
      .references(() => lmsCoursesTable.id, { onDelete: "cascade" }),
    learnerId: integer("learner_id")
      .notNull()
      .references(() => lmsLearnersTable.id, { onDelete: "cascade" }),
    // "pending" | "approved" | "rejected"
    status: text("status").notNull().default("pending"),
    message: text("message"),
    decidedBy: integer("decided_by").references(() => lmsLearnersTable.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("lms_enrollment_requests_course_learner_unique").on(t.courseId, t.learnerId),
    index("lms_enrollment_requests_course_status_idx").on(t.courseId, t.status),
  ],
);

export const lmsCourseInvitesTable = pgTable(
  "lms_course_invites",
  {
    id: serial("id").primaryKey(),
    courseId: integer("course_id")
      .notNull()
      .references(() => lmsCoursesTable.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    maxUses: integer("max_uses"),
    uses: integer("uses").notNull().default(0),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdBy: integer("created_by").references(() => lmsLearnersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("lms_course_invites_token_unique").on(t.token), index("lms_course_invites_course_idx").on(t.courseId)],
);

export type LmsEnrollmentRequest = typeof lmsEnrollmentRequestsTable.$inferSelect;
export type LmsCourseInvite = typeof lmsCourseInvitesTable.$inferSelect;
