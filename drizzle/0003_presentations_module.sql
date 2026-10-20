CREATE TABLE "presentation_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presentation_elements" (
	"id" serial PRIMARY KEY NOT NULL,
	"slide_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"type" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presentation_forms" (
	"presentation_id" integer NOT NULL,
	"form_id" integer NOT NULL,
	CONSTRAINT "presentation_forms_presentation_id_form_id_pk" PRIMARY KEY("presentation_id","form_id")
);
--> statement-breakpoint
CREATE TABLE "presentation_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"presentation_id" integer NOT NULL,
	"author_id" uuid,
	"label" text DEFAULT '' NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presentation_slides" (
	"id" serial PRIMARY KEY NOT NULL,
	"presentation_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"kind" text DEFAULT 'blank' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presentation_tag_links" (
	"presentation_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "presentation_tag_links_presentation_id_tag_id_pk" PRIMARY KEY("presentation_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "presentation_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presentation_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"presentation_id" integer NOT NULL,
	"visitor_id" text NOT NULL,
	"session_id" text NOT NULL,
	"mode" text DEFAULT 'slides' NOT NULL,
	"device" text DEFAULT '' NOT NULL,
	"browser" text DEFAULT '' NOT NULL,
	"os" text DEFAULT '' NOT NULL,
	"channel" text DEFAULT 'direct' NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"max_slide" integer DEFAULT 1 NOT NULL,
	"seconds" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presentations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"mode" text DEFAULT 'slides' NOT NULL,
	"orientation" text DEFAULT 'landscape' NOT NULL,
	"category_id" integer,
	"password_hash" text,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"author_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "presentation_elements" ADD CONSTRAINT "presentation_elements_slide_id_presentation_slides_id_fk" FOREIGN KEY ("slide_id") REFERENCES "public"."presentation_slides"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_forms" ADD CONSTRAINT "presentation_forms_presentation_id_presentations_id_fk" FOREIGN KEY ("presentation_id") REFERENCES "public"."presentations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_forms" ADD CONSTRAINT "presentation_forms_form_id_bbforms_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."bbforms_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_revisions" ADD CONSTRAINT "presentation_revisions_presentation_id_presentations_id_fk" FOREIGN KEY ("presentation_id") REFERENCES "public"."presentations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_revisions" ADD CONSTRAINT "presentation_revisions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_slides" ADD CONSTRAINT "presentation_slides_presentation_id_presentations_id_fk" FOREIGN KEY ("presentation_id") REFERENCES "public"."presentations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_tag_links" ADD CONSTRAINT "presentation_tag_links_presentation_id_presentations_id_fk" FOREIGN KEY ("presentation_id") REFERENCES "public"."presentations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_tag_links" ADD CONSTRAINT "presentation_tag_links_tag_id_presentation_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."presentation_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentation_views" ADD CONSTRAINT "presentation_views_presentation_id_presentations_id_fk" FOREIGN KEY ("presentation_id") REFERENCES "public"."presentations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentations" ADD CONSTRAINT "presentations_category_id_presentation_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."presentation_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presentations" ADD CONSTRAINT "presentations_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "presentation_categories_slug_idx" ON "presentation_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "presentation_elements_slide_pos_idx" ON "presentation_elements" USING btree ("slide_id","position");--> statement-breakpoint
CREATE INDEX "presentation_forms_form_idx" ON "presentation_forms" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "presentation_revisions_deck_idx" ON "presentation_revisions" USING btree ("presentation_id","created_at");--> statement-breakpoint
CREATE INDEX "presentation_slides_deck_pos_idx" ON "presentation_slides" USING btree ("presentation_id","position");--> statement-breakpoint
CREATE INDEX "presentation_tag_links_tag_idx" ON "presentation_tag_links" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "presentation_tags_slug_idx" ON "presentation_tags" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "presentation_views_deck_created_idx" ON "presentation_views" USING btree ("presentation_id","created_at");--> statement-breakpoint
CREATE INDEX "presentation_views_deck_visitor_idx" ON "presentation_views" USING btree ("presentation_id","visitor_id");--> statement-breakpoint
CREATE INDEX "presentation_views_deck_session_idx" ON "presentation_views" USING btree ("presentation_id","session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "presentations_slug_idx" ON "presentations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "presentations_status_idx" ON "presentations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "presentations_category_idx" ON "presentations" USING btree ("category_id");