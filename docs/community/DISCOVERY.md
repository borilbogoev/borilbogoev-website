# Community: discovery (Phase 0)

Findings from reading the repo before building. Every later choice follows these.

## 1. Auth
- One `users` table (`src/modules/auth/schema.ts`). `id` is a **uuid**. Columns used by Community: `name`, `username` (lowercase, unique, nullable), `avatar_url`, `role`, `status` (`active` | `disabled`).
- Session: signed cookie `bb_session`, but the user is always re-read from the database by `getCurrentUser()` (`modules/auth/current.ts`, cached per request). `requireApiUser()` and `guarded()` (`modules/auth/guard.ts`) are the route handler helpers; `guarded` also blocks cross-site writes (Origin check).
- Roles: `owner, admin, editor, contributor, viewer, student` (`modules/auth/roles.ts`). **SuperAdmin = role `owner`** ("Superadmin / Owner"). Community adds the permission `community.manage`, granted to `owner` only.
- Students and every other role are ordinary signed-in users. The signed-out redirect for the signed-in area goes to `/account/login`.

## 2. Database layer
- Drizzle ORM 0.45 over the Neon **HTTP** driver (`src/db/index.ts`). `db()` from `src/db/use.ts` returns it (tests can inject PGlite with `setDbForTests`).
- **No interactive transactions on neon-http.** Multi-row changes that must be atomic are written as one SQL statement with CTEs (`WITH ... INSERT ... UPDATE`). Same approach works on PGlite and on the local Neon stand-in.
- Migrations: `drizzle-kit generate` into `drizzle/NNNN_*.sql`, applied with `drizzle-kit migrate`. Latest is `0005`. `.env.local` points at Neon, so **never run `db:migrate` from this checkout**; local work uses `scripts/local-db` (PGlite behind the Neon HTTP protocol, applies `drizzle/*.sql` on start).
- Conventions: `snake_case` columns, `serial` ids for module tables (uuid for `users`), `timestamp with time zone default now()`, module prefix on tables (`classroom_*`, `bbforms_*`, `landing_*`). Module schemas are re-exported from `src/db/schema.ts`.

## 3. File storage
- Vercel Blob, private store, helpers in `modules/forms/lib/storage.ts` (`putFile`, `deleteFiles`, `storageConfigured`). Uploads go **through the server** (`sharp` re-encodes, then `putFile`). Paths under `images/` are served publicly by `/api/forms/media/<path>` (`MEDIA_ROUTE`). Avatars use this (`/api/account/avatar`, 8 MB cap). Without a token (local) the code falls back to a data URL.
- `sharp` re-encoding drops EXIF, so GPS data is stripped for free.

## 4. Admin backend
- Modules are one entry in `src/modules/registry.ts` (`adminModules`) with a permission. Pages live in `src/app/admin/(panel)/<module>/`, behind `PanelLayout` (needs a signed-in staff role; students are redirected out). Pages call `requireUser("<perm>", "<path>")`. API routes live in `src/app/api/admin/<module>/` and use `guarded(request, permission, handler)`.
- UI: `PageHeader`, `bbfa-*` classes (`bbfa-table`, `bbfa-band` stat strip, `bbfa-btn`, `bbfa-pill`, `bbfa-section`), CSS in each module's `admin/*.css`.
- `PanelLayout` rejects roles that cannot use the admin. Community moderators can be any role, so their reduced view lives under `/community/moderate`, not in `/admin`.

## 5. Profile page
- There is no public profile. The signed-in profile is **`/account`** (`(account)` route group, one persistent menu in `modules/account/components/nav.tsx`, My Info edits the profile). The menu is a list of pages, not tabs.
- Community therefore adds: a **Community** entry in the account menu (`/account/community?section=`), and a viewer-facing profile for other people at `/community/u/[userId]`.

## 6. UI system
- Tailwind 4 tokens in `src/app/globals.css` (`--brand` red `#c72c2c`, `--ink`, `--line`, `--surface-alt`, `--radius`), plus per-module plain CSS files that use only those tokens (`account.css`, `school.css`). Buttons `bb-btn bb-btn-primary|outline|dark`, `tag`, `tag-red`, `eyebrow`. Icons are 24px outline, 2px stroke (`src/components/icons.tsx`). No component library; none added.
- Brand: white page, ink text, one red accent, no gradients or emoji, eyebrow (uppercase red) then sentence-case heading, one red primary button per view.

## 7. i18n
- No translation layer. All Community strings live in `src/modules/community/strings.ts`.

## 8. Existing patterns
- Route handlers with `guarded()` (JSON, `Cache-Control: no-store`); server actions only for sign-out and account forms. Validation: `zod` 4 is a dependency, used sparingly; forms use hand-written cleaners. No rate limiter, so Community uses DB-count limits. **No test runner**: Community adds `node:test` through `tsx` (`npm run test:community`).
- Public pages must be static. Community pages are signed-in and personal, so they are dynamic by nature and live in their own route group `(community)`.
