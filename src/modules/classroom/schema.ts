import { sql } from "drizzle-orm";
import { pgTable, serial, integer, text, jsonb, timestamp, uuid, boolean, index, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "@/modules/auth/schema";

// Classroom. People are the ordinary `users` of the app: a student is a user with the role "student" (see modules/auth/roles.ts),
// so sign-in, roles, disabling and deleting people all stay in Admin > Users. This module only adds what is about learning.
//
//   classroom_categories ──< classroom_courses ──< classroom_modules ──< classroom_lessons ──< classroom_blocks
//                                  │                                          │──< classroom_lesson_revisions   snapshots on every save
//                                  │                                          └──< classroom_block_state        a student's answer to one block
//                                  └──< classroom_enrolments >── users        who may learn what, and whether a transfer is confirmed
//   classroom_progress / classroom_notes / classroom_comments                  per student and lesson
//   classroom_settings                                                         bank details, Bunny.net keys, sign-up rules

type Image = { id?: number; url?: string; width?: number; height?: number; variants?: { w: number; url: string }[] };

export const classroomCategories = pgTable(
  "classroom_categories",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    summary: text("summary").notNull().default(""), // short description shown on the category card
    image: jsonb("image").$type<Image>().notNull().default(sql`'{}'::jsonb`),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("classroom_categories_slug_idx").on(t.slug)],
);

