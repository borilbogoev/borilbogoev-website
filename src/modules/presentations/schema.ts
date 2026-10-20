import { sql } from "drizzle-orm";
import { pgTable, serial, integer, text, jsonb, timestamp, uuid, index, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "@/modules/auth/schema";
import { bbformsForms } from "@/modules/forms/schema";

// Presentations. A deck is an ordered list of slides, a slide is an ordered list of elements
// (same JSON-settings model as the Forms and Landing blocks).
//
//   presentation_categories ──< presentations        one category per deck (optional)
//   presentations ──< presentation_slides ──< presentation_elements     the content
//        │──< presentation_tag_links >── presentation_tags              free tags, many to many
//        │──< presentation_revisions                snapshots taken on every save, for undo
//        │──< presentation_forms >── bbforms_forms  which Forms forms a deck embeds
//        └──< presentation_views                    one row per opening (visitor and session are hashed)

export const presentationCategories = pgTable(
  "presentation_categories",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("presentation_categories_slug_idx").on(t.slug)],
);

export const presentations = pgTable(
  "presentations",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull().default(""),
    slug: text("slug").notNull(), // public address: /p/<slug>
    status: text("status").notNull().default("draft"), // draft | active | inactive | archived
    mode: text("mode").notNull().default("slides"), // how it opens: slides | accordion
    orientation: text("orientation").notNull().default("landscape"), // landscape | portrait | auto
    categoryId: integer("category_id").references(() => presentationCategories.id, { onDelete: "set null" }),
    passwordHash: text("password_hash"), // scrypt hash; null = open to anyone with the link
    settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("presentations_slug_idx").on(t.slug), index("presentations_status_idx").on(t.status), index("presentations_category_idx").on(t.categoryId)],
);

export const presentationSlides = pgTable(
  "presentation_slides",
  {
    id: serial("id").primaryKey(),
    presentationId: integer("presentation_id")
      .notNull()
      .references(() => presentations.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    kind: text("kind").notNull().default("blank"), // the template the slide started from: cover, section, bullets, video...
    settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`), // layout, background, notes, accordion title...
  },
  (t) => [index("presentation_slides_deck_pos_idx").on(t.presentationId, t.position)],
);

export const presentationElements = pgTable(
  "presentation_elements",
  {
    id: serial("id").primaryKey(),
    slideId: integer("slide_id")
      .notNull()
      .references(() => presentationSlides.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    type: text("type").notNull(), // heading, text, bullets, image, video, embed...
    settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
  },
  (t) => [index("presentation_elements_slide_pos_idx").on(t.slideId, t.position)],
);

export const presentationTags = pgTable(
  "presentation_tags",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
  },
  (t) => [uniqueIndex("presentation_tags_slug_idx").on(t.slug)],
);

export const presentationTagLinks = pgTable(
  "presentation_tag_links",
  {
    presentationId: integer("presentation_id")
      .notNull()
      .references(() => presentations.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => presentationTags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.presentationId, t.tagId] }), index("presentation_tag_links_tag_idx").on(t.tagId)],
);

export const presentationRevisions = pgTable(
  "presentation_revisions",
  {
    id: serial("id").primaryKey(),
    presentationId: integer("presentation_id")
      .notNull()
      .references(() => presentations.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    label: text("label").notNull().default(""),
    snapshot: jsonb("snapshot").notNull(), // { title, mode, orientation, settings, slides: [{ kind, settings, elements: [{ type, settings }] }] }
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("presentation_revisions_deck_idx").on(t.presentationId, t.createdAt)],
);

// Which forms a deck embeds. Kept in sync on every save, so a form can tell where it is used.
export const presentationForms = pgTable(
  "presentation_forms",
  {
    presentationId: integer("presentation_id")
      .notNull()
      .references(() => presentations.id, { onDelete: "cascade" }),
    formId: integer("form_id")
      .notNull()
      .references(() => bbformsForms.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.presentationId, t.formId] }), index("presentation_forms_form_idx").on(t.formId)],
);

export const presentationViews = pgTable(
  "presentation_views",
  {
    id: serial("id").primaryKey(),
    presentationId: integer("presentation_id")
      .notNull()
      .references(() => presentations.id, { onDelete: "cascade" }),
    visitorId: text("visitor_id").notNull(), // salted hash of a random id kept in the visitor's browser: unique viewers
    sessionId: text("session_id").notNull(), // salted hash of a random id kept for the browser tab: sessions
    mode: text("mode").notNull().default("slides"), // how it was watched: slides | accordion
    device: text("device").notNull().default(""),
    browser: text("browser").notNull().default(""),
    os: text("os").notNull().default(""),
    channel: text("channel").notNull().default("direct"),
    country: text("country").notNull().default(""),
    maxSlide: integer("max_slide").notNull().default(1), // furthest slide reached (1 = the first)
    seconds: integer("seconds").notNull().default(0), // time with the deck in view
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("presentation_views_deck_created_idx").on(t.presentationId, t.createdAt), index("presentation_views_deck_visitor_idx").on(t.presentationId, t.visitorId), index("presentation_views_deck_session_idx").on(t.presentationId, t.sessionId)],
);
