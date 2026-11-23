CREATE TABLE "lms_course_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone,
	"max_uses" integer,
	"uses" integer DEFAULT 0 NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lms_enrollment_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"learner_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"message" text,
	"decided_by" integer,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lms_courses" ADD COLUMN "visibility" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "lms_courses" ADD COLUMN "enrollment_method" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "lms_course_invites" ADD CONSTRAINT "lms_course_invites_course_id_lms_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."lms_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms_course_invites" ADD CONSTRAINT "lms_course_invites_created_by_lms_learners_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."lms_learners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms_enrollment_requests" ADD CONSTRAINT "lms_enrollment_requests_course_id_lms_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."lms_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms_enrollment_requests" ADD CONSTRAINT "lms_enrollment_requests_learner_id_lms_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."lms_learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms_enrollment_requests" ADD CONSTRAINT "lms_enrollment_requests_decided_by_lms_learners_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."lms_learners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lms_course_invites_token_unique" ON "lms_course_invites" USING btree ("token");--> statement-breakpoint
CREATE INDEX "lms_course_invites_course_idx" ON "lms_course_invites" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lms_enrollment_requests_course_learner_unique" ON "lms_enrollment_requests" USING btree ("course_id","learner_id");--> statement-breakpoint
CREATE INDEX "lms_enrollment_requests_course_status_idx" ON "lms_enrollment_requests" USING btree ("course_id","status");