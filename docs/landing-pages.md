# Landing pages

Landing pages are built from blocks, live at `https://borilbogoev.com/l/<name>` ("l" for landing) and are managed from the admin (`/admin/landing`) or from the terminal (`scripts/landing.ts`). Forms on their own page live at `/f/<name>` ("f" for forms). Only the two webinar forms that existed before the Forms module keep `/s/<name>`.

## How it fits together

| Part | Where |
|---|---|
| Tables | `landing_pages`, `landing_blocks`, `landing_revisions`, `landing_forms`, `landing_views`, `landing_clicks` (`src/modules/landing/schema.ts`, migration `drizzle/0002_landing_pages.sql`) |
| Blocks (types, settings, defaults) | `src/modules/landing/lib/blocks.ts`. Title, Text, Image, Divider and Spacer are the Forms definitions, reused |
| Shared builder controls | `src/modules/forms/admin/controls.tsx` (used by Forms and Landing builders) |
| Public rendering (server only) | `src/modules/landing/components/blocks.tsx`, `landing.css`; browser code only in `client.tsx` |
| Public route | `src/app/(landing)/l/[slug]/page.tsx`, static, refreshed when a page is saved |
| Admin | `/admin/landing` (list and totals), `/admin/landing/<id>/builder`, `settings`, `dashboard`, `preview` |
| Statistics intake | `POST /api/landing/t` (view and click beacons, no cookies, no IP stored) |
| Brand check | `src/modules/landing/lib/brand.ts` (emoji, "!", long dashes, hype words, button length, one red button per block, alt text) |

## Create a page from the chat (what the assistant does)

1. `npm run landing -- catalog` prints every block type with its settings (JSON). `catalog hero` prints one.
2. `npm run landing -- forms` lists the forms a Form block can embed. Use the form's `id` as `form_id`.
3. Write a spec file (see `docs/landing-examples/webinar.json`, and `kitchen-sink.json` which uses every block).
4. `npm run landing -- validate spec.json` sanitises it and runs the brand check. Fix every `warn`.
5. `npm run landing -- create spec.json` creates a draft. Add `--publish` to go live at once.
6. `npm run landing -- status <id|slug> published` publishes later. `update <id|slug> spec.json` replaces content. `get`, `list`, `stats`, `revisions`, `restore`, `duplicate`, `delete --yes` do what they say.

A spec is:

```json
{
  "title": "AI webinar for busy parents",
  "slug": "ai-webinar-busy-parents",
  "status": "draft",
  "settings": { "seo_description": "...", "chrome": "minimal", "sticky_label": "Reserve My Seat", "sticky_url": "#form" },
  "blocks": [ { "type": "hero", "settings": { "headline": "..." } } ]
}
```

Rules for a spec: only the keys in `catalog` are kept; anything missing gets its default; block order is page order. Links are a site path, `#anchor`, `https://`, `mailto:` or `tel:` (anything else is dropped). The Form block needs `form_id`; give the block an `anchor` (the Form block's default is `form`) and point buttons at `#form`.

## Copy rules (the brand check enforces most of them)

Eyebrow then sentence-case heading. Short declarative sentences. No emoji, no exclamation marks, no long dashes (comma, colon or "to"), no hype words. Figures approximate with a tilde. Buttons in Title Case, two or three words, one red primary button per view. A heading that ends with a full stop gets the brand's red full stop. Photography greyscale. No second accent colour: the builder offers none on purpose.

## Speed

Pages are prerendered HTML served from the cache; the only scripts are the visit beacon, and (when used) the carousel, video cover, countdown, sticky bar and the lazily loaded form. Images uploaded in the builder are stored as WebP at 480, 960 and 1600 px with `srcset`; give every image its alt text. Video and audio embeds load on click. Measured on a throttled phone (Slow 4G, 4x CPU) the example pages reach their largest paint in about 0.5 to 0.8 seconds.

## Statistics

`landing_views` has one row per page view (visitor and session are salted hashes of random ids kept in the visitor's browser), `landing_clicks` one row per click on a button or link with its block, label and target. The dashboard shows views, unique views, sessions, clicks, click-through rate (clicks / views), visitors who clicked, form submissions sent from the page and conversion, daily averages, timelines, and pies for devices, sources, new and returning visitors, countries, browsers, systems and clicks by button. Signed-in admins and bots are not counted.

## Going live checklist

1. Apply the migration once: `npm run db:migrate` (adds tables only).
2. Optional: set `LANDING_API_TOKEN` (or reuse `CRON_SECRET`) in Vercel and in `.env.local` so the CLI can refresh a live page at once. Without it a changed page updates within 5 minutes.
3. In Forms > Settings set the accent colour to `#C72C2C` so embedded forms match the brand red.
