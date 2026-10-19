# borilbogoev.com

The official website of Boril Bogoev, Ph.D. Next.js (App Router) + TypeScript + Tailwind CSS, deployed on Vercel. Every public page is prerendered to static HTML, so it is fast and fully readable by search engines and AI assistants without running JavaScript.

## Run locally

```bash
npm install
cp .env.example .env.local   # optional: the site needs no env vars to run
npm run dev                  # http://localhost:3000
```

## Structure

```
src/
  app/                     routes: / /about /contact /sessions /screening /sprint /shift /subscription
    api/inquiry/           form endpoint
    sitemap.ts robots.ts llms.txt/ llms-full.txt/ opengraph-image.tsx
  components/              UI: header, footer, offer page template, plan table, tabs, form
  content/                 ALL the words and prices (typed). Edit these to change the site.
    offers/<slug>.ts       one file per offer page
    resume.ts home.ts site.ts types.ts
  lib/seo.ts               metadata and JSON-LD builders
  lib/markdown.ts          generates llms.txt and llms-full.txt from the content files
  db/                      Drizzle schema and client (inquiries)
scripts/optimize-images.mjs   builds /public/brand images from /assets-src
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run images` | Rebuild optimized images from `assets-src/` |
| `npm run db:generate` / `db:migrate` | Create and apply SQL migrations (needs `DATABASE_URL`) |

## Environment variables

See `.env.example`. `SITE_INDEXABLE=true` is the launch switch; until then robots.txt disallows everything and pages carry `noindex`.

## Going live checklist

1. In Vercel: connect the GitHub repo (production branch `main`), add Neon from Storage (sets `DATABASE_URL`), run `npm run db:migrate` once.
2. Add `RESEND_API_KEY`, `INQUIRY_TO_EMAIL`, `INQUIRY_FROM_EMAIL` (and verify the sending domain in Resend).
3. Check the preview, then add the domain `borilbogoev.com` to the project and update DNS.
4. Set `SITE_INDEXABLE=true` in Production and redeploy. Submit `/sitemap.xml` in Google Search Console and Bing Webmaster Tools.
5. Redirect old WordPress URLs if any are indexed (`redirects()` in `next.config.ts`).
