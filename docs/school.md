# School

The School is the learning management module: categories, courses, modules and lessons at `https://borilbogoev.com/school`, built in `/admin/school`. Students sign in, enrol (free, by invitation or by bank transfer), learn in a three-column player, keep private notes and ask questions under each lesson.

## How it fits together

| Part | Where |
|---|---|
| Tables | `classroom_categories`, `classroom_courses`, `classroom_modules`, `classroom_lessons`, `classroom_blocks`, `classroom_lesson_revisions`, `classroom_enrolments`, `classroom_progress`, `classroom_notes`, `classroom_comments`, `classroom_block_state`, `classroom_settings` (`src/modules/school/schema.ts`, migration `drizzle/0004_classroom_module.sql`, additive only) |
| People | Ordinary rows of `users` with the role **Student** (`modules/auth/roles.ts`). There is no second user system |
| Permissions | `school.view`, `write`, `delete`, `moderate`, `enrol`, `settings`, `learn` (see below) |
| Lesson blocks | `lib/blocks.ts`. Content blocks are the Presentations elements, reused |
| Course data and tree | `lib/courses.ts` |
| Access and enrolment | `lib/access.ts` |
| Progress, notes, comments, block state | `lib/learn.ts` |
| Student sign-in | `lib/signin.ts` (emailed link), Google through the existing OAuth routes |
| Settings (bank details, Bunny.net, sign-up) | `lib/settings.ts`, `lib/settings-store.ts`; secrets encrypted by `lib/secrets.ts` |
| Video and audio | `lib/media.ts` |
| Brand check | `lib/brand.ts` |
| Public pages | `src/app/(site)/school/*` (hub, category, course, sign-in, my courses, with the site header) and `src/app/(school)/school/[course]/[module]/*` (module and lesson, in the player frame) |
| Player | `components/player.tsx` (frame, outline, lesson), `components/discussion.tsx` (discussion, notes), `components/blocks.tsx` (every block) |
| Admin | `/admin/school` (Courses, Dashboard, Categories, Students, Discussion, Settings), `/<id>/builder`, `settings`, `dashboard` (Analytics) |
| Staff preview | `/admin/preview/school/<course>/<module>/<lesson>`: the real player, any status, drafts listed |
| Statistics | `lib/stats.ts`, `admin/dashboard.tsx` |
| CLI | `scripts/school.ts` (`npm run school`) |
| API | `/api/school/*` (learners), `/api/admin/school/*` (staff), `/api/school/revalidate` (the CLI) |

## Listed or share-only

The School is **listed** by default: a link in the main menu (after Sessions) and the footer, in the sitemap, open to search engines. To make it share-only (no links, `noindex`), set `SCHOOL_LISTED=false` in Vercel (Production) and redeploy (`lib/listing.ts`). The old `/classroom` URLs redirect to `/school`.

## Access control

Part of the app's roles and permissions, not a separate system.

| Role | In the School |
|---|---|
| Owner, Admin | Everything. Admin also manages students and payments, settings and keys |
| Editor | Builds courses (`write`), answers and moderates questions (`moderate`) |
| Contributor, Viewer | Read-only (`view`) |
| Student | `school.learn` only: learn in enrolled courses. Sent to `/school/my` if they open `/admin` |

On top of the role, **enrolment** decides which courses a student may open (`classroom_enrolments`): `active`, `pending` (a bank transfer not confirmed yet) or `revoked`. A lesson marked **Free preview** opens for anyone. Staff see everything.

Admins add students under School, Students: **Registered users** searches everyone with an account (by name or email), you tick the people and enrol them in a course in one step (with an optional note and a Mark as paid switch); **Add a student** invites a new email address. Accounts can also be created in Users with the role Student. A student's progress, notes and answers survive when access is removed.

## Public pages stay static

The catalog, course, module and lesson pages are prerendered and cached like the rest of the site (no `cookies()`), and refresh the moment something is saved (`lib/revalidate.ts`). Everything personal is fetched in the browser after the page loads:

- `GET /api/school/courses/<id>/state`: who you are, your enrolment, what you finished.
- `GET /api/school/lessons/<id>`: the lesson **blocks**, only if the access check passes. Paid content is never in the HTML.

Remember this when you add a feature: personal or paid data goes through these APIs, not into the static page.

## Courses, modules, lessons

- **Course**: title, address `/school/<slug>`, category, short description, image, language, access (free, paid, invitation), price, level, duration, outcomes, instructor, search settings. Statuses draft, active, inactive, archived. Only active courses are public.
- **Module**: title, short description, image, address. Its page lists its lessons, with the course outline in the left sidebar.
- **Lesson**: title, summary, featured image, minutes, free preview, status (draft or published), blocks. New lessons start as drafts: publish each one. Students see published lessons only.
- Structure (modules, lessons, order) saves at once in the builder. Lesson content saves with Save, keeps 30 versions, and block ids stay stable so students' answers are not lost when you edit.

## Blocks

Heading, Text, Bullet list, Quote, Callout, Image, Image grid, Video, Audio, Interactive embed, Steps, Cards, Before and after, Accordion, Code or prompt (with a copy button), Table, Resources, Button, Divider, Spacer, and the learning blocks that save the student's state: **Checklist**, **Question box** (optionally sent to the instructor, who reads it under Discussion), **Poll** and **Flashcards**. Define a new block once in `lib/blocks.ts` (controls), draw it in `components/blocks.tsx`. If it keeps student state, add its shape to `saveBlockState` in `lib/learn.ts`.

## Poll

A question with two to eight options, single or multiple choice. A student votes, then sees how the class answered (share and count per option), and can change their vote. Votes are anonymous: only counts leave the database, and results are sent only to a student who has voted. The author can switch results off. Per-poll results are in the course Analytics.

