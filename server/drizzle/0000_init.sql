CREATE TABLE "lms_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"time" text NOT NULL,
	"kind" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lms_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"due_date" text NOT NULL,
	"max_points" real DEFAULT 10 NOT NULL,
	"attachment_url" text,
	"attachment_name" text,
	"created_by" text DEFAULT 'Cô Bui Ngan' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lms_badges" (
	"id" serial PRIMARY KEY NOT NULL,
	"learner_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text NOT NULL,
	"awarded_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lms_certificates" (
	"id" serial PRIMARY KEY NOT NULL,
	"learner" text NOT NULL,
	"course" text NOT NULL,
	"serial" text NOT NULL,
	"issued_at" text NOT NULL,
	"status" text DEFAULT 'Đã cấp' NOT NULL,
	CONSTRAINT "lms_certificates_serial_unique" UNIQUE("serial")
);
--> statement-breakpoint
CREATE TABLE "lms_course_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"title" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lms_courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"level" text NOT NULL,
	"duration" text NOT NULL,
	"lessons" integer NOT NULL,
	"enrolled" integer DEFAULT 0 NOT NULL,
	"progress" real DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'Đang hoạt động' NOT NULL,
	"format" text DEFAULT 'Native' NOT NULL,
	"accent" text DEFAULT 'teal' NOT NULL,
	"instructor_name" text DEFAULT 'Cô Bui Ngan' NOT NULL,
	"instructor_id" integer,
	"media_url" text,
	"media_type" text DEFAULT 'video',
	"cover_image_url" text,
	CONSTRAINT "lms_courses_title_unique" UNIQUE("title")
);
--> statement-breakpoint
CREATE TABLE "lms_enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"learner_id" integer NOT NULL,
	"course_id" integer NOT NULL,
	"status" text DEFAULT 'Đang học' NOT NULL,
	"completed_lesson_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lms_learners" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"role" text DEFAULT 'student' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"team" text NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"streak" integer DEFAULT 0 NOT NULL,
	"progress" real DEFAULT 0 NOT NULL,
	"active_course" text DEFAULT 'Chưa ghi danh' NOT NULL,
	"last_active" text DEFAULT 'Chưa hoạt động' NOT NULL,
	CONSTRAINT "lms_learners_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "lms_learning_paths" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"courses" integer NOT NULL,
	"course_titles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"duration" text NOT NULL,
	"completion" real DEFAULT 0 NOT NULL,
	"learners" integer DEFAULT 0 NOT NULL,
	"accent" text DEFAULT 'teal' NOT NULL,
	CONSTRAINT "lms_learning_paths_title_unique" UNIQUE("title")
);
--> statement-breakpoint
CREATE TABLE "lms_lesson_completions" (
	"id" serial PRIMARY KEY NOT NULL,
	"lesson_id" integer NOT NULL,
	"learner_id" integer NOT NULL,
	"completed_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lms_lessons" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"section_id" integer NOT NULL,
	"title" text NOT NULL,
	"type" text DEFAULT 'text' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"content_html" text DEFAULT '' NOT NULL,
	"media_url" text,
	"duration_minutes" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"pass_score" integer DEFAULT 70 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lms_materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"lesson_number" integer DEFAULT 1,
	"lesson_id" integer,
	"title" text NOT NULL,
	"type" text DEFAULT 'pdf' NOT NULL,
	"file_url" text NOT NULL,
	"file_name" text,
	"file_size" text,
	"description" text,
	"uploaded_by" text DEFAULT 'Cô Bui Ngan' NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lms_quiz_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"lesson_id" integer NOT NULL,
	"learner_id" integer NOT NULL,
	"answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"score" integer NOT NULL,
	"passed" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lms_quiz_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"lesson_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"prompt" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"correct_index" integer NOT NULL,
	"explanation" text
);
--> statement-breakpoint
CREATE TABLE "lms_sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" text NOT NULL,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lms_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"assignment_id" integer NOT NULL,
	"student_id" integer NOT NULL,
	"student_name" text DEFAULT 'Ngann' NOT NULL,
	"student_avatar" text DEFAULT 'NG' NOT NULL,
	"file_url" text,
	"file_name" text,
	"file_size" text,
	"text_content" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"grade" real,
	"feedback" text,
	"graded_by" text,
	"graded_at" text,
	"submitted_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lms_xapi_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"learner_id" integer NOT NULL,
	"verb" text NOT NULL,
	"object_id" text NOT NULL,
	"score" real NOT NULL,
	"timestamp" text NOT NULL,
	"raw" jsonb
);
--> statement-breakpoint
ALTER TABLE "lms_assignments" ADD CONSTRAINT "lms_assignments_course_id_lms_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."lms_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms_badges" ADD CONSTRAINT "lms_badges_learner_id_lms_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."lms_learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms_course_sections" ADD CONSTRAINT "lms_course_sections_course_id_lms_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."lms_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms_courses" ADD CONSTRAINT "lms_courses_instructor_id_lms_learners_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "public"."lms_learners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms_enrollments" ADD CONSTRAINT "lms_enrollments_learner_id_lms_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."lms_learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms_enrollments" ADD CONSTRAINT "lms_enrollments_course_id_lms_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."lms_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms_lesson_completions" ADD CONSTRAINT "lms_lesson_completions_lesson_id_lms_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lms_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms_lesson_completions" ADD CONSTRAINT "lms_lesson_completions_learner_id_lms_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."lms_learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms_lessons" ADD CONSTRAINT "lms_lessons_course_id_lms_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."lms_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms_lessons" ADD CONSTRAINT "lms_lessons_section_id_lms_course_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."lms_course_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms_materials" ADD CONSTRAINT "lms_materials_course_id_lms_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."lms_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms_materials" ADD CONSTRAINT "lms_materials_lesson_id_lms_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lms_lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms_quiz_attempts" ADD CONSTRAINT "lms_quiz_attempts_lesson_id_lms_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lms_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms_quiz_attempts" ADD CONSTRAINT "lms_quiz_attempts_learner_id_lms_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."lms_learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms_quiz_questions" ADD CONSTRAINT "lms_quiz_questions_lesson_id_lms_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lms_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms_sessions" ADD CONSTRAINT "lms_sessions_user_id_lms_learners_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."lms_learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms_submissions" ADD CONSTRAINT "lms_submissions_assignment_id_lms_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."lms_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms_submissions" ADD CONSTRAINT "lms_submissions_student_id_lms_learners_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."lms_learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms_xapi_events" ADD CONSTRAINT "lms_xapi_events_learner_id_lms_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."lms_learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lms_assignments_course_idx" ON "lms_assignments" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lms_badges_learner_name_unique" ON "lms_badges" USING btree ("learner_id","name");--> statement-breakpoint
CREATE INDEX "lms_course_sections_course_idx" ON "lms_course_sections" USING btree ("course_id","position");--> statement-breakpoint
CREATE INDEX "lms_courses_instructor_idx" ON "lms_courses" USING btree ("instructor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lms_enrollments_learner_course_unique" ON "lms_enrollments" USING btree ("learner_id","course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lms_lesson_completions_unique" ON "lms_lesson_completions" USING btree ("lesson_id","learner_id");--> statement-breakpoint
CREATE INDEX "lms_lessons_section_idx" ON "lms_lessons" USING btree ("section_id","position");--> statement-breakpoint
CREATE INDEX "lms_lessons_course_idx" ON "lms_lessons" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "lms_materials_course_idx" ON "lms_materials" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "lms_quiz_attempts_lesson_learner_idx" ON "lms_quiz_attempts" USING btree ("lesson_id","learner_id");--> statement-breakpoint
CREATE INDEX "lms_quiz_questions_lesson_idx" ON "lms_quiz_questions" USING btree ("lesson_id","position");--> statement-breakpoint
CREATE INDEX "lms_sessions_user_idx" ON "lms_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lms_submissions_assignment_student_unique" ON "lms_submissions" USING btree ("assignment_id","student_id");