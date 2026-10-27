# Presentations

Presentations are decks built from slides, live at `https://borilbogoev.com/p/<name>` ("p" for presentation) and managed from the admin (`/admin/presentations`). A deck fills the browser window (not the screen: no Fullscreen API, so other tabs and demos stay one click away), or it opens as an accordion: a normal page whose sections fold open and shut.

## How it fits together

| Part | Where |
|---|---|
| Tables | `presentations`, `presentation_slides`, `presentation_elements`, `presentation_categories`, `presentation_tags`, `presentation_tag_links`, `presentation_revisions`, `presentation_forms`, `presentation_views` (`src/modules/presentations/schema.ts`, migration `drizzle/0003_presentations_module.sql`, additive only) |
| Elements (the blocks inside a slide) | `src/modules/presentations/lib/elements.ts`. Divider and Spacer are the Forms definitions, reused |
| Slide layouts (starting points) and slide settings | `src/modules/presentations/lib/slides.ts` |
| Deck settings, statuses, modes | `src/modules/presentations/lib/settings.ts` |
| Starter decks | `src/modules/presentations/lib/templates.ts` |
| Storage, categories, tags, revisions | `src/modules/presentations/lib/presentations.ts` |
| Password | `src/modules/presentations/lib/access.ts` |
| Brand check, statistics | `lib/brand.ts`, `lib/track.ts`, `lib/stats.ts` |
| Rendering (pure markup, used on the server, after unlock and in the builder canvas) | `components/deck.tsx`, styled by `components/presentations.css` from the brand tokens only |
| Browser behaviour (slides, keys, swipe, builds, accordion, video, embeds, statistics) | `components/controller.ts`, attached by `components/deck-client.tsx` |
| Public route | `src/app/(deck)/p/[slug]/page.tsx`, static, refreshed when a deck is saved |
| Admin | `/admin/presentations` (list, filters, categories), `/new`, `/dashboard` (the library), `/<id>/builder`, `settings`, `dashboard` |
| Present view | `/admin/preview/presentations/<id>`: the deck full window, drafts included, with speaker notes (N) and statistics off |
| API | `/api/admin/presentations/*` (admin), `/api/presentations/t` (statistics), `/api/presentations/unlock` (password) |

## Model

A deck has slides, a slide has elements. A **slide layout** (Cover, Section, Agenda, Title and bullets, Big statement, Two columns, Before and after, Full picture, Picture and text, Picture grid, Video, Interactive embed, Live demo, Numbers, Quote, Three ideas, Process, Table, Code or prompt, Presenter, Logos, Form, Closing, Questions, Blank) is only a starting point, like a slide master: it adds a slide with the right settings and pre-filled elements, and everything can then be changed. Elements: Heading, Text, Bullet list, Image, Image grid, Video, Interactive embed, Quote, Numbers, Steps, Cards, Before and after, Panels, Pricing, Bar chart, Tags, Callout, Code, Table, Logos, Person, Button, Form, Divider, Spacer.

**The brand slide kit** (rebuilt from the Claude brand slides): the deck setting *Type size: Large* switches to the big presentation type (72 px headings on a 1920 px slide, 1em = 28.8px at that width). It adds heading extras (big red number, pill eyebrow, badge, display sizes), slide backgrounds Pale red and Red, the Faint asterisk and Very large asterisk motifs, the Tight margin option, picture styles with shadow and border (Image grid: *Large pictures* with a bold caption, *Compact tiles* for four to a slide), the Statement quote, Cards in a compact or large outlined style, Steps with large figures, and the elements Panels (pain, strategy, result; bad news, good news; cons, pros), Pricing (plans with a struck-through old price, a highlighted plan and a slots chip), Bar chart, Tags and Callout. Decks that keep *Standard* are drawn as before.