export const classroomCourses = pgTable(
  "classroom_courses",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull().default(""),
    slug: text("slug").notNull(), // public address: /classroom/<slug>
    status: text("status").notNull().default("draft"), // draft | active | inactive | archived
    categoryId: integer("category_id").references(() => classroomCategories.id, { onDelete: "set null" }),
    summary: text("summary").notNull().default(""), // short description shown on the course card
    image: jsonb("image").$type<Image>().notNull().default(sql`'{}'::jsonb`),
    language: text("language").notNull().default("en"), // language of the content; the interface is English for now
    access: text("access").notNull().default("open"), // open: any student may enrol | paid: bank transfer, confirmed by an admin | invite: admins enrol
    priceCents: integer("price_cents").notNull().default(0), // paid courses, in minor units of `currency`
    currency: text("currency").notNull().default("AED"),
    settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`), // level, outcomes, instructor, seo...
    position: integer("position").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("classroom_courses_slug_idx").on(t.slug), index("classroom_courses_status_idx").on(t.status), index("classroom_courses_category_idx").on(t.categoryId)],
);

export const classroomModules = pgTable(
  "classroom_modules",
  {
    id: serial("id").primaryKey(),
    courseId: integer("course_id")
      .notNull()
      .references(() => classroomCourses.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    slug: text("slug").notNull(), // unique inside the course
    summary: text("summary").notNull().default(""),
    image: jsonb("image").$type<Image>().notNull().default(sql`'{}'::jsonb`),
    position: integer("position").notNull().default(0),
    settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
  },
  (t) => [uniqueIndex("classroom_modules_slug_idx").on(t.courseId, t.slug), index("classroom_modules_course_pos_idx").on(t.courseId, t.position)],
);

export const classroomLessons = pgTable(
  "classroom_lessons",
  {
    id: serial("id").primaryKey(),
    courseId: integer("course_id")
      .notNull()
      .references(() => classroomCourses.id, { onDelete: "cascade" }),
    moduleId: integer("module_id")
      .notNull()
      .references(() => classroomModules.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    slug: text("slug").notNull(), // unique inside the module
    summary: text("summary").notNull().default(""),
    image: jsonb("image").$type<Image>().notNull().default(sql`'{}'::jsonb`), // featured image
    position: integer("position").notNull().default(0),
    status: text("status").notNull().default("active"), // draft lessons are hidden from students
    preview: boolean("preview").notNull().default(false), // free preview: open to anyone signed in, enrolled or not
    minutes: integer("minutes").notNull().default(0), // estimated time
    settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("classroom_lessons_slug_idx").on(t.moduleId, t.slug), index("classroom_lessons_module_pos_idx").on(t.moduleId, t.position), index("classroom_lessons_course_idx").on(t.courseId)],
);

export const classroomBlocks = pgTable(
  "classroom_blocks",
  {
    id: serial("id").primaryKey(),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => classroomLessons.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    type: text("type").notNull(), // heading, text, video, audio, callout, flashcards, checklist...
    settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
  },
  (t) => [index("classroom_blocks_lesson_pos_idx").on(t.lessonId, t.position)],
);

export const classroomLessonRevisions = pgTable(
  "classroom_lesson_revisions",
  {
    id: serial("id").primaryKey(),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => classroomLessons.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    snapshot: jsonb("snapshot").notNull(), // { title, summary, image, preview, minutes, blocks: [{ type, settings }] }
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("classroom_lesson_revisions_lesson_idx").on(t.lessonId, t.createdAt)],
);

// Who may learn what. One row per student and course. `pending` is a bank transfer that is not confirmed yet.
export const classroomEnrolments = pgTable(
  "classroom_enrolments",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: integer("course_id")
      .notNull()
      .references(() => classroomCourses.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("active"), // pending | active | revoked
    source: text("source").notNull().default("self"), // self | admin
    amountCents: integer("amount_cents").notNull().default(0), // the price when the student enrolled
    currency: text("currency").notNull().default("AED"),
    paidAt: timestamp("paid_at", { withTimezone: true }), // when an admin confirmed the transfer
    note: text("note").notNull().default(""), // free note of the admin: bank reference, discount, reason
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("classroom_enrolments_user_course_idx").on(t.userId, t.courseId), index("classroom_enrolments_course_idx").on(t.courseId, t.status)],
);

export const classroomProgress = pgTable(
  "classroom_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => classroomLessons.id, { onDelete: "cascade" }),
    courseId: integer("course_id")
      .notNull()
      .references(() => classroomCourses.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    position: integer("position").notNull().default(0), // seconds into the lesson's video, to resume
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonId] }), index("classroom_progress_user_course_idx").on(t.userId, t.courseId)],
);

// A student's private notes: one document per student and lesson.
export const classroomNotes = pgTable(
  "classroom_notes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => classroomLessons.id, { onDelete: "cascade" }),
    body: text("body").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonId] })],
);

// Questions and comments under a lesson. `instructor` visibility: only the author and the staff can read it.
export const classroomComments = pgTable(
  "classroom_comments",
  {
    id: serial("id").primaryKey(),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => classroomLessons.id, { onDelete: "cascade" }),
    courseId: integer("course_id")
      .notNull()
      .references(() => classroomCourses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: integer("parent_id"), // a reply points at the comment it answers (one level deep)
    body: text("body").notNull(),
    visibility: text("visibility").notNull().default("class"), // class | instructor
    status: text("status").notNull().default("visible"), // visible | hidden (hidden by a moderator)
    resolved: boolean("resolved").notNull().default(false), // a question that has been answered
    pinned: boolean("pinned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
  },
  (t) => [index("classroom_comments_lesson_idx").on(t.lessonId, t.createdAt), index("classroom_comments_course_idx").on(t.courseId, t.createdAt)],
);

// A student's state in one interactive block: checklist ticks, a written answer, flashcard boxes, later poll votes and quiz picks.
export const classroomBlockState = pgTable(
  "classroom_block_state",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockId: integer("block_id")
      .notNull()
      .references(() => classroomBlocks.id, { onDelete: "cascade" }),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => classroomLessons.id, { onDelete: "cascade" }),
    data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.blockId] }), index("classroom_block_state_lesson_idx").on(t.lessonId)],
);

export const classroomSettings = pgTable("classroom_settings", {
  name: text("name").primaryKey(),
  value: jsonb("value").notNull(),
});