## Draft preview

New lessons and courses are drafts, and a draft is a 404 on the public site. Staff see them in the real player at `/admin/preview/school/<course>/<module>/<lesson>` (the **Preview** links in the builder and in the course tabs): the outline lists draft lessons with a Draft chip, a Preview badge sits in the top bar, the way back is the builder, and nothing you do there is recorded as progress. It shows the **saved** version, so save before you preview.

## Analytics

`/admin/school/dashboard` (all courses) and `/admin/school/<id>/dashboard` (one course), for 7, 30 or 90 days. Read from what students already leave behind, so there is no tracking script.

- Library: students, active learners, lessons completed, new enrolments, awaiting payment, unanswered questions, confirmed payments by currency, an activity timeline and a table per course (students, active, average progress, finished).
- Course: the same for one course, how many students opened and completed every lesson (where they stop), the biggest drop-off, question box answers and the results of every poll.
- Only students count as learners; staff views never do. Days are UTC. "Active" means the student opened a lesson in the period. Money is the price at enrolment of enrolments an admin marked as paid.

## The CLI: build a course from the chat

`npm run school -- <command>`. Output is JSON. It runs against `DATABASE_URL` (from `.env.local`; override it in the shell to test against the local database, see `scripts/local-db/README.md`). After a change to a live course it asks the site to refresh the pages at once (`POST /api/school/revalidate`) when `CLASSROOM_API_TOKEN` (or `LANDING_API_TOKEN` or `CRON_SECRET`) is set; otherwise pages refresh within 5 minutes.

| Command | What it does |
|---|---|
| `catalog [type]` | Every block type with its settings, the course fields and the choices. Start here |
| `settings` | What is configured (bank details, Bunny.net, sign-up). Never prints a secret |
| `validate spec.json` | Sanitises a spec, lists problems and brand warnings, writes nothing |
| `create spec.json [--publish]` | Creates a course with its modules, lessons and blocks. A draft unless `--publish` |
| `update <id\|slug> spec.json [--prune --yes]` | Updates from a spec. Matches modules and lessons by address, creates the new ones, keeps the rest. A block keeps its students' answers when the type at the same position is unchanged. `--prune --yes` deletes what is not in the spec |
| `get <id\|slug> [--blocks]`, `list`, `categories` | Read |
| `status <id\|slug> draft\|active\|inactive\|archived` | Publish or hide a course |
| `stats [id\|slug] [--days 30]` | The dashboard numbers |
| `students [course]`, `enrol <course> <email> [--name] [--paid] [--note]`, `confirm <enrolmentId>` | Students and bank transfers |
| `delete <id\|slug> --yes`, `refresh` | Delete, and refresh the live pages |

A spec (see `docs/school-examples/ai-operating-system.json`, which uses most blocks):

```json
{
  "title": "Your first AI operating system", "slug": "first-ai-operating-system", "category": "AI for business",
  "summary": "...", "access": "paid", "price": 800, "currency": "AED",
  "settings": { "level": "beginner", "duration": "3 hours", "outcomes": ["..."] },
  "modules": [ { "title": "Start with one process", "summary": "...", "lessons": [
    { "title": "Welcome", "summary": "...", "minutes": 4, "preview": true, "blocks": [
      { "type": "heading", "text": "One process, one system." },
      { "type": "video", "source": "<Bunny video ID or YouTube/Vimeo link>" },
      { "type": "poll", "question": "...", "options": ["A", "B"] } ] } ] } ]
}
```

Rules: block settings go next to `type` (or inside `settings`); only the keys in `catalog` are kept; anything missing gets its default; order is course order. Lessons are published unless `"draft": true`; the course is a draft unless `--publish` or `"status"`. The category is created if it does not exist. Images are `{ "url": "..." }` (a site path or an https address; uploads need the admin). Run `validate` and fix every brand warning before `create`: no emoji, no "!", no long dashes, no hype words, alt text on pictures, one red button.

## Video: Bunny.net

Settings, Video: the **Library ID** and the **embed token key**. In the Bunny dashboard: Stream, your library, Security, turn on *Embed view token authentication* and copy the key. The key is stored encrypted with a key derived from `AUTH_SECRET` and is never sent to a browser. In a lesson, add a Video block and paste the Bunny video ID (or its embed link). The player gets a signed address that expires after the configured hours, so a copied link stops working. YouTube (privacy-enhanced domain) and Vimeo (do-not-track) links work too. If `AUTH_SECRET` changes, enter the Bunny key again.

## Payments: bank transfer

Settings, Payments: beneficiary, bank, IBAN, SWIFT and instructions. A paid course has a price and currency. A student who enrols sees the details and a payment reference (`CR-00012`), the enrolment is **pending**, the student is emailed the bank details and reference, and admins are emailed (Resend, see `docs/email.md`). When the transfer arrives, School, Students, **Confirm payment** opens the course and emails the student. There are no online payments yet.

## Student sign-in

An emailed link (valid 20 minutes, no password) or Google. A new address gets a Student account when "Anyone can create a student account" is on. The same answer is shown whether or not an address has an account. Links work for the Student role only: staff and admins sign in with a password or Google, so a mailbox alone never opens the admin.

## Language

The interface is English. Courses carry a `language` field (English, Bulgarian) and the strings of the player are in the components, ready to be moved to a dictionary when a second interface language is added.

## Not built yet

Quizzes and graded tests (lesson, module and course level), certificates, drip release, announcements, Stripe, duplicate course, image upload from the CLI, Bunny video upload from the admin and watch-position resume.