- **Modes**: `slides` (one slide at a time, full window) and `accordion` (a long page, sections fold). Viewers can switch with the M key or the button when "Viewers can switch" is on, and a link can force a mode with `?mode=accordion`.
- **Layouts**: `landscape` fills the window, `portrait` is a tall 9:16 column for phones held upright (centred on a grey ground on a wide screen), `auto` follows the window. Slides are sized in `em` from the size of their frame, so a slide looks the same on a phone and a projector.
- **Statuses**: `draft` (not public, Present view only), `active` (live), `inactive` (the link shows "not available"), `archived` (404, kept for the numbers).
- **Builds**: any element can "appear on the next click"; bullet lists, steps and cards can show one item per click.
- **Speaker notes** are written per slide and only exist in the Present view. They are never in the public HTML or in the unlock answer.
- **Password**: stored as a scrypt hash. A protected deck is a static lock screen; the slides are fetched from `/api/presentations/unlock` only after the right password (or the token kept for the tab), so they are not in any HTML that can be fetched without it. Changing the password signs everyone out. Eight wrong tries in ten minutes per visitor are refused (in memory of one server instance: a brake, not a hard limit). Password-protected decks are never indexed or in the sitemap.
- **Interactive embeds** may load this site and a short list of hosts (`EMBED_HOSTS` in `elements.ts`); they open when the slide is reached, in a sandboxed iframe, with an "Open in a new tab" link as the way out for sites that refuse framing. Videos (YouTube, Vimeo, Loom, MP4) load on click.

## Keys in the deck

Right arrow, Space, Page Down: next. Left arrow, Page Up, Shift+Space: previous. Home, End. O: contents. M: slides or accordion. N: speaker notes (Present view). ?: shortcuts. Esc: close a panel. Swipe on touch screens.

## Statistics

`presentation_views` has one row per opening (visitor and session are salted hashes of random ids kept in the viewer's browser; no cookies, no IP stored), with the furthest slide reached and the seconds the deck was in view, updated by a second beacon. The deck dashboard shows views, unique viewers, sessions, average reach, how many reached the last slide, average time, a slide-by-slide drop-off chart and the audience breakdown. The library dashboard (`/admin/presentations/dashboard`) shows the number of presentations, slides, slides per presentation (average, median, longest), elements per slide, status, mode, layout and category mix, the slide layouts and elements in use, and the most viewed decks. Signed-in admins and the Present view are not counted.

## Copy and brand

Same rules as the rest of the site, checked live in the builder ("Brand check"): eyebrow then sentence-case heading, short declarative sentences, no emoji, no exclamation marks, no long dashes, no hype words, buttons of two or three words, one red primary button per slide, alt text on pictures. White slides with dark bands for emphasis (or the dark theme reversed), one red accent, outline icons, the red full stop on display headings, the asterisk motif only on Cover and Closing, photography in greyscale on full-picture slides.

## Create or edit a deck from the terminal

`npm run presentations -- <command>` manages decks without opening the admin (`scripts/presentations.ts`, modelled on `npm run landing`). Output is JSON; it runs against `DATABASE_URL`.

| Command | What it does |
|---|---|
| `catalog [element]` / `slides [kind]` / `templates` / `forms` | What a spec may contain: every element with its settings, the slide kinds with their starting settings, the starter decks, the forms |
| `list`, `get <id\|slug> [--spec]` | Decks with views and reach; one deck with its brand check, or as a spec file |
| `validate spec.json` | Sanitises the spec and runs the brand check. Writes nothing |
| `create spec.json [--publish]` / `update <id\|slug> spec.json` | Creates a draft (or an active deck), or replaces the slides and settings of an existing one |
| `status`, `duplicate`, `delete --yes`, `revisions`, `restore`, `stats`, `upload` | The rest of the admin actions |

A spec is `{ title, slug, status, mode, orientation, tags, settings, slides: [{ kind, settings, elements: [{ type, settings }] }] }`. A slide only lists what differs from its kind's starting settings. Any image field may be `{ "file": "/path/to/picture.png" }`: the file is stored once (WebP sizes in the Blob store, cached by content in the temp folder) and replaced by the stored picture. Speaker notes go in the slide settings (`notes`).

Limits to design around: Cards allow 4 columns and 8 items, Steps 5 in a row, Numbers 6. A slide is 1080 px tall at its reference size, so about six cards with one line of text, or nine table rows, is the most one slide holds: split a longer list over several slides instead of squeezing it. Check a deck against `npm run build && npm start`, never `next dev`. Next caches the data of a static page for 5 minutes, so after editing a deck delete `.next/cache/fetch-cache` before a local rebuild.

## Going live checklist

1. Apply the migration once: `npm run db:migrate` (adds tables only).
2. Nothing else is required. The first deck is created from `/admin/presentations/new`.

## Testing without the production database

Use `scripts/local-db/` (see its README), then `npm run build && npm start`. Test the deck against a production build, not `next dev`: the dev server's hot reload reloads a deck page whenever a source file changes.
