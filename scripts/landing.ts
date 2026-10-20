// Manage landing pages from the terminal, without opening the admin. Built so an AI assistant (or you) can create and edit a page in seconds.
//
//   npx tsx scripts/landing.ts <command> [arguments]
//
//   catalog [type]                    every block type with its settings (JSON). Start here when writing a page.
//   templates                         the starter templates
//   forms                             the forms a Form block can embed (id, title)
//   list                              all pages with views, clicks and CTR
//   get <id|slug>                     one page with its blocks and the brand check
//   validate <file.json>              sanitise a page spec and run the brand check; writes nothing
//   create <file.json> [--publish]    create a page from a spec file (see docs/landing-pages.md)
//   update <id|slug> <file.json>      replace the title, settings and/or blocks of a page with those of the file
//   status <id|slug> <draft|published|archived>
//   duplicate <id|slug>
//   delete <id|slug> --yes
//   stats <id|slug> [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--interval day|week|month]
//   revisions <id|slug>               earlier versions kept on every save
//   restore <id|slug> <revisionId>
//   refresh [slug ...]                ask the live site to rebuild the cached page(s) now
//
// Output is JSON. It runs against DATABASE_URL (from .env.local). After a change to a published page it asks the site to refresh
// the page at once when LANDING_API_TOKEN (or CRON_SECRET) is set; otherwise the page refreshes within 5 minutes.
import { readFileSync } from "node:fs";

try {
  process.loadEnvFile(".env.local");
} catch {
  // DATABASE_URL may already be in the environment
}

const args = process.argv.slice(2);
const cmd = args[0];
const rest = args.slice(1).filter((a) => !a.startsWith("--"));
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i > -1 ? args[i + 1] : undefined;
};
const out = (v: unknown) => console.log(JSON.stringify(v, null, 2));
const fail = (message: string): never => {
  console.error(JSON.stringify({ error: message }));
  process.exit(1);
};

