// Imports the BB Forms WP data (phpMyAdmin exports of the six bbforms-* tables) into the Forms module.
//
//   npx tsx scripts/import-wordpress.ts --dir "<folder with the .sql exports>" --dry-run
//   npx tsx scripts/import-wordpress.ts --dir "<folder>" --apply [--tz UTC] [--owner you@example.com] [--force]
//
// --dry-run  runs the whole import against a throw-away in-memory Postgres (PGlite) and prints the report.
// --apply    runs it against DATABASE_URL (Neon) in one transaction, then verifies the result.
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { planImport, readWpExports, verifyImport, type Plan, type Query, type Stmt } from "../src/modules/forms/migrate/wordpress";

try {
  process.loadEnvFile(".env.local");
} catch {
  // DATABASE_URL may already be in the environment
}

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i > -1 ? args[i + 1] : undefined;
};

const dir = opt("dir");
if (!dir || (!flag("dry-run") && !flag("apply"))) {
  console.error('Usage: tsx scripts/import-wordpress.ts --dir "<exports folder>" (--dry-run | --apply) [--tz UTC] [--owner email] [--force]');
  process.exit(1);
}
const wpTimeZone = opt("tz") ?? "UTC";

// The Image block of the two webinar forms pointed at a WordPress upload. The file was copied to /public/forms.
const assetMap: Record<string, string> = {
  "https://borilbogoev.com/wp-content/uploads/2026/10/Webinar-3-Headaches-1024x576.jpg": "/forms/webinar-3-headaches-1024x576.jpg",
};

type Runner = { query: Query; run: (stmts: Stmt[]) => Promise<void>; close: () => Promise<void>; label: string };

async function pgliteRunner(): Promise<Runner> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite();
  const { readdirSync } = await import("node:fs");
  for (const f of readdirSync("drizzle").filter((x) => x.endsWith(".sql")).sort()) {
    for (const part of readFileSync(`drizzle/${f}`, "utf8").split("--> statement-breakpoint")) if (part.trim()) await pg.exec(part);
  }
  return {
    label: "in-memory PGlite (dry run)",
    query: async (text, params = []) => (await pg.query(text, params)).rows as Record<string, unknown>[],
    run: async (stmts) => {
      await pg.transaction(async (tx) => {
        for (const s of stmts) await tx.query(s.text, s.params);
      });
    },
    close: () => pg.close(),
  };
}

function neonRunner(): Runner {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const sql = neon(url);
  return {
    label: `Neon (${new URL(url).host})`,
    query: async (text, params = []) => (await sql.query(text, params)) as Record<string, unknown>[],
    run: async (stmts) => {
      await sql.transaction(stmts.map((s) => sql.query(s.text, s.params)));
    },
    close: async () => {},
  };
}

async function main() {
  const data = readWpExports(dir!);
  const plan: Plan = planImport(data, { wpTimeZone, ownerEmail: opt("owner"), force: flag("force"), assetMap });
  console.log(`Read ${plan.expected.forms} forms, ${plan.expected.blocks} blocks, ${plan.expected.responses} responses, ${plan.expected.answers} answers, ${plan.expected.stats} daily stats.`);
  console.log(`WordPress time zone: ${wpTimeZone}`);
  for (const n of plan.notes) console.log(`note: ${n}`);

  const runner = flag("apply") ? neonRunner() : await pgliteRunner();
  console.log(`Target: ${runner.label}`);

  if (flag("apply") && !flag("force")) {
    const ids = data.forms.map((f) => Number(f.id));
    const [{ n }] = await runner.query("SELECT COUNT(*)::int AS n FROM bbforms_forms WHERE id = ANY($1::int[])", [ids]);
    if (Number(n) > 0) {
      console.error(`${n} of these forms already exist in the target. Nothing was changed. Use --force to replace them.`);
      process.exit(2);
    }
  }

  await runner.run(plan.statements);
  console.log("Import committed. Verifying...");
  const checks = await verifyImport(runner.query, data, plan, wpTimeZone);
  let bad = 0;
  for (const c of checks) {
    if (!c.ok) bad++;
    console.log(`${c.ok ? "ok  " : "FAIL"} ${c.name}: expected ${c.expected}, found ${c.actual}`);
  }
  await runner.close();
  if (bad) {
    console.error(`${bad} check(s) failed.`);
    process.exit(3);
  }
  console.log("All checks passed.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
