# Changelog

All notable changes to this project. Versions follow [Semantic Versioning](https://semver.org).

## [0.2.0] - Unreleased

### Changed
- Classroom is now the School: `/school`, `/admin/school`, `npm run school`. Old `/classroom` URLs redirect. Database tables keep their `classroom_*` names. The School is listed in the menu after Sessions (`SCHOOL_LISTED=false` makes it share-only again).
- Header: the portrait replaces the About text link. Session 1 renamed. Sessions pricing tiers replaced by a free Deliverables list.

### Added
- Forms module (BB Forms, migrated from BB Forms WP): block builder, conversational and classic modes, conditional logic, responses inbox with CSV export, per-form dashboard, notifications, autoresponder, signed webhooks, file uploads (Vercel Blob), GDPR tools and retention.
- Embed anywhere: `<FormEmbed id display="inline|modal">`, plus a standalone page per form at `/s/<slug>`. The two shared webinar links keep working.
- Admin area at `/admin` with users and roles (owner, admin, editor, contributor, viewer), password and Google sign-in.
- `scripts/import-wordpress.ts`: verified import of the WordPress exports (2 forms, 55 responses, 649 answers).
- Tables `users` and `bbforms_*` (migration `0001_forms_module`).

- Landing Pages module: build pages at `/l/<name>` with the same three-pane builder as Forms (31 blocks: heroes, calls to action, buttons, form, quote, numbers, grid, gallery, carousel, video, audio, pricing, testimonials, guarantee, P.S., FAQ and more), page settings, preview at desktop, tablet and phone widths, version history, brand check, and a dashboard (views, unique views, sessions, clicks, click-through rate, averages, timelines, pies, clicks per button). Tables `landing_*` (migration `0002_landing_pages`).
- `scripts/landing.ts` (`npm run landing`): create, validate, publish and measure landing pages from the terminal. Guide in `docs/landing-pages.md`.
- Forms on their own page now live at `/f/<slug>`. The two webinar forms keep `/s/<slug>`; any other `/s/<slug>` redirects to `/f/<slug>`.
- A form's Share tab lists the landing pages that embed it.

- Classroom module: a learning management system at `/classroom` and `/admin/classroom`. Categories, courses, modules and lessons built from blocks (text, video with Bunny.net signed links, YouTube and Vimeo, audio with transcripts, callouts, accordion, resources, checklist, question box, flashcards and the shared content blocks), a three-column player (outline, lesson, discussion and private notes), progress, free previews, enrolment (free, invitation, or paid by bank transfer confirmed in the admin), student sign-in by emailed link or Google. Students are users with the new role Student; new `classroom.*` permissions. Tables `classroom_*` (migration `0004_classroom_module`). Guide in `docs/classroom.md`.
- Classroom: Poll block (anonymous votes, results shown after voting), staff preview of draft courses and lessons in the real player (`/admin/preview/classroom/...`), an analytics dashboard (all courses and per course: students, active learners, completion, drop-off per lesson, payments, poll results), and `npm run classroom` to create, validate, update and measure whole courses from a spec file. Guide in `docs/classroom.md`, example in `docs/classroom-examples/`.

### Changed
- Shared builder controls moved to `modules/forms/admin/controls.tsx` (Forms builder behaves as before); block settings gained `url`, `items` and `form` controls.
- Admin colours now use the design system values (red #C72C2C, ink #1A1A1A).
- Sitemap lists published landing pages that allow search engines.
- `sharp` moved to dependencies (landing images are resized at upload).
- Header and footer moved from the root layout to the `(site)` route group so form pages and the admin can be chrome-free. URLs are unchanged.

## [0.1.0] - 2026-10-19

First version.

### Added
- Next.js 16 app, fully static pages, brand tokens from the BORILBOGOEV design system, Inter and JetBrains Mono.
- Navigation: B* mark as home link, The Streamliner (logo link), Sessions, Screening, Sprint, Shift, Subscription, About. Phone drawer and desktop bar.
- Five offer landing pages built from the Money Model, each from one typed content file: hero, problem, audience, what you get, how it works, pricing (comparison table with a one-plan-at-a-time switcher on phones), founder, boundaries, FAQ, inquiry form, sticky inquiry bar on phones.
- About page: the resume from BB Resume WP v2.0.0 with a sticky submenu (Profile, Experience, Skills, Education, Publications, Contact), accessible tabs, tools carousel.
- Home page and Contact page.
- Inquiry form: `/api/inquiry` with validation, honeypot and timing check, storage in Neon and optional email through Resend.
- SEO and AI SEO: per-page metadata and canonical URLs, Open Graph image, JSON-LD (Person, WebSite, ProfilePage, Service with offers, FAQPage, BreadcrumbList), sitemap, robots with explicit AI crawler rules, `/llms.txt` and `/llms-full.txt`.
- `SITE_INDEXABLE` launch switch: the site is noindex until it is set to `true`.
