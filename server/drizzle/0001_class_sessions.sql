CREATE TABLE "lms_class_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"lesson_id" integer,
	"title" text,
	"notes" text,
	"meeting_url" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"series_id" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lms_class_sessions" ADD CONSTRAINT "lms_class_sessions_course_id_lms_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."lms_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms_class_sessions" ADD CONSTRAINT "lms_class_sessions_lesson_id_lms_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lms_lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms_class_sessions" ADD CONSTRAINT "lms_class_sessions_created_by_lms_learners_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."lms_learners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lms_class_sessions_course_start_idx" ON "lms_class_sessions" USING btree ("course_id","starts_at");--> statement-breakpoint
CREATE INDEX "lms_class_sessions_series_idx" ON "lms_class_sessions" USING btree ("series_id");