async function main() {
  const { LANDING_BLOCKS, LANDING_GROUPS, isLandingBlockType, landingDefaults, sanitizeLandingBlock } = await import("../src/modules/landing/lib/blocks");
  const { brandIssues } = await import("../src/modules/landing/lib/brand");
  const pages = await import("../src/modules/landing/lib/pages");
  const { sanitizeLandingSettings } = await import("../src/modules/landing/lib/settings");
  const { TEMPLATES } = await import("../src/modules/landing/lib/templates");
  const { site } = await import("../src/content/site");

  const siteUrl = process.env.LANDING_SITE_URL || site.url;
  const urlOf = (slug: string) => `${siteUrl}/l/${slug}`;

  type Spec = { title?: string; slug?: string; status?: string; settings?: Record<string, unknown>; blocks?: { type: string; settings?: Record<string, unknown> }[] };
  const readSpec = (file: string | undefined): Spec => {
    if (!file) return fail("Give the path of a JSON file.");
    try {
      return JSON.parse(readFileSync(file as string, "utf8")) as Spec;
    } catch (e) {
      return fail(`Cannot read ${file}: ${e instanceof Error ? e.message : e}`);
    }
  };
  const unknownTypes = (spec: Spec) => (spec.blocks ?? []).map((b, i) => (isLandingBlockType(b.type) ? "" : `blocks[${i}]: unknown type "${b.type}". Run: catalog`)).filter(Boolean);
  const find = async (ref: string | undefined) => {
    if (!ref) return fail("Give the page id or address (slug).");
    return (await pages.findPage(ref)) ?? fail(`No page "${ref}".`);
  };
  const summary = async (id: number) => {
    const page = (await pages.getPage(id))!;
    const blocks = await pages.getBlocks(id);
    return { id: page.id, title: page.title, slug: page.slug, status: page.status, url: urlOf(page.slug), blocks: blocks.length, issues: brandIssues(blocks, page.settings) };
  };
  const refresh = async (slugs: string[]) => {
    const token = process.env.LANDING_API_TOKEN || process.env.CRON_SECRET;
    if (!token || !slugs.length) return { refreshed: false, note: token ? "nothing to refresh" : "No LANDING_API_TOKEN set: the live page updates within 5 minutes." };
    try {
      const res = await fetch(`${siteUrl}/api/landing/revalidate`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ slugs }) });
      return { refreshed: res.ok, refresh_status: res.status };
    } catch (e) {
      return { refreshed: false, note: String(e) };
    }
  };

  switch (cmd) {
    case "catalog": {
      const only = rest[0];
      if (only && !isLandingBlockType(only)) return fail(`Unknown block type "${only}".`);
      const describe = (type: keyof typeof LANDING_BLOCKS) => {
        const def = LANDING_BLOCKS[type];
        return {
          type,
          label: def.label,
          group: LANDING_GROUPS[def.group],
          description: def.desc,
          settings: def.controls.map((c) => ({
            key: c.key,
            kind: c.type,
            label: c.label,
            default: c.type === "items" ? undefined : c.default,
            choices: c.choices ? Object.keys(c.choices) : undefined,
            items: c.fields?.map((f) => ({ key: f.key, kind: f.type, default: f.default, choices: f.choices ? Object.keys(f.choices) : undefined })),
            help: c.help,
          })),
        };
      };
      return out(only ? describe(only as keyof typeof LANDING_BLOCKS) : (Object.keys(LANDING_BLOCKS) as (keyof typeof LANDING_BLOCKS)[]).map(describe));
    }
    case "templates":
      return out(Object.entries(TEMPLATES).map(([key, t]) => ({ key, label: t.label, description: t.desc, blocks: t.blocks.map((b) => b[0]) })));
    case "forms": {
      const { latestForms } = await import("../src/modules/forms/lib/forms");
      return out(await latestForms(500));
    }
    case "list":
      return out((await pages.listPages(opt("q") ?? "")).map((p) => ({ id: p.id, title: p.title, slug: p.slug, status: p.status, url: urlOf(p.slug), views: p.views, unique: p.unique, clicks: p.clicks, ctr: p.views ? Math.round((p.clicks / p.views) * 1000) / 10 : null, updated: p.updatedAt })));
    case "get": {
      const page = await find(rest[0]);
      const blocks = await pages.getBlocks(page.id);
      return out({ page: { ...page, url: urlOf(page.slug) }, blocks, issues: brandIssues(blocks, page.settings) });
    }
    case "validate": {
      const spec = readSpec(rest[0]);
      const problems = unknownTypes(spec);
      const blocks = (spec.blocks ?? []).filter((b) => isLandingBlockType(b.type)).map((b, i) => ({ id: i + 1, type: b.type as keyof typeof LANDING_BLOCKS, settings: sanitizeLandingBlock(b.type as keyof typeof LANDING_BLOCKS, b.settings) }));
      const dropped = (spec.blocks ?? []).flatMap((b, i) => (isLandingBlockType(b.type) ? Object.keys(b.settings ?? {}).filter((k) => !LANDING_BLOCKS[b.type as keyof typeof LANDING_BLOCKS].controls.some((c) => c.key === k)).map((k) => `blocks[${i}] (${b.type}): unknown setting "${k}" is ignored`) : []));
      return out({ ok: problems.length === 0, problems: [...problems, ...dropped], blocks: blocks.length, issues: brandIssues(blocks, sanitizeLandingSettings(spec.settings)) });
    }
    case "create": {
      const spec = readSpec(rest[0]);
      const problems = unknownTypes(spec);
      if (problems.length) return fail(problems.join("; "));
      if (!spec.title) return fail('The spec needs a "title".');
      const id = await pages.createPage({ title: spec.title, slug: spec.slug, template: "blank", settings: spec.settings }, null);
      const res = await pages.savePage(id, { settings: spec.settings, blocks: spec.blocks, status: flag("publish") ? "published" : spec.status, label: "Created from a file" }, null);
      if (!res.ok) return fail(res.error);
      const s = await summary(id);
      return out({ ...s, ...(s.status === "published" ? await refresh([s.slug]) : {}) });
    }
    case "update": {
      const page = await find(rest[0]);
      const spec = readSpec(rest[1]);
      const problems = unknownTypes(spec);
      if (problems.length) return fail(problems.join("; "));
      const res = await pages.savePage(page.id, { title: spec.title, slug: spec.slug, status: spec.status, settings: spec.settings, blocks: spec.blocks, label: "Updated from a file" }, null);
      if (!res.ok) return fail(res.error);
      const s = await summary(page.id);
      return out({ ...s, ...(s.status === "published" || page.status === "published" ? await refresh([page.slug, s.slug]) : {}) });
    }
    case "status": {
      const page = await find(rest[0]);
      const res = await pages.savePage(page.id, { status: rest[1], label: `Status ${rest[1]}` }, null);
      if (!res.ok) return fail(res.error);
      return out({ ...(await summary(page.id)), ...(await refresh([page.slug])) });
    }
    case "duplicate": {
      const page = await find(rest[0]);
      const id = await pages.duplicatePage(page.id, null);
      return out(await summary(id));
    }
    case "delete": {
      const page = await find(rest[0]);
      if (!flag("yes")) return fail(`This deletes "${page.title}" with its statistics. Run again with --yes.`);
      await pages.deletePage(page.id);
      return out({ deleted: page.id, ...(await refresh([page.slug])) });
    }
    case "stats": {
      const page = await find(rest[0]);
      const { dashboard } = await import("../src/modules/landing/lib/stats");
      return out(await dashboard(page.id, opt("from"), opt("to"), opt("interval")));
    }
    case "revisions": {
      const page = await find(rest[0]);
      return out(await pages.listRevisions(page.id));
    }
    case "restore": {
      const page = await find(rest[0]);
      const res = await pages.restoreRevision(page.id, Number(rest[1]), null);
      if (!res.ok) return fail(res.error);
      return out({ ...(await summary(page.id)), ...(await refresh([page.slug])) });
    }
    case "refresh":
      return out(await refresh(rest));
    case "defaults": {
      // The defaults of one block type, ready to paste into a spec.
      const type = rest[0];
      if (!isLandingBlockType(type)) return fail("Give a block type.");
      return out({ type, settings: landingDefaults(type) });
    }
    default:
      console.error(readFileSync("scripts/landing.ts", "utf8").split("\n").slice(0, 26).join("\n"));
      process.exit(cmd ? 1 : 0);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
    process.exit(1);
  });
