# AI Agent Instructions: borilbogoev.com website

This repository is Boril Bogoev's official website. Use these instructions when working through Claude Code, Codex or another AI coding assistant.

## Project basics

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- Postgres on Neon with Drizzle ORM: inquiry form, admin users, and the Forms module
- Deployed on Vercel project `borilbogoev-website`, repo `borilbogoev/borilbogoev-website`
- Production branch: `main`. Production domain: https://borilbogoev.com (switched to this app at launch)
- Brand source of truth: the BORILBOGOEV design system (tokens in `src/app/globals.css` use its names)

## This is NOT the Next.js you know

Next 16 has breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before writing framework code, and heed deprecation notices.

## Deployment rule

`main` deploys to production. Never push to `main` or merge a PR without Boril's explicit approval.

1. `git switch -c feature/short-description`
2. Make the change, run `npm run lint` and `npm run build`
3. Commit, push the branch, open a PR (Vercel builds a preview URL for it)
4. Wait for approval before merging

## Where things live

| To change | Edit |
|---|---|
| Offer pages (Sessions, Screening, Sprint, Shift, Subscription): copy, prices, tables, FAQ | `src/content/offers/<slug>.ts` |
| Landing pages (content lives in the database) | Admin > Landing pages, or `npm run landing` (see `docs/landing-pages.md`) |
| The resume on /about | `src/content/resume.ts` |
| Home page copy | `src/content/home.ts` |
| Navigation, contact links, bio, site name | `src/content/site.ts` |
| Page layout of every offer | `src/components/offer-page.tsx` |
| Colours, type scale, buttons | `src/app/globals.css` |

Content files are typed (`src/content/types.ts`). Editing content never needs a component change.

## Adding a page or module

1. Content in `src/content/...`, route in `src/app/<slug>/page.tsx`.
2. Metadata with `pageMetadata()` from `src/lib/seo.ts` (title, description, canonical, Open Graph).
3. Structured data with `<JsonLd>` (see `src/lib/seo.ts` for builders).
4. Add it to `src/app/sitemap.ts`, to `nav` in `src/content/site.ts` if it belongs in the menu, and to `src/lib/markdown.ts` so `/llms.txt` and `/llms-full.txt` know about it.
5. Keep it static: no `cookies()`, `headers()` or per-request data in a public page.

## Modules

Modules live in `src/modules/<name>` with their own schema, logic, components and admin UI. Their tables are listed in `src/db/schema.ts`.

- `src/modules/auth`: admin users and roles (owner, admin, editor, contributor, viewer), signed session cookie, Google sign-in. `src/proxy.ts` gates only `/admin/*` and `/api/admin/*`; every page and route handler re-checks the role against the database (`requireUser`, `guarded`). Add permissions in `roles.ts`.
- `src/modules/forms`: BB Forms, migrated from the BB Forms WP plugin (tables `bbforms_*`). Admin at `/admin/forms`, public API at `/api/forms/*`, own page at `/f/<slug>`.
  - Put a form on any page: `import { FormEmbed } from "@/modules/forms"`, then `<FormEmbed id={1} />` (inline) or `<FormEmbed id={1} display="modal" label="Join" />` (button + dialog). The form loads client-side from `/api/forms/<id>/definition`, so pages stay static.
  - Block types, settings and validation are defined once in `lib/blocks.ts` and `lib/settings.ts`.
  - One-off WordPress import: `npx tsx scripts/import-wordpress.ts --dir <exports> --dry-run|--apply`. Do not re-run with `--force` once the new site has its own responses.
- `src/modules/landing`: Landing Pages (tables `landing_*`). Admin at `/admin/landing`, public pages at `/l/<slug>` ("l" for landing), tracking at `/api/landing/t`. Blocks are defined once in `lib/blocks.ts` (Title, Text, Image, Divider, Spacer are the Forms definitions), rendered by server components in `components/blocks.tsx`, styled by `components/landing.css` from the brand tokens only. Builder controls are shared with Forms (`modules/forms/admin/controls.tsx`).
  - **Create or edit a landing page from the chat with the CLI, never by clicking through the admin:** `npm run landing -- catalog | forms | validate spec.json | create spec.json [--publish] | update <id|slug> spec.json | status | stats | list | get`. Full guide, spec format and examples: `docs/landing-pages.md` and `docs/landing-examples/`. Run `validate` and fix every brand warning before `create`.
  - Forms on their own page live at `/f/<slug>`; only the two pre-existing webinar forms keep `/s/<slug>` (`modules/forms/lib/paths.ts`).
