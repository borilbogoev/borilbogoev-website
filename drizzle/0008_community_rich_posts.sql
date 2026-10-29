CREATE TABLE "community_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"community_id" integer NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"sort_rule" text DEFAULT 'default' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_post_reads" (
	"user_id" uuid NOT NULL,
	"post_id" integer NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "community_communities" ADD COLUMN "default_sort" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "community_posts" ADD COLUMN "kind" text DEFAULT 'post' NOT NULL;--> statement-breakpoint
ALTER TABLE "community_posts" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "community_posts" ADD COLUMN "blocks" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "community_posts" ADD COLUMN "category_id" integer;--> statement-breakpoint
ALTER TABLE "community_posts" ADD COLUMN "pinned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "community_posts" ADD COLUMN "comments_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "community_posts" ADD COLUMN "last_activity_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "community_categories" ADD CONSTRAINT "community_categories_community_id_community_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community_communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_post_reads" ADD CONSTRAINT "community_post_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_post_reads" ADD CONSTRAINT "community_post_reads_post_id_community_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "community_categories_slug_idx" ON "community_categories" USING btree ("community_id","slug");--> statement-breakpoint
CREATE INDEX "community_categories_pos_idx" ON "community_categories" USING btree ("community_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "community_post_reads_pair_idx" ON "community_post_reads" USING btree ("user_id","post_id");--> statement-breakpoint
CREATE INDEX "community_post_reads_post_idx" ON "community_post_reads" USING btree ("post_id");--> statement-breakpoint
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_category_id_community_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."community_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "community_posts_category_idx" ON "community_posts" USING btree ("community_id","category_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE status = 'published';--> statement-breakpoint
CREATE INDEX "community_posts_activity_idx" ON "community_posts" USING btree ("community_id","last_activity_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE status = 'published';--> statement-breakpoint
CREATE INDEX "community_posts_top_idx" ON "community_posts" USING btree ("community_id","like_count" DESC NULLS LAST,"created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE status = 'published';--> statement-breakpoint
CREATE INDEX "community_posts_pinned_idx" ON "community_posts" USING btree ("community_id","pinned_at") WHERE pinned_at is not null;
--> statement-breakpoint
-- Existing posts: their last activity is their creation time.
UPDATE "community_posts" SET "last_activity_at" = "created_at";
