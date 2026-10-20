import { sql } from "drizzle-orm";
import { pgTable, serial, integer, text, boolean, jsonb, timestamp, date, uuid, index, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "@/modules/auth/schema";

// BB Forms. The tables mirror the six `bbforms-*` tables of the BB Forms WP plugin, so records migrate one to one.

export const bbformsForms = pgTable(
  "bbforms_forms",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull().default(""),
    status: text("status").notNull().default("active"), // active | draft | closed
    slug: text("slug"), // public page at /f/<slug> (/s/<slug> for the two legacy webinar forms); null: embed only
    settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
    lastSeq: integer("last_seq").notNull().default(0), // per-form response counter
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("bbforms_forms_status_idx").on(t.status), uniqueIndex("bbforms_forms_slug_idx").on(t.slug)],
);

export const bbformsBlocks = pgTable(
  "bbforms_blocks",
  {
    id: serial("id").primaryKey(),
    formId: integer("form_id")
      .notNull()
      .references(() => bbformsForms.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    type: text("type").notNull(),
    fieldKey: text("field_key").notNull().default(""), // "program name" used in CSV, webhooks and merge tags
    settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
  },
  (t) => [index("bbforms_blocks_form_pos_idx").on(t.formId, t.position)],
);

export const bbformsResponses = pgTable(
  "bbforms_responses",
  {
    id: serial("id").primaryKey(),
    formId: integer("form_id")
      .notNull()
      .references(() => bbformsForms.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull().default(0),
    status: text("status").notNull().default("complete"),
    isRead: boolean("is_read").notNull().default(false),
    origin: text("origin").notNull().default("form"), // form | admin
    channel: text("channel").notNull().default("direct"),
    device: text("device").notNull().default(""),
    ip: text("ip").notNull().default(""),
    ipHash: text("ip_hash").notNull().default(""),
    userAgent: text("user_agent").notNull().default(""),
    referrer: text("referrer"),
    pageUrl: text("page_url"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }), // set when an admin added the record
    duration: integer("duration").notNull().default(0), // seconds
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("bbforms_responses_form_created_idx").on(t.formId, t.createdAt),
    index("bbforms_responses_form_seq_idx").on(t.formId, t.seq),
    index("bbforms_responses_ip_hash_idx").on(t.ipHash, t.createdAt),
  ],
);

export const bbformsAnswers = pgTable(
  "bbforms_answers",
  {
    id: serial("id").primaryKey(),
    responseId: integer("response_id")
      .notNull()
      .references(() => bbformsResponses.id, { onDelete: "cascade" }),
    formId: integer("form_id").notNull(),
    fieldKey: text("field_key").notNull(),
    value: text("value"), // multi-value answers are stored as a JSON array string, as in the plugin
  },
  (t) => [index("bbforms_answers_response_idx").on(t.responseId), index("bbforms_answers_form_key_idx").on(t.formId, t.fieldKey)],
);

export const bbformsStats = pgTable(
  "bbforms_stats",
  {
    formId: integer("form_id")
      .notNull()
      .references(() => bbformsForms.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    views: integer("views").notNull().default(0),
    starts: integer("starts").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.formId, t.day] })],
);

export const bbformsSettings = pgTable("bbforms_settings", {
  name: text("name").primaryKey(),
  value: jsonb("value"),
});