- `src/modules/presentations`: Presentations (tables `presentation_*`). Admin at `/admin/presentations`, public decks at `/p/<slug>` ("p" for presentation), tracking at `/api/presentations/t`, password unlock at `/api/presentations/unlock`. A deck is slides, a slide is elements (`lib/elements.ts`, `lib/slides.ts`, defined once like the Forms and Landing blocks), rendered by pure components in `components/deck.tsx` (server, after unlock and in the builder canvas), styled by `components/presentations.css` from the brand tokens only, driven in the browser by `components/controller.ts`. Two modes (slides, full browser window; accordion, a page whose sections fold) and three layouts (landscape, portrait, auto). Statuses draft, active, inactive, archived; categories, tags, password. The Present view (`/admin/preview/presentations/<id>`) replaces preview and shows speaker notes. Guide: `docs/presentations.md`.
  - Never call `history.replaceState` directly in deck code: Next wraps it and reloads the page. Use `replaceUrl` in the controller.
  - Notes must never reach public HTML or the unlock answer. Keep `presenter` only in the Present view.
  - Test a deck against `npm run build && npm start`, not `next dev` (hot reload reloads the deck page).
- `src/modules/school`: School, the LMS (tables `classroom_*`). Admin at `/admin/school`, public pages at `/school/<course>/<module>/<lesson>`. People are ordinary `users` with the role `student`; access is `school.*` permissions plus enrolment (`lib/access.ts`). Public pages are static: personal and paid data (state, lesson blocks, notes, comments) comes from `/api/school/*` after the page loads. Lesson blocks are defined once in `lib/blocks.ts` (content blocks reuse the Presentations elements), drawn by `components/blocks.tsx` in the player and in the builder canvas, styled by `components/school.css` from the brand tokens only. Payments are bank transfers confirmed by an admin; Bunny.net keys live in School settings (encrypted).   - **Create or edit a course from the chat with the CLI, never by clicking through the admin:** `npm run school -- catalog | settings | categories | validate spec.json | create spec.json [--publish] | update <id|slug> spec.json | status | stats | students | enrol | confirm | list | get`. Spec format and example: `docs/school.md` and `docs/school-examples/`. Run `validate` and fix every brand warning before `create`. Test against the local database, never Neon, unless Boril asks.
  - Staff preview drafts at `/admin/preview/school/<course>/<module>/<lesson>`.
- `src/modules/account`: the signed-in area for every user, at `/account` (Home, My Info, My Courses, My Responses; sign-in at `/account/login`). Dynamic pages behind `requireAccountUser()`, own shell (`(account)` route group: top bar and one persistent menu, list in `components/nav.tsx`: add an entry there for each new page). My Info edits the profile columns of `users` (username, avatar, phone, company, job title, country, time zone, bio) and the password; email stays read-only because it links a person to their form responses. A person's responses are the ones with an answer equal to their email (or `user_id` set); every query in `lib/data.ts` is scoped to that user. Avatars: `/api/account/avatar`, 256 px WebP in the Blob store under `images/avatars/`. Guide: `docs/account.md`.
  - Turn the people who answered a form into students and enrol them: `npx tsx scripts/enrol-respondents.ts --form <form-slug> --course <course-slug> [--apply]` (dry run by default, safe to repeat).
- The **Session block** (a dated live event card: date frame, title, bullets, sign-up button) is defined once as the Forms block `session` (`SESSION_CONTROLS` in `modules/forms/lib/blocks.ts`), drawn by `src/components/session-card.tsx` and reused as `session` in Landing Pages, Presentations (element) and School (lesson block). Offer pages show one above the hero from `upcoming` in their content file. The home page has none now: add a Session block to a landing page for the next event.
- Route groups: `(site)` has the header and footer, `(standalone)` (form pages), `(landing)` (landing pages, each chooses its own frame), `(deck)` (presentations, the deck fills the window), `(school)` (the School player, with its own slim bar) and `admin` do not.
- Public pages must not call `cookies()` or `headers()`. Form pages are static shells.

## Performance rules (target: LCP under 1 second)

- Pages are statically prerendered. Do not make a public page dynamic.
- Client components only for real interaction (menu, tabs, plan switcher, form). Content stays in server components.
- Images: add the original to `assets-src/`, extend `scripts/optimize-images.mjs`, run `npm run images`. Serve pre-compressed webp from `/public/brand` with explicit width and height.
- No new dependency without a reason. No third-party scripts.
- Check with Lighthouse (mobile) before merging anything that adds weight.

## Brand rules (from the design system)

- White page, ink text, one red accent. No gradients, glows, second accent colour or emoji.
- Every section: eyebrow (UPPERCASE, red) then a sentence-case heading. One red primary button per view.
- Copy: short declarative sentences, no hype words, no exclamation marks, no long dashes (use a comma, colon or "to"), figures with a tilde where approximate.
- Outline icons, 24px grid, 2px stroke (`src/components/icons.tsx`).

## Secrets

Never commit `.env*`, `.vercel/`, `Credentials/` or `Backups/`. Never print secret values.

## After changes, report

Files changed, what changed, checks run and results, whether a deployment was triggered, risks or follow-ups.
