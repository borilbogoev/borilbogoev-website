# Changelog

All notable changes to this project. Versions follow [Semantic Versioning](https://semver.org).

## [0.2.0] - Unreleased

### Added
- Forms module (BB Forms, migrated from BB Forms WP): block builder, conversational and classic modes, conditional logic, responses inbox with CSV export, per-form dashboard, notifications, autoresponder, signed webhooks, file uploads (Vercel Blob), GDPR tools and retention.
- Embed anywhere: `<FormEmbed id display="inline|modal">`, plus a standalone page per form at `/s/<slug>`. The two shared webinar links keep working.
- Admin area at `/admin` with users and roles (owner, admin, editor, contributor, viewer), password and Google sign-in.
- `scripts/import-wordpress.ts`: verified import of the WordPress exports (2 forms, 55 responses, 649 answers).
- Tables `users` and `bbforms_*` (migration `0001_forms_module`).

### Changed
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
