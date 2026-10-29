CREATE TABLE "community_communities" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon_url" text,
	"cover_url" text,
	"visibility" text DEFAULT 'listed' NOT NULL,
	"join_mode" text DEFAULT 'open' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"region_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_admin_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"community_id" integer NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"request_id" text,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text DEFAULT 'direct' NOT NULL,
	"dm_key" text,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"community_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"banned_reason" text,
	"banned_at" timestamp with time zone,
	"banned_by" uuid,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_mentions" (
	"id" serial PRIMARY KEY NOT NULL,
	"community_id" integer,
	"source_type" text NOT NULL,
	"source_id" integer NOT NULL,
	"mentioned_user_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"sender_id" uuid NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "community_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"community_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"comment_id" integer,
	"source_type" text NOT NULL,
	"source_id" integer NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_conversation_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"last_read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_post_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer,
	"uploader_id" uuid NOT NULL,
	"url" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"width" integer DEFAULT 0 NOT NULL,
	"height" integer DEFAULT 0 NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"alt" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"community_id" integer NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"request_id" text,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"reporter_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"community_id" integer,
	"reason" text NOT NULL,
	"details" text,
	"message_snapshot" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"posting_paused" boolean DEFAULT false NOT NULL,
	"max_images_per_post" integer DEFAULT 4 NOT NULL,
	"max_image_mb" integer DEFAULT 8 NOT NULL,
	"rate_post_per_hour" integer DEFAULT 10 NOT NULL,
	"rate_comment_per_hour" integer DEFAULT 60 NOT NULL,
	"rate_message_per_minute" integer DEFAULT 20 NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_suspensions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lifted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "community_communities" ADD CONSTRAINT "community_communities_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_admin_log" ADD CONSTRAINT "community_admin_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_blocks" ADD CONSTRAINT "community_blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_blocks" ADD CONSTRAINT "community_blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_post_id_community_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_community_id_community_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community_communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_community_id_community_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community_communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_members" ADD CONSTRAINT "community_members_banned_by_users_id_fk" FOREIGN KEY ("banned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_mentions" ADD CONSTRAINT "community_mentions_community_id_community_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community_communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_mentions" ADD CONSTRAINT "community_mentions_mentioned_user_id_users_id_fk" FOREIGN KEY ("mentioned_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_mentions" ADD CONSTRAINT "community_mentions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_conversation_id_community_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."community_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_notifications" ADD CONSTRAINT "community_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_notifications" ADD CONSTRAINT "community_notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_notifications" ADD CONSTRAINT "community_notifications_community_id_community_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community_communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_notifications" ADD CONSTRAINT "community_notifications_post_id_community_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_notifications" ADD CONSTRAINT "community_notifications_comment_id_community_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."community_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_conversation_participants" ADD CONSTRAINT "community_conversation_participants_conversation_id_community_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."community_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_conversation_participants" ADD CONSTRAINT "community_conversation_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_post_media" ADD CONSTRAINT "community_post_media_post_id_community_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_post_media" ADD CONSTRAINT "community_post_media_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_community_id_community_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community_communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_community_id_community_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."community_communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_settings" ADD CONSTRAINT "community_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_suspensions" ADD CONSTRAINT "community_suspensions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_suspensions" ADD CONSTRAINT "community_suspensions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "community_communities_slug_idx" ON "community_communities" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "community_communities_default_idx" ON "community_communities" USING btree ("is_default") WHERE is_default;--> statement-breakpoint
CREATE INDEX "community_admin_log_idx" ON "community_admin_log" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "community_blocks_pair_idx" ON "community_blocks" USING btree ("blocker_id","blocked_id");--> statement-breakpoint
CREATE INDEX "community_blocks_blocked_idx" ON "community_blocks" USING btree ("blocked_id");--> statement-breakpoint
CREATE INDEX "community_comments_post_idx" ON "community_comments" USING btree ("post_id","created_at","id");--> statement-breakpoint
CREATE INDEX "community_comments_author_idx" ON "community_comments" USING btree ("author_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "community_comments_request_idx" ON "community_comments" USING btree ("author_id","request_id") WHERE request_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "community_conversations_dm_idx" ON "community_conversations" USING btree ("dm_key");--> statement-breakpoint
CREATE UNIQUE INDEX "community_members_pair_idx" ON "community_members" USING btree ("community_id","user_id");--> statement-breakpoint
CREATE INDEX "community_members_user_idx" ON "community_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "community_mentions_source_idx" ON "community_mentions" USING btree ("source_type","source_id","mentioned_user_id");--> statement-breakpoint
CREATE INDEX "community_mentions_user_idx" ON "community_mentions" USING btree ("mentioned_user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "community_messages_thread_idx" ON "community_messages" USING btree ("conversation_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "community_messages_request_idx" ON "community_messages" USING btree ("sender_id","request_id") WHERE request_id is not null;--> statement-breakpoint
CREATE INDEX "community_notifications_user_idx" ON "community_notifications" USING btree ("user_id","read_at","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "community_participants_pair_idx" ON "community_conversation_participants" USING btree ("conversation_id","user_id");--> statement-breakpoint
CREATE INDEX "community_participants_user_idx" ON "community_conversation_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "community_post_media_post_idx" ON "community_post_media" USING btree ("post_id","position");--> statement-breakpoint
CREATE INDEX "community_post_media_uploader_idx" ON "community_post_media" USING btree ("uploader_id");--> statement-breakpoint
CREATE INDEX "community_posts_feed_idx" ON "community_posts" USING btree ("community_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE status = 'published';--> statement-breakpoint
CREATE INDEX "community_posts_author_idx" ON "community_posts" USING btree ("author_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "community_posts_request_idx" ON "community_posts" USING btree ("author_id","request_id") WHERE request_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "community_reports_once_idx" ON "community_reports" USING btree ("reporter_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX "community_reports_queue_idx" ON "community_reports" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "community_suspensions_user_idx" ON "community_suspensions" USING btree ("user_id","lifted_at");
--> statement-breakpoint
-- Seed (idempotent): the default community and the settings row.
INSERT INTO "community_communities" ("slug", "name", "description", "visibility", "join_mode", "status", "is_default")
SELECT 'community', 'Community', 'The place to talk with other members.', 'listed', 'open', 'active', true
WHERE NOT EXISTS (SELECT 1 FROM "community_communities" WHERE "slug" = 'community');--> statement-breakpoint
INSERT INTO "community_settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;
