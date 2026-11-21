import { createInsertSchema } from "drizzle-zod";
import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { z } from "zod";

export const lmsCoursesTable = sqliteTable("lms_courses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
  mediaUrl: text("media_url"),
  mediaType: text("media_type").default("video"),
});

export const lmsLearnersTable = sqliteTable("lms_learners", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("student"),
  team: text("team").notNull(),
  points: integer("points").notNull().default(0),
  streak: integer("streak").notNull().default(0),
  progress: real("progress").notNull().default(0),
  activeCourse: text("active_course").notNull().default("Chưa ghi danh"),
  lastActive: text("last_active").notNull().default("Chưa hoạt động"),
});

export const lmsSessionsTable = sqliteTable("lms_sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => lmsLearnersTable.id, { onDelete: "cascade" }),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  expiresAt: text("expires_at").notNull(),
});

export const lmsLearningPathsTable = sqliteTable("lms_learning_paths", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull().unique(),
  description: text("description").notNull(),
  courses: integer("courses").notNull(),
  courseTitles: text("course_titles", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),
  duration: text("duration").notNull(),
  completion: real("completion").notNull().default(0),
  learners: integer("learners").notNull().default(0),
  accent: text("accent").notNull().default("teal"),
});

export const lmsEnrollmentsTable = sqliteTable(
  "lms_enrollments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    learnerId: integer("learner_id")
      .notNull()
      .references(() => lmsLearnersTable.id, { onDelete: "cascade" }),
    courseId: integer("course_id")
      .notNull()
      .references(() => lmsCoursesTable.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("Đang học"),
    completedLessonIds: text("completed_lesson_ids", { mode: "json" })
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

export const lmsCertificatesTable = sqliteTable("lms_certificates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  learner: text("learner").notNull(),
  course: text("course").notNull(),
  serial: text("serial").notNull().unique(),
  issuedAt: text("issued_at").notNull(),
  status: text("status").notNull().default("Đã cấp"),
});

export const lmsActivitiesTable = sqliteTable("lms_activities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  time: text("time").notNull(),
  kind: text("kind").notNull(),
});

export const lmsBadgesTable = sqliteTable(
  "lms_badges",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
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

export const lmsXapiEventsTable = sqliteTable("lms_xapi_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  learnerId: integer("learner_id")
    .notNull()
    .references(() => lmsLearnersTable.id, { onDelete: "cascade" }),
  verb: text("verb").notNull(),
  objectId: text("object_id").notNull(),
  score: real("score").notNull(),
  timestamp: text("timestamp").notNull(),
  raw: text("raw", { mode: "json" }).$type<Record<string, unknown>>(),
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

export const lmsMaterialsTable = sqliteTable("lms_materials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  courseId: integer("course_id")
    .notNull()
    .references(() => lmsCoursesTable.id, { onDelete: "cascade" }),
  lessonNumber: integer("lesson_number").default(1),
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
});

export const lmsAssignmentsTable = sqliteTable("lms_assignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
});

export const lmsSubmissionsTable = sqliteTable(
  "lms_submissions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
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
