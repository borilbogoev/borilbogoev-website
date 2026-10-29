// Turns the people who answered a form into Student accounts and enrols them in a School course.
//
//   npx tsx scripts/enrol-respondents.ts --form <form-slug> --course <course-slug> [--apply]
//
// Without --apply it only reports what it would do. It reads first_name, last_name and email from each response, makes one account per
// email (an existing account is kept as it is, never changed), gives new accounts a username taken from the email, and enrols everyone
// with an active account. Safe to run again: nobody is created or enrolled twice. Output never prints full email addresses.
try {
  process.loadEnvFile(".env.local");
} catch {
  // DATABASE_URL may already be in the environment
}

const args = process.argv.slice(2);
const opt = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i > -1 ? args[i + 1] : undefined;
};
const apply = args.includes("--apply");
const formSlug = opt("form");
const courseSlug = opt("course");
if (!formSlug || !courseSlug) {
  console.error("Usage: npx tsx scripts/enrol-respondents.ts --form <form-slug> --course <course-slug> [--apply]");
  process.exit(1);
}

const mask = (e: string) => e.replace(/^(.{2}).*(@.*)$/, "$1***$2");
const nice = (s: string) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t && (t === t.toLowerCase() || t === t.toUpperCase()) ? t.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase()) : t;
};

async function main() {
  const { sql } = await import("drizzle-orm");
  const { db, rowsOf } = await import("../src/db/use");
  const { createUser, getUserByEmail, normalizeEmail } = await import("../src/modules/auth/users");
  const { usernameFrom } = await import("../src/modules/account/lib/profile");
  const { getCourseBySlug } = await import("../src/modules/school/lib/courses");
  const { adminEnrol, getEnrolment } = await import("../src/modules/school/lib/access");

  const course = await getCourseBySlug(courseSlug as string);
  if (!course) throw new Error(`No course "${courseSlug}".`);
  const [form] = rowsOf<{ id: number; title: string }>(await db().execute(sql`SELECT id, title FROM bbforms_forms WHERE slug = ${formSlug as string}`));
  if (!form) throw new Error(`No form "${formSlug}".`);

  // One row per response, oldest first, so a later response's spelling of the name wins.
  const rows = rowsOf<{ response_id: number; field_key: string; value: string | null }>(
    await db().execute(sql`
      SELECT a.response_id, a.field_key, a.value FROM bbforms_answers a JOIN bbforms_responses r ON r.id = a.response_id
      WHERE a.form_id = ${form.id} AND a.field_key IN ('first_name', 'last_name', 'email') ORDER BY r.created_at, a.response_id`),
  );
  const byResponse = new Map<number, Record<string, string>>();
  for (const r of rows) byResponse.set(Number(r.response_id), { ...(byResponse.get(Number(r.response_id)) ?? {}), [r.field_key]: String(r.value ?? "").trim() });
  const people = new Map<string, string>(); // email -> name
  let invalid = 0;
  for (const a of byResponse.values()) {
    const email = normalizeEmail(a.email ?? "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      invalid++;
      continue;
    }
    const name = nice([a.first_name, a.last_name].filter(Boolean).join(" "));
    people.set(email, name || people.get(email) || "");
  }

  const taken = new Set(rowsOf<{ username: string }>(await db().execute(sql`SELECT username FROM users WHERE username IS NOT NULL`)).map((u) => u.username));
  const report = { form: form.title, course: course.title, responses: byResponse.size, people: people.size, invalid_email: invalid, created: 0, existing: 0, enrolled: 0, already_enrolled: 0, skipped_disabled: 0, mode: apply ? "applied" : "dry run" };
  for (const [email, name] of people) {
    let user = await getUserByEmail(email);
    if (!user) {
      report.created++;
      if (!apply) {
        report.enrolled++;
        continue;
      }
      user = await createUser({ email, name, role: "student", password: null });
      const username = usernameFrom(email, taken);
      await db().execute(sql`UPDATE users SET username = ${username} WHERE id = ${user.id}`);
    } else {
      report.existing++;
      if (!user.username && apply) await db().execute(sql`UPDATE users SET username = ${usernameFrom(email, taken)} WHERE id = ${user.id}`);
    }
    if (user.status !== "active") {
      report.skipped_disabled++;
      console.error(`skipped (account disabled): ${mask(email)}`);
      continue;
    }
    if (await getEnrolment(user.id, course.id)) {
      report.already_enrolled++;
      continue;
    }
    report.enrolled++;
    if (apply) await adminEnrol(user.id, course, { note: `Joined from the form "${form.title}"` });
  }
  console.log(JSON.stringify(report, null, 2));
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
