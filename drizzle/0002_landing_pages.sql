CREATE TABLE "landing_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"type" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landing_clicks" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_id" integer NOT NULL,
	"visitor_id" text NOT NULL,
	"session_id" text NOT NULL,
	"block_id" integer,
	"block_type" text DEFAULT '' NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"href" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landing_forms" (
	"page_id" integer NOT NULL,
	"form_id" integer NOT NULL,
	CONSTRAINT "landing_forms_page_id_form_id_pk" PRIMARY KEY("page_id","form_id")
);
--> statement-breakpoint
CREATE TABLE "landing_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"author_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landing_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_id" integer NOT NULL,
	"author_id" uuid,
	"label" text DEFAULT '' NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landing_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"page_id" integer NOT NULL,
	"visitor_id" text NOT NULL,
	"session_id" text NOT NULL,
	"device" text DEFAULT '' NOT NULL,
	"browser" text DEFAULT '' NOT NULL,
	"os" text DEFAULT '' NOT NULL,
	"channel" text DEFAULT 'direct' NOT NULL,
	"medium" text DEFAULT '' NOT NULL,
	"campaign" text DEFAULT '' NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "landing_blocks" ADD CONSTRAINT "landing_blocks_page_id_landing_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landing_clicks" ADD CONSTRAINT "landing_clicks_page_id_landing_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landing_forms" ADD CONSTRAINT "landing_forms_page_id_landing_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landing_forms" ADD CONSTRAINT "landing_forms_form_id_bbforms_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."bbforms_forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landing_pages" ADD CONSTRAINT "landing_pages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landing_revisions" ADD CONSTRAINT "landing_revisions_page_id_landing_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landing_revisions" ADD CONSTRAINT "landing_revisions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landing_views" ADD CONSTRAINT "landing_views_page_id_landing_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."landing_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "landing_blocks_page_pos_idx" ON "landing_blocks" USING btree ("page_id","position");--> statement-breakpoint
CREATE INDEX "landing_clicks_page_created_idx" ON "landing_clicks" USING btree ("page_id","created_at");--> statement-breakpoint
CREATE INDEX "landing_clicks_page_session_idx" ON "landing_clicks" USING btree ("page_id","session_id");--> statement-breakpoint
CREATE INDEX "landing_forms_form_idx" ON "landing_forms" USING btree ("form_id");--> statement-breakpoint
CREATE UNIQUE INDEX "landing_pages_slug_idx" ON "landing_pages" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "landing_pages_status_idx" ON "landing_pages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "landing_revisions_page_idx" ON "landing_revisions" USING btree ("page_id","created_at");--> statement-breakpoint
CREATE INDEX "landing_views_page_created_idx" ON "landing_views" USING btree ("page_id","created_at");--> statement-breakpoint
CREATE INDEX "landing_views_page_visitor_idx" ON "landing_views" USING btree ("page_id","visitor_id");--> statement-breakpoint
CREATE INDEX "landing_views_page_session_idx" ON "landing_views" USING btree ("page_id","session_id");