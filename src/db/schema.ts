import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";

// Inquiries from the forms on the website. One table for every form: `topic` says which page it came from.
export const inquiries = pgTable(
  "inquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topic: text("topic").notNull(), // page slug: sessions, screening, sprint, shift, subscription, contact
    plan: text("plan"), // tier, format or scope the visitor picked
    name: text("name").notNull(),
    email: text("email").notNull(),
    company: text("company"),
    message: text("message").notNull(),
    page: text("page"), // path the form was sent from
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("inquiries_created_idx").on(t.createdAt)],
);

export type Inquiry = typeof inquiries.$inferSelect;

// Modules keep their own tables next to their code; they are listed here so drizzle-kit and getDb() see them.
export * from "@/modules/auth/schema";
export * from "@/modules/forms/schema";
