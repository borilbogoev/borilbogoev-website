import { pgTable, uuid, text, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";

// People who can sign in: staff to /admin, everyone else to their own area at /account. An owner or admin creates accounts; students may also sign up when School sign-up is open.
// `role` is one of the keys in ./roles.ts and is always read from here, never from the session cookie.
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(), // stored lowercase
    name: text("name").notNull().default(""),
    username: text("username"), // stored lowercase, unique; null until the person picks one
    avatarUrl: text("avatar_url"), // served through /api/account/avatar/...
    phone: text("phone"),
    company: text("company"),
    jobTitle: text("job_title"),
    country: text("country"),
    timezone: text("timezone"),
    bio: text("bio"),
    role: text("role").notNull().default("viewer"),
    status: text("status").notNull().default("active"), // active | disabled
    passwordHash: text("password_hash"), // null: signs in with Google only
    sessionVersion: integer("session_version").notNull().default(0), // bump to sign the user out everywhere
    failedAttempts: integer("failed_attempts").notNull().default(0), // wrong passwords since the last good sign-in
    lockedUntil: timestamp("locked_until", { withTimezone: true }), // sign-in paused after too many wrong passwords
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email), uniqueIndex("users_username_idx").on(t.username)],
);

export type User = typeof users.$inferSelect;
