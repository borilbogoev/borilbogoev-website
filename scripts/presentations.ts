// Manage presentations from the terminal, without opening the admin. Built so an AI assistant (or you) can create and edit a deck in seconds.
//
//   npx tsx scripts/presentations.ts <command> [arguments]        (or: npm run presentations -- <command>)
//
//   catalog [element]                 every element type with its settings (JSON). Start here when writing a deck.
//   slides [kind]                     the slide layouts (kinds) with their starting settings and elements
//   templates                         the starter decks
//   forms                             the forms a Form element can embed (id, title)
//   list [--q text] [--status s]      all decks with slides, views and reach
//   get <id|slug> [--spec]            one deck with its slides and the brand check; --spec prints it as a spec file
//   validate <file.json>              sanitise a deck spec and run the brand check; writes nothing
//   create <file.json> [--publish]    create a deck from a spec file (see docs/presentations.md)
//   update <id|slug> <file.json>      replace the title, settings and/or slides of a deck with those of the file
//   status <id|slug> <draft|active|inactive|archived>
//   duplicate <id|slug>
//   delete <id|slug> --yes
//   upload <image> [alt]              store a picture (WebP sizes in the Blob store) and print the value for an image field
//   stats <id|slug> [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--interval day|week|month]
//   revisions <id|slug>               earlier versions kept on every save
//   restore <id|slug> <revisionId>
//
// In a spec, any image field may be { "file": "/path/to/picture.png" }: the file is uploaded once (cached by content) and replaced
// by the stored picture. Output is JSON. It runs against DATABASE_URL (from .env.local). Public decks are rebuilt by the site
// within 5 minutes of an edit; a draft is never public, so it needs no refresh.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

try {
  process.loadEnvFile(".env.local");
} catch {
  // DATABASE_URL may already be in the environment
}

const args = process.argv.slice(2);
const cmd = args[0];
const rest = args.slice(1).filter((a, i, all) => !a.startsWith("--") && !(i > 0 && /^--(q|status|from|to|interval)$/.test(all[i - 1])));
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

const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };
const CACHE = process.env.PRESENTATIONS_IMAGE_CACHE || join(tmpdir(), "bb-presentations-images.json");

