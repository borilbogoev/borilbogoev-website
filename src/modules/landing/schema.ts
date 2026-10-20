import { sql } from "drizzle-orm";
import { pgTable, serial, integer, text, jsonb, timestamp, uuid, index, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "@/modules/auth/schema";
import { bbformsForms } from "@/modules/forms/schema";

// Landing Pages. A page is an ordered list of blocks (same JSON-settings model as the Forms blocks).
//
//   landing_pages ──< landing_blocks      the page content, one row per block
//        │──< landing_revisions           snapshots taken on every save, for undo
//        │──< landing_forms >── bbforms_forms   which Forms forms a page embeds
//        │──< landing_views               one row per page view (visitor and session are hashed)
//        └──< landing_clicks              one row per click on a button or link

export const landingPages = pgTable(
  "landing_pages",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull().default(""),
    slug: text("slug").notNull(), // public address: /l/<slug>
    status: text("status").notNull().default("draft"), // draft | published | archived
    settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("landing_pages_slug_idx").on(t.slug), index("landing_pages_status_idx").on(t.status)],
);

export const landingBlocks = pgTable(
  "landing_blocks",
  {
    id: serial("id").primaryKey(),
    pageId: integer("page_id")
      .notNull()
      .references(() => landingPages.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    type: text("type").notNull(),
    settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
  },
  (t) => [index("landing_blocks_page_pos_idx").on(t.pageId, t.position)],
);

export const landingRevisions = pgTable(
  "landing_revisions",
  {
    id: serial("id").primaryKey(),
    pageId: integer("page_id")
      .notNull()
      .references(() => landingPages.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    label: text("label").notNull().default(""),
    snapshot: jsonb("snapshot").notNull(), // { title, slug, settings, blocks: [{ type, settings }] }
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("landing_revisions_page_idx").on(t.pageId, t.createdAt)],
);

// Which forms a page embeds. Kept in sync on every save, so a form can tell where it is used.
export const landingForms = pgTable(
  "landing_forms",
  {
    pageId: integer("page_id")
      .notNull()
      .references(() => landingPages.id, { onDelete: "cascade" }),
    formId: integer("form_id")
      .notNull()
      .references(() => bbformsForms.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.pageId, t.formId] }), index("landing_forms_form_idx").on(t.formId)],
);

export const landingViews = pgTable(
  "landing_views",
  {
    id: serial("id").primaryKey(),
    pageId: integer("page_id")
      .notNull()
      .references(() => landingPages.id, { onDelete: "cascade" }),
    visitorId: text("visitor_id").notNull(), // salted hash of a random id kept in the visitor's browser: unique views
    sessionId: text("session_id").notNull(), // salted hash of a random id kept for the browser tab: sessions
    device: text("device").notNull().default(""), // mobile | tablet | desktop
    browser: text("browser").notNull().default(""),
    os: text("os").notNull().default(""),
    channel: text("channel").notNull().default("direct"), // utm_source, else the referrer's host, else direct
    medium: text("medium").notNull().default(""),
    campaign: text("campaign").notNull().default(""),
    country: text("country").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("landing_views_page_created_idx").on(t.pageId, t.createdAt), index("landing_views_page_visitor_idx").on(t.pageId, t.visitorId), index("landing_views_page_session_idx").on(t.pageId, t.sessionId)],
);

export const landingClicks = pgTable(
  "landing_clicks",
  {
    id: serial("id").primaryKey(),
    pageId: integer("page_id")
      .notNull()
      .references(() => landingPages.id, { onDelete: "cascade" }),
    visitorId: text("visitor_id").notNull(),
    sessionId: text("session_id").notNull(),
    blockId: integer("block_id"), // no foreign key: blocks are replaced on save, the click keeps its label
    blockType: text("block_type").notNull().default(""),
    label: text("label").notNull().default(""), // the button or link text
    href: text("href").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("landing_clicks_page_created_idx").on(t.pageId, t.createdAt), index("landing_clicks_page_session_idx").on(t.pageId, t.sessionId)],
);
