ALTER TABLE "community_posts" ADD COLUMN "theme" text DEFAULT 'ink' NOT NULL;--> statement-breakpoint
ALTER TABLE "community_posts" ADD COLUMN "featured" jsonb DEFAULT '{}'::jsonb NOT NULL;