import { sql } from "drizzle-orm";
import { pgTable, serial, integer, text, jsonb, timestamp, uuid, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "@/modules/auth/schema";

// Community. People are the ordinary `users`; this module adds communities, a feed, comments, mentions, notifications and 1-1 chat.
//
//   community_communities ──< community_members >── users
//          │──< community_posts ──< community_post_media
//          │          └──< community_comments
//   community_mentions / community_notifications      (source_type + source_id point at a post, comment or message)
//   community_conversations ──< community_conversation_participants >── users
//          └──< community_messages
//   community_reports / community_blocks / community_suspensions
//   community_settings (one row)  /  community_admin_log

const at = (name: string) => timestamp(name, { withTimezone: true });
const userRef = (name: string) => uuid(name).references(() => users.id, { onDelete: "cascade" });
const userRefKeep = (name: string) => uuid(name).references(() => users.id, { onDelete: "set null" });

export const communities = pgTable(
  "community_communities",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(), // url segment, lowercase, immutable after creation
    name: text("name").notNull(),
    description: text("description"),
    iconUrl: text("icon_url"),
    coverUrl: text("cover_url"),
    visibility: text("visibility").notNull().default("listed"), // listed | hidden
    joinMode: text("join_mode").notNull().default("open"), // open | closed
    status: text("status").notNull().default("active"), // active | archived
    isDefault: boolean("is_default").notNull().default(false),
    regionId: text("region_id"), // reserved, unused in v1
    sortOrder: integer("sort_order").notNull().default(0),
    defaultSort: text("default_sort").notNull().default("default"), // sort rule of the "All" feed: default | new | top
    createdBy: userRefKeep("created_by"),
    createdAt: at("created_at").notNull().defaultNow(),
    updatedAt: at("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("community_communities_slug_idx").on(t.slug), uniqueIndex("community_communities_default_idx").on(t.isDefault).where(sql`is_default`)],
);

// Categories inside a community. Published ones are tabs in its feed; `sortRule` is the default order of that tab.
export const communityCategories = pgTable(
  "community_categories",
  {
    id: serial("id").primaryKey(),
    communityId: integer("community_id").notNull().references(() => communities.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: text("status").notNull().default("draft"), // draft | published
    sortRule: text("sort_rule").notNull().default("default"), // default | new | top
    position: integer("position").notNull().default(0),
    createdAt: at("created_at").notNull().defaultNow(),
    updatedAt: at("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("community_categories_slug_idx").on(t.communityId, t.slug), index("community_categories_pos_idx").on(t.communityId, t.position)],
);

export const communityMembers = pgTable(
  "community_members",
  {
    id: serial("id").primaryKey(),
    communityId: integer("community_id").notNull().references(() => communities.id, { onDelete: "cascade" }),
    userId: userRef("user_id").notNull(),
    role: text("role").notNull().default("member"), // member | moderator
    status: text("status").notNull().default("active"), // active | banned
    bannedReason: text("banned_reason"),
    bannedAt: at("banned_at"),
    bannedBy: userRefKeep("banned_by"),
    joinedAt: at("joined_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("community_members_pair_idx").on(t.communityId, t.userId), index("community_members_user_idx").on(t.userId)],
);

export const communityPosts = pgTable(
  "community_posts",
  {
    id: serial("id").primaryKey(),
    communityId: integer("community_id").notNull().references(() => communities.id, { onDelete: "cascade" }),
    authorId: userRef("author_id").notNull(),
    body: text("body").notNull().default(""), // plain text with mention tokens, max 5000
    commentCount: integer("comment_count").notNull().default(0), // published comments only
    likeCount: integer("like_count").notNull().default(0),
    kind: text("kind").notNull().default("post"), // post | rich (a post built from blocks, SuperAdmin only)
    title: text("title"), // rich posts
    blocks: jsonb("blocks").notNull().default(sql`'[]'::jsonb`), // rich posts: [{ type, settings }]
    categoryId: integer("category_id").references(() => communityCategories.id, { onDelete: "set null" }),
    pinnedAt: at("pinned_at"),
    commentsLocked: boolean("comments_locked").notNull().default(false),
    lastActivityAt: at("last_activity_at").notNull().defaultNow(), // newest of: the post, its latest comment
    status: text("status").notNull().default("published"), // published | hidden_by_mod | deleted | draft (rich posts only)
    requestId: text("request_id"), // client-generated, makes a double submit harmless
    editedAt: at("edited_at"),
    deletedAt: at("deleted_at"),
    createdAt: at("created_at").notNull().defaultNow(),
    updatedAt: at("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("community_posts_feed_idx").on(t.communityId, t.createdAt.desc(), t.id.desc()).where(sql`status = 'published'`),
    index("community_posts_author_idx").on(t.authorId, t.createdAt.desc()),
    index("community_posts_category_idx").on(t.communityId, t.categoryId, t.createdAt.desc(), t.id.desc()).where(sql`status = 'published'`),
    index("community_posts_activity_idx").on(t.communityId, t.lastActivityAt.desc(), t.id.desc()).where(sql`status = 'published'`),
    index("community_posts_top_idx").on(t.communityId, t.likeCount.desc(), t.createdAt.desc(), t.id.desc()).where(sql`status = 'published'`),
    index("community_posts_pinned_idx").on(t.communityId, t.pinnedAt).where(sql`pinned_at is not null`),
    uniqueIndex("community_posts_request_idx").on(t.authorId, t.requestId).where(sql`request_id is not null`),
  ],
);

export const communityPostMedia = pgTable(
  "community_post_media",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id").references(() => communityPosts.id, { onDelete: "cascade" }), // null until the post is created
    uploaderId: userRef("uploader_id").notNull(),
    url: text("url").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    width: integer("width").notNull().default(0),
    height: integer("height").notNull().default(0),
    sizeBytes: integer("size_bytes").notNull().default(0),
    alt: text("alt"),
    position: integer("position").notNull().default(0), // 0 to 3
    createdAt: at("created_at").notNull().defaultNow(),
  },
  (t) => [index("community_post_media_post_idx").on(t.postId, t.position), index("community_post_media_uploader_idx").on(t.uploaderId)],
);

export const communityComments = pgTable(
  "community_comments",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id").notNull().references(() => communityPosts.id, { onDelete: "cascade" }),
    communityId: integer("community_id").notNull().references(() => communities.id, { onDelete: "cascade" }),
    authorId: userRef("author_id").notNull(),
    body: text("body").notNull(), // plain text with mention tokens, max 2000
    likeCount: integer("like_count").notNull().default(0),
    status: text("status").notNull().default("published"), // published | hidden_by_mod | deleted
    requestId: text("request_id"),
    editedAt: at("edited_at"),
    deletedAt: at("deleted_at"),
    createdAt: at("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("community_comments_post_idx").on(t.postId, t.createdAt.asc(), t.id.asc()),
    index("community_comments_author_idx").on(t.authorId, t.createdAt.desc()),
    uniqueIndex("community_comments_request_idx").on(t.authorId, t.requestId).where(sql`request_id is not null`),
  ],
);

// Which posts a person has opened, for the "Unread" filter.
export const communityPostReads = pgTable(
  "community_post_reads",
  {
    userId: userRef("user_id").notNull(),
    postId: integer("post_id").notNull().references(() => communityPosts.id, { onDelete: "cascade" }),
    readAt: at("read_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("community_post_reads_pair_idx").on(t.userId, t.postId), index("community_post_reads_post_idx").on(t.postId)],
);

export const communityLikes = pgTable(
  "community_likes",
  {
    id: serial("id").primaryKey(),
    userId: userRef("user_id").notNull(),
    targetType: text("target_type").notNull(), // post | comment
    targetId: integer("target_id").notNull(),
    createdAt: at("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("community_likes_once_idx").on(t.userId, t.targetType, t.targetId), index("community_likes_target_idx").on(t.targetType, t.targetId)],
);

export const communityMentions = pgTable(
  "community_mentions",
  {
    id: serial("id").primaryKey(),
    communityId: integer("community_id").references(() => communities.id, { onDelete: "cascade" }), // null for chat
    sourceType: text("source_type").notNull(), // post | comment | message
    sourceId: integer("source_id").notNull(),
    mentionedUserId: userRef("mentioned_user_id").notNull(),
    authorId: userRef("author_id").notNull(),
    createdAt: at("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("community_mentions_source_idx").on(t.sourceType, t.sourceId, t.mentionedUserId), index("community_mentions_user_idx").on(t.mentionedUserId, t.createdAt.desc())],
);

export const communityConversations = pgTable(
  "community_conversations",
  {
    id: serial("id").primaryKey(),
    type: text("type").notNull().default("direct"), // direct only in v1
    dmKey: text("dm_key"), // "<smaller user id>:<larger user id>"; one direct conversation per pair
    lastMessageAt: at("last_message_at"),
    createdAt: at("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("community_conversations_dm_idx").on(t.dmKey)],
);

export const communityParticipants = pgTable(
  "community_conversation_participants",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id").notNull().references(() => communityConversations.id, { onDelete: "cascade" }),
    userId: userRef("user_id").notNull(),
    lastReadAt: at("last_read_at"),
    createdAt: at("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("community_participants_pair_idx").on(t.conversationId, t.userId), index("community_participants_user_idx").on(t.userId)],
);

export const communityMessages = pgTable(
  "community_messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id").notNull().references(() => communityConversations.id, { onDelete: "cascade" }),
    senderId: userRef("sender_id").notNull(),
    body: text("body").notNull(), // max 4000
    status: text("status").notNull().default("sent"), // sent | deleted
    requestId: text("request_id"),
    createdAt: at("created_at").notNull().defaultNow(),
    deletedAt: at("deleted_at"),
  },
  (t) => [
    index("community_messages_thread_idx").on(t.conversationId, t.createdAt.desc(), t.id.desc()),
    uniqueIndex("community_messages_request_idx").on(t.senderId, t.requestId).where(sql`request_id is not null`),
  ],
);

export const communityNotifications = pgTable(
  "community_notifications",
  {
    id: serial("id").primaryKey(),
    userId: userRef("user_id").notNull(), // recipient
    type: text("type").notNull(), // mention | post_comment
    actorId: userRef("actor_id").notNull(),
    communityId: integer("community_id").notNull().references(() => communities.id, { onDelete: "cascade" }),
    postId: integer("post_id").notNull().references(() => communityPosts.id, { onDelete: "cascade" }),
    commentId: integer("comment_id").references(() => communityComments.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(), // post | comment
    sourceId: integer("source_id").notNull(),
    readAt: at("read_at"),
    createdAt: at("created_at").notNull().defaultNow(),
  },
  (t) => [index("community_notifications_user_idx").on(t.userId, t.readAt, t.createdAt.desc())],
);

export const communityReports = pgTable(
  "community_reports",
  {
    id: serial("id").primaryKey(),
    reporterId: userRef("reporter_id").notNull(),
    targetType: text("target_type").notNull(), // post | comment | message | user
    targetId: text("target_id").notNull(), // an integer id, or a user uuid when target_type is user
    communityId: integer("community_id").references(() => communities.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(), // spam | abuse | inappropriate | other
    details: text("details"), // max 500
    messageSnapshot: text("message_snapshot"), // only for message reports
    status: text("status").notNull().default("open"), // open | resolved | dismissed
    resolvedBy: userRefKeep("resolved_by"),
    resolvedAt: at("resolved_at"),
    resolutionNote: text("resolution_note"),
    createdAt: at("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("community_reports_once_idx").on(t.reporterId, t.targetType, t.targetId), index("community_reports_queue_idx").on(t.status, t.createdAt.desc())],
);

export const communityBlocks = pgTable(
  "community_blocks",
  {
    id: serial("id").primaryKey(),
    blockerId: userRef("blocker_id").notNull(),
    blockedId: userRef("blocked_id").notNull(),
    createdAt: at("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("community_blocks_pair_idx").on(t.blockerId, t.blockedId), index("community_blocks_blocked_idx").on(t.blockedId)],
);

export const communitySuspensions = pgTable(
  "community_suspensions",
  {
    id: serial("id").primaryKey(),
    userId: userRef("user_id").notNull(),
    reason: text("reason"),
    createdBy: userRefKeep("created_by"),
    createdAt: at("created_at").notNull().defaultNow(),
    liftedAt: at("lifted_at"),
  },
  (t) => [index("community_suspensions_user_idx").on(t.userId, t.liftedAt)],
);

export const communitySettings = pgTable("community_settings", {
  id: integer("id").primaryKey(), // always 1
  postingPaused: boolean("posting_paused").notNull().default(false),
  maxImagesPerPost: integer("max_images_per_post").notNull().default(4),
  maxImageMb: integer("max_image_mb").notNull().default(8),
  ratePostPerHour: integer("rate_post_per_hour").notNull().default(10),
  rateCommentPerHour: integer("rate_comment_per_hour").notNull().default(60),
  rateMessagePerMinute: integer("rate_message_per_minute").notNull().default(20),
  updatedBy: userRefKeep("updated_by"),
  updatedAt: at("updated_at").notNull().defaultNow(),
});

export const communityAdminLog = pgTable(
  "community_admin_log",
  {
    id: serial("id").primaryKey(),
    actorId: userRefKeep("actor_id"),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    meta: jsonb("meta").notNull().default(sql`'{}'::jsonb`),
    createdAt: at("created_at").notNull().defaultNow(),
  },
  (t) => [index("community_admin_log_idx").on(t.createdAt.desc())],
);
