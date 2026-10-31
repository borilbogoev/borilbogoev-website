CREATE TABLE "user_tag_members" (
	"tag_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_tag_members" ADD CONSTRAINT "user_tag_members_tag_id_user_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."user_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tag_members" ADD CONSTRAINT "user_tag_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tags" ADD CONSTRAINT "user_tags_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_tag_members_pair_idx" ON "user_tag_members" USING btree ("tag_id","user_id");--> statement-breakpoint
CREATE INDEX "user_tag_members_user_idx" ON "user_tag_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_tags_slug_idx" ON "user_tags" USING btree ("slug");