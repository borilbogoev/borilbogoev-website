CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"password_hash" text,
	"session_version" integer DEFAULT 0 NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bbforms_answers" (
	"id" serial PRIMARY KEY NOT NULL,
	"response_id" integer NOT NULL,
	"form_id" integer NOT NULL,
	"field_key" text NOT NULL,
	"value" text
);
--> statement-breakpoint
CREATE TABLE "bbforms_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"form_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"type" text NOT NULL,
	"field_key" text DEFAULT '' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bbforms_forms" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"slug" text,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_seq" integer DEFAULT 0 NOT NULL,
	"author_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bbforms_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"form_id" integer NOT NULL,
	"seq" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'complete' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"origin" text DEFAULT 'form' NOT NULL,
	"channel" text DEFAULT 'direct' NOT NULL,
	"device" text DEFAULT '' NOT NULL,
	"ip" text DEFAULT '' NOT NULL,
	"ip_hash" text DEFAULT '' NOT NULL,
	"user_agent" text DEFAULT '' NOT NULL,
	"referrer" text,
	"page_url" text,
	"user_id" uuid,
	"duration" integer DEFAULT 0 NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bbforms_settings" (
	"name" text PRIMARY KEY NOT NULL,
	"value" jsonb
);
--> statement-breakpoint
CREATE TABLE "bbforms_stats" (
	"form_id" integer NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"starts" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "bbforms_stats_form_id_day_pk" PRIMARY KEY("form_id","day")
);
--> statement-breakpoint
ALTER TABLE "bbforms_answers" ADD CONSTRAINT "bbforms_answers_response_id_bbforms_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."bbforms_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bbforms_blocks" ADD CONSTRAINT "bbforms_blocks_form_id_bbforms_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."bbforms_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bbforms_forms" ADD CONSTRAINT "bbforms_forms_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bbforms_responses" ADD CONSTRAINT "bbforms_responses_form_id_bbforms_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."bbforms_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bbforms_responses" ADD CONSTRAINT "bbforms_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bbforms_stats" ADD CONSTRAINT "bbforms_stats_form_id_bbforms_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."bbforms_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "bbforms_answers_response_idx" ON "bbforms_answers" USING btree ("response_id");--> statement-breakpoint
CREATE INDEX "bbforms_answers_form_key_idx" ON "bbforms_answers" USING btree ("form_id","field_key");--> statement-breakpoint
CREATE INDEX "bbforms_blocks_form_pos_idx" ON "bbforms_blocks" USING btree ("form_id","position");--> statement-breakpoint
CREATE INDEX "bbforms_forms_status_idx" ON "bbforms_forms" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "bbforms_forms_slug_idx" ON "bbforms_forms" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "bbforms_responses_form_created_idx" ON "bbforms_responses" USING btree ("form_id","created_at");--> statement-breakpoint
CREATE INDEX "bbforms_responses_form_seq_idx" ON "bbforms_responses" USING btree ("form_id","seq");--> statement-breakpoint
CREATE INDEX "bbforms_responses_ip_hash_idx" ON "bbforms_responses" USING btree ("ip_hash","created_at");