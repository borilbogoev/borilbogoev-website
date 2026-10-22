CREATE TABLE "classroom_block_state" (
	"user_id" uuid NOT NULL,
	"block_id" integer NOT NULL,
	"lesson_id" integer NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "classroom_block_state_user_id_block_id_pk" PRIMARY KEY("user_id","block_id")
);
--> statement-breakpoint
CREATE TABLE "classroom_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"lesson_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"type" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classroom_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"image" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classroom_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"lesson_id" integer NOT NULL,
	"course_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_id" integer,
	"body" text NOT NULL,
	"visibility" text DEFAULT 'class' NOT NULL,
	"status" text DEFAULT 'visible' NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "classroom_courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"category_id" integer,
	"summary" text DEFAULT '' NOT NULL,
	"image" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"access" text DEFAULT 'open' NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'AED' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"author_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classroom_enrolments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"source" text DEFAULT 'self' NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'AED' NOT NULL,
	"paid_at" timestamp with time zone,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classroom_lesson_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"lesson_id" integer NOT NULL,
	"author_id" uuid,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classroom_lessons" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"module_id" integer NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"slug" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"image" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"preview" boolean DEFAULT false NOT NULL,
	"minutes" integer DEFAULT 0 NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classroom_modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"slug" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"image" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classroom_notes" (
	"user_id" uuid NOT NULL,
	"lesson_id" integer NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "classroom_notes_user_id_lesson_id_pk" PRIMARY KEY("user_id","lesson_id")
);
--> statement-breakpoint
CREATE TABLE "classroom_progress" (
	"user_id" uuid NOT NULL,
	"lesson_id" integer NOT NULL,
	"course_id" integer NOT NULL,
	"completed_at" timestamp with time zone,
	"position" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "classroom_progress_user_id_lesson_id_pk" PRIMARY KEY("user_id","lesson_id")
);
--> statement-breakpoint
CREATE TABLE "classroom_settings" (
	"name" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "classroom_block_state" ADD CONSTRAINT "classroom_block_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_block_state" ADD CONSTRAINT "classroom_block_state_block_id_classroom_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."classroom_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_block_state" ADD CONSTRAINT "classroom_block_state_lesson_id_classroom_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."classroom_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_blocks" ADD CONSTRAINT "classroom_blocks_lesson_id_classroom_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."classroom_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_comments" ADD CONSTRAINT "classroom_comments_lesson_id_classroom_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."classroom_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_comments" ADD CONSTRAINT "classroom_comments_course_id_classroom_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."classroom_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_comments" ADD CONSTRAINT "classroom_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_courses" ADD CONSTRAINT "classroom_courses_category_id_classroom_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."classroom_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_courses" ADD CONSTRAINT "classroom_courses_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_enrolments" ADD CONSTRAINT "classroom_enrolments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_enrolments" ADD CONSTRAINT "classroom_enrolments_course_id_classroom_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."classroom_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_lesson_revisions" ADD CONSTRAINT "classroom_lesson_revisions_lesson_id_classroom_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."classroom_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_lesson_revisions" ADD CONSTRAINT "classroom_lesson_revisions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_lessons" ADD CONSTRAINT "classroom_lessons_course_id_classroom_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."classroom_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_lessons" ADD CONSTRAINT "classroom_lessons_module_id_classroom_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."classroom_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_modules" ADD CONSTRAINT "classroom_modules_course_id_classroom_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."classroom_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_notes" ADD CONSTRAINT "classroom_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_notes" ADD CONSTRAINT "classroom_notes_lesson_id_classroom_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."classroom_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_progress" ADD CONSTRAINT "classroom_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_progress" ADD CONSTRAINT "classroom_progress_lesson_id_classroom_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."classroom_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_progress" ADD CONSTRAINT "classroom_progress_course_id_classroom_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."classroom_courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "classroom_block_state_lesson_idx" ON "classroom_block_state" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "classroom_blocks_lesson_pos_idx" ON "classroom_blocks" USING btree ("lesson_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "classroom_categories_slug_idx" ON "classroom_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "classroom_comments_lesson_idx" ON "classroom_comments" USING btree ("lesson_id","created_at");--> statement-breakpoint
CREATE INDEX "classroom_comments_course_idx" ON "classroom_comments" USING btree ("course_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "classroom_courses_slug_idx" ON "classroom_courses" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "classroom_courses_status_idx" ON "classroom_courses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "classroom_courses_category_idx" ON "classroom_courses" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "classroom_enrolments_user_course_idx" ON "classroom_enrolments" USING btree ("user_id","course_id");--> statement-breakpoint
CREATE INDEX "classroom_enrolments_course_idx" ON "classroom_enrolments" USING btree ("course_id","status");--> statement-breakpoint
CREATE INDEX "classroom_lesson_revisions_lesson_idx" ON "classroom_lesson_revisions" USING btree ("lesson_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "classroom_lessons_slug_idx" ON "classroom_lessons" USING btree ("module_id","slug");--> statement-breakpoint
CREATE INDEX "classroom_lessons_module_pos_idx" ON "classroom_lessons" USING btree ("module_id","position");--> statement-breakpoint
CREATE INDEX "classroom_lessons_course_idx" ON "classroom_lessons" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "classroom_modules_slug_idx" ON "classroom_modules" USING btree ("course_id","slug");--> statement-breakpoint
CREATE INDEX "classroom_modules_course_pos_idx" ON "classroom_modules" USING btree ("course_id","position");--> statement-breakpoint
CREATE INDEX "classroom_progress_user_course_idx" ON "classroom_progress" USING btree ("user_id","course_id");