async function main() {
  const { ELEMENTS, ELEMENT_GROUPS, isElementType } = await import("../src/modules/presentations/lib/elements");
  const { SLIDE_KINDS, SLIDE_CONTROLS, isSlideKind, newSlide, slideWithDefaults, cleanSlideInput } = await import("../src/modules/presentations/lib/slides");
  const { brandIssues } = await import("../src/modules/presentations/lib/brand");
  const decks = await import("../src/modules/presentations/lib/presentations");
  const { sanitizeDeckSettings } = await import("../src/modules/presentations/lib/settings");
  const { DECK_TEMPLATES } = await import("../src/modules/presentations/lib/templates");
  const { elementWithDefaults } = await import("../src/modules/presentations/lib/elements");
  const { site } = await import("../src/content/site");

  const siteUrl = process.env.PRESENTATIONS_SITE_URL || site.url;
  const urlOf = (slug: string) => `${siteUrl}/p/${slug}`;

  type ElSpec = { type: string; settings?: Record<string, unknown> };
  type SlideSpec = { kind?: string; settings?: Record<string, unknown>; elements?: ElSpec[] };
  type Spec = { title?: string; slug?: string; status?: string; mode?: string; orientation?: string; category?: number | null; tags?: string[]; settings?: Record<string, unknown>; slides?: SlideSpec[] };

  const describe = (c: { key: string; type: string; label: string; default?: unknown; choices?: Record<string, string>; fields?: { key: string; type: string; default?: unknown; choices?: Record<string, string> }[]; help?: string; max?: number }) => ({
    key: c.key,
    kind: c.type,
    label: c.label,
    default: c.type === "items" ? undefined : c.default,
    choices: c.choices ? Object.keys(c.choices) : undefined,
    items: c.fields?.map((f) => ({ key: f.key, kind: f.type, default: f.default, choices: f.choices ? Object.keys(f.choices) : undefined })),
    max: c.max,
    help: c.help,
  });

  /* ------------------------------ pictures ------------------------------ */

  const cache: Record<string, unknown> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
  const upload = async (file: string) => {
    let bytes: Buffer;
    try {
      bytes = readFileSync(file);
    } catch {
      return fail(`Cannot read the picture ${file}.`);
    }
    const sha = createHash("sha256").update(bytes).digest("hex");
    if (cache[sha]) return cache[sha] as Record<string, unknown>;
    const ext = (file.split(".").pop() ?? "").toLowerCase();
    if (!MIME[ext]) return fail(`${file}: use png, jpg, webp or gif.`);
    const { storageConfigured } = await import("../src/modules/forms/lib/storage");
    if (!storageConfigured()) return fail("No BLOB_READ_WRITE_TOKEN: pictures cannot be stored.");
    const { storeImage } = await import("../src/modules/landing/lib/images");
    const stored = await storeImage(new File([new Uint8Array(bytes)], basename(file), { type: MIME[ext] }));
    const value = { id: 0, url: stored.url, width: stored.width, height: stored.height, variants: stored.variants };
    cache[sha] = value;
    writeFileSync(CACHE, JSON.stringify(cache));
    return value;
  };
  /** Replaces every { "file": "..." } in the spec with the stored picture. */
  const resolveFiles = async (node: unknown): Promise<unknown> => {
    if (Array.isArray(node)) return Promise.all(node.map(resolveFiles));
    if (node && typeof node === "object") {
      const o = node as Record<string, unknown>;
      if (typeof o.file === "string" && Object.keys(o).length === 1) return upload(o.file);
      const entries = await Promise.all(Object.entries(o).map(async ([k, v]) => [k, await resolveFiles(v)] as const));
      return Object.fromEntries(entries);
    }
    return node;
  };

  /* ------------------------------- helpers ------------------------------ */

  const readSpec = (file: string | undefined): Spec => {
    if (!file) return fail("Give the path of a JSON file.");
    try {
      return JSON.parse(readFileSync(file as string, "utf8")) as Spec;
    } catch (e) {
      return fail(`Cannot read ${file}: ${e instanceof Error ? e.message : e}`);
    }
  };
  const problemsOf = (spec: Spec) => {
    const p: string[] = [];
    (spec.slides ?? []).forEach((s, i) => {
      if (s.kind && !isSlideKind(s.kind)) p.push(`slides[${i}]: unknown kind "${s.kind}". Run: slides`);
      for (const k of Object.keys(s.settings ?? {})) if (!SLIDE_CONTROLS.some((c) => c.key === k)) p.push(`slides[${i}]: unknown slide setting "${k}" is ignored`);
      (s.elements ?? []).forEach((e, j) => {
        if (!isElementType(e.type)) return void p.push(`slides[${i}].elements[${j}]: unknown type "${e.type}". Run: catalog`);
        const def = ELEMENTS[e.type];
        for (const k of Object.keys(e.settings ?? {})) if (!def.controls.some((c) => c.key === k)) p.push(`slides[${i}].elements[${j}] (${e.type}): unknown setting "${k}" is ignored`);
      });
    });
    return p;
  };
  /** A slide spec laid over the starting settings of its kind, so a spec only says what differs. */
  const toInput = (spec: Spec) =>
    (spec.slides ?? []).map((s) => {
      const kind = isSlideKind(s.kind) ? s.kind : "blank";
      return { kind, settings: { ...newSlide(kind).settings, ...(s.settings ?? {}) }, elements: (s.elements ?? []).map((e) => ({ type: e.type, settings: e.settings ?? {} })) };
    });
  const asTree = (spec: Spec) =>
    cleanSlideInput(toInput(spec)).map((s, i) => ({ id: i + 1, kind: s.kind, settings: slideWithDefaults(s.settings), elements: s.elements.map((e, j) => ({ id: (i + 1) * 100 + j, type: e.type, settings: elementWithDefaults(e.type, e.settings) })) }));

  const find = async (ref: string | undefined) => {
    if (!ref) return fail("Give the presentation id or address (slug).");
    return (await decks.findDeck(ref)) ?? fail(`No presentation "${ref}".`);
  };
  const summary = async (id: number) => {
    const deck = (await decks.getDeck(id))!;
    const tree = await decks.getTree(id);
    return { id: deck.id, title: deck.title, slug: deck.slug, status: deck.status, url: urlOf(deck.slug), present: `${siteUrl}/admin/preview/presentations/${deck.id}`, builder: `${siteUrl}/admin/presentations/${deck.id}/builder`, slides: tree.length, issues: brandIssues(tree) };
  };

  switch (cmd) {
    case "catalog": {
      const only = rest[0];
      if (only && !isElementType(only)) return fail(`Unknown element type "${only}".`);
      const one = (type: keyof typeof ELEMENTS) => ({ type, label: ELEMENTS[type].label, group: ELEMENT_GROUPS[ELEMENTS[type].group], description: ELEMENTS[type].desc, settings: ELEMENTS[type].controls.map(describe) });
      return out(only ? one(only as keyof typeof ELEMENTS) : (Object.keys(ELEMENTS) as (keyof typeof ELEMENTS)[]).map(one));
    }
    case "slides": {
      const only = rest[0];
      if (only && !isSlideKind(only)) return fail(`Unknown slide kind "${only}".`);
      const one = (kind: keyof typeof SLIDE_KINDS) => ({ kind, label: SLIDE_KINDS[kind].label, description: SLIDE_KINDS[kind].desc, settings: SLIDE_KINDS[kind].settings, elements: SLIDE_KINDS[kind].elements.map(([type, s]) => ({ type, settings: s })) });
      return out(only ? { ...one(only as keyof typeof SLIDE_KINDS), slide_settings: SLIDE_CONTROLS.map(describe) } : (Object.keys(SLIDE_KINDS) as (keyof typeof SLIDE_KINDS)[]).map(one));
    }
    case "templates":
      return out(Object.entries(DECK_TEMPLATES).map(([key, t]) => ({ key, label: t.label, description: t.desc, slides: t.slides.map((s) => s[0]) })));
    case "forms": {
      const { latestForms } = await import("../src/modules/forms/lib/forms");
      return out(await latestForms(500));
    }
    case "list":
      return out((await decks.listDecks({ q: opt("q"), status: opt("status") })).map((d) => ({ id: d.id, title: d.title, slug: d.slug, status: d.status, mode: d.mode, url: urlOf(d.slug), slides: d.slides, views: d.views, unique: d.unique, avgReach: d.avgReach, updated: d.updatedAt })));
    case "get": {
      const deck = await find(rest[0]);
      const tree = await decks.getTree(deck.id);
      if (flag("spec")) return out({ title: deck.title, slug: deck.slug, status: deck.status, mode: deck.mode, orientation: deck.orientation, tags: await decks.tagsOf(deck.id), settings: deck.settings, slides: tree.map((s) => ({ kind: s.kind, settings: s.settings, elements: s.elements.map((e) => ({ type: e.type, settings: e.settings })) })) });
      return out({ deck: { ...decks.publicDeck(deck), url: urlOf(deck.slug) }, slides: tree, issues: brandIssues(tree) });
    }
    case "validate": {
      const spec = readSpec(rest[0]);
      const problems = problemsOf(spec);
      const files = JSON.stringify(spec.slides).match(/"file":/g)?.length ?? 0;
      const tree = asTree(spec);
      return out({ ok: !problems.some((p) => !p.includes("is ignored")), problems, slides: tree.length, pictures_to_upload: files, deck_settings: sanitizeDeckSettings(spec.settings), issues: brandIssues(tree) });
    }
    case "create": {
      const spec = readSpec(rest[0]);
      const problems = problemsOf(spec).filter((p) => !p.includes("is ignored"));
      if (problems.length) return fail(problems.join("; "));
      if (!spec.title) return fail('The spec needs a "title".');
      const resolved = (await resolveFiles(spec)) as Spec;
      const id = await decks.createDeck({ title: resolved.title as string, slug: resolved.slug, template: "blank", mode: resolved.mode, orientation: resolved.orientation, categoryId: resolved.category ?? null }, null);
      const res = await decks.saveDeck(id, { settings: resolved.settings, tags: resolved.tags, slides: toInput(resolved), status: flag("publish") ? "active" : resolved.status, label: "Created from a file" }, null);
      if (!res.ok) return fail(res.error);
      return out(await summary(id));
    }
    case "update": {
      const deck = await find(rest[0]);
      const spec = readSpec(rest[1]);
      const problems = problemsOf(spec).filter((p) => !p.includes("is ignored"));
      if (problems.length) return fail(problems.join("; "));
      const resolved = (await resolveFiles(spec)) as Spec;
      const res = await decks.saveDeck(deck.id, { title: resolved.title, slug: resolved.slug, status: resolved.status, mode: resolved.mode, orientation: resolved.orientation, categoryId: resolved.category, tags: resolved.tags, settings: resolved.settings, slides: resolved.slides ? toInput(resolved) : undefined, label: "Updated from a file" }, null);
      if (!res.ok) return fail(res.error);
      return out(await summary(deck.id));
    }
    case "status": {
      const deck = await find(rest[0]);
      const res = await decks.saveDeck(deck.id, { status: rest[1], label: `Status ${rest[1]}` }, null);
      if (!res.ok) return fail(res.error);
      return out(await summary(deck.id));
    }
    case "duplicate": {
      const deck = await find(rest[0]);
      return out(await summary(await decks.duplicateDeck(deck.id, null)));
    }
    case "delete": {
      const deck = await find(rest[0]);
      if (!flag("yes")) return fail(`This deletes "${deck.title}" with its statistics. Run again with --yes.`);
      await decks.deleteDeck(deck.id);
      return out({ deleted: deck.id });
    }
    case "upload": {
      if (!rest[0]) return fail("Give the path of a picture.");
      return out({ alt: rest[1] ?? "", image: await upload(rest[0]) });
    }
    case "stats": {
      const deck = await find(rest[0]);
      const { dashboard } = await import("../src/modules/presentations/lib/stats");
      return out(await dashboard(deck.id, opt("from"), opt("to"), opt("interval")));
    }
    case "revisions": {
      const deck = await find(rest[0]);
      return out(await decks.listRevisions(deck.id));
    }
    case "restore": {
      const deck = await find(rest[0]);
      const res = await decks.restoreRevision(deck.id, Number(rest[1]), null);
      if (!res.ok) return fail(res.error);
      return out(await summary(deck.id));
    }
    default:
      console.error(readFileSync("scripts/presentations.ts", "utf8").split("\n").slice(0, 27).join("\n"));
      process.exit(cmd ? 1 : 0);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
    process.exit(1);
  });
