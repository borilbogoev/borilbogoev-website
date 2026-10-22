# Classroom

The Classroom is the learning management module: categories, courses, modules and lessons at `https://borilbogoev.com/classroom`, built in `/admin/classroom`. Students sign in, enrol (free, by invitation or by bank transfer), learn in a three-column player, keep private notes and ask questions under each lesson.

## How it fits together

| Part | Where |
|---|---|
| Tables | `classroom_categories`, `classroom_courses`, `classroom_modules`, `classroom_lessons`, `classroom_blocks`, `classroom_lesson_revisions`, `classroom_enrolments`, `classroom_progress`, `classroom_notes`, `classroom_comments`, `classroom_block_state`, `classroom_settings` (`src/modules/classroom/schema.ts`, migration `drizzle/0004_classroom_module.sql`, additive only) |
| People | Ordinary rows of `users` with the role **Student** (`modules/auth/roles.ts`). There is no second user system |
| Permissions | `classroom.view`, `write`, `delete`, `moderate`, `enrol`, `settings`, `learn` (see below) |
| Lesson blocks | `lib/blocks.ts`. Content blocks are the Presentations elements, reused |
| Course data and tree | `lib/courses.ts` |
| Access and enrolment | `lib/access.ts` |
| Progress, notes, comments, block state | `lib/learn.ts` |
| Student sign-in | `lib/signin.ts` (emailed link), Google through the existing OAuth routes |
| Settings (bank details, Bunny.net, sign-up) | `lib/settings.ts`, `lib/settings-store.ts`; secrets encrypted by `lib/secrets.ts` |
| Video and audio | `lib/media.ts` |
| Brand check | `lib/brand.ts` |
| Public pages | `src/app/(site)/classroom/*` (hub, category, course, sign-in, my courses, with the site header) and `src/app/(classroom)/classroom/[course]/[module]/*` (module and lesson, in the player frame) |
| Player | `components/player.tsx` (frame, outline, lesson), `components/discussion.tsx` (discussion, notes), `components/blocks.tsx` (every block) |
| Admin | `/admin/classroom` (Courses, Categories, Students, Discussion, Settings), `/<id>/builder`, `/<id>/settings` |
| API | `/api/classroom/*` (learners), `/api/admin/classroom/*` (staff) |

## Access control

Part of the app's roles and permissions, not a separate system.

| Role | In the Classroom |
|---|---|
| Owner, Admin | Everything. Admin also manages students and payments, settings and keys |
| Editor | Builds courses (`write`), answers and moderates questions (`moderate`) |
| Contributor, Viewer | Read-only (`view`) |
| Student | `classroom.learn` only: learn in enrolled courses. Sent to `/classroom/my` if they open `/admin` |

On top of the role, **enrolment** decides which courses a student may open (`classroom_enrolments`): `active`, `pending` (a bank transfer not confirmed yet) or `revoked`. A lesson marked **Free preview** opens for anyone. Staff see everything.

Admins add students under Classroom, Students, or in Users with the role Student. A student's progress, notes and answers survive when access is removed.

## Public pages stay static

The catalog, course, module and lesson pages are prerendered and cached like the rest of the site (no `cookies()`), and refresh the moment something is saved (`lib/revalidate.ts`). Everything personal is fetched in the browser after the page loads:

- `GET /api/classroom/courses/<id>/state`: who you are, your enrolment, what you finished.
- `GET /api/classroom/lessons/<id>`: the lesson **blocks**, only if the access check passes. Paid content is never in the HTML.

Remember this when you add a feature: personal or paid data goes through these APIs, not into the static page.

## Courses, modules, lessons

- **Course**: title, address `/classroom/<slug>`, category, short description, image, language, access (free, paid, invitation), price, level, duration, outcomes, instructor, search settings. Statuses draft, active, inactive, archived. Only active courses are public.
- **Module**: title, short description, image, address. Its page lists its lessons, with the course outline in the left sidebar.
- **Lesson**: title, summary, featured image, minutes, free preview, status (draft or published), blocks. New lessons start as drafts: publish each one. Students see published lessons only.
- Structure (modules, lessons, order) saves at once in the builder. Lesson content saves with Save, keeps 30 versions, and block ids stay stable so students' answers are not lost when you edit.

## Blocks

Heading, Text, Bullet list, Quote, Callout, Image, Image grid, Video, Audio, Interactive embed, Steps, Cards, Before and after, Accordion, Code or prompt (with a copy button), Table, Resources, Button, Divider, Spacer, and the learning blocks that save the student's state: **Checklist**, **Question box** (optionally sent to the instructor, who reads it under Discussion) and **Flashcards**. Define a new block once in `lib/blocks.ts` (controls), draw it in `components/blocks.tsx`. If it keeps student state, add its shape to `saveBlockState` in `lib/learn.ts`.

## Video: Bunny.net

Settings, Video: the **Library ID** and the **embed token key**. In the Bunny dashboard: Stream, your library, Security, turn on *Embed view token authentication* and copy the key. The key is stored encrypted with a key derived from `AUTH_SECRET` and is never sent to a browser. In a lesson, add a Video block and paste the Bunny video ID (or its embed link). The player gets a signed address that expires after the configured hours, so a copied link stops working. YouTube (privacy-enhanced domain) and Vimeo (do-not-track) links work too. If `AUTH_SECRET` changes, enter the Bunny key again.

## Payments: bank transfer

Settings, Payments: beneficiary, bank, IBAN, SWIFT and instructions. A paid course has a price and currency. A student who enrols sees the details and a payment reference (`CR-00012`), the enrolment is **pending**, and admins are emailed (Resend, as for Forms). When the transfer arrives, Classroom, Students, **Confirm payment** opens the course. There are no online payments yet.

## Student sign-in

An emailed link (valid 20 minutes, no password) or Google. A new address gets a Student account when "Anyone can create a student account" is on. The same answer is shown whether or not an address has an account. Links work for the Student role only: staff and admins sign in with a password or Google, so a mailbox alone never opens the admin.

## Language

The interface is English. Courses carry a `language` field (English, Bulgarian) and the strings of the player are in the components, ready to be moved to a dictionary when a second interface language is added.

## Not built yet

Quizzes and graded tests (lesson, module and course level), poll block, certificates, drip release, announcements, analytics dashboard, a CLI like `npm run landing` for courses, Stripe, duplicate course, preview of draft lessons in the real player (the builder canvas shows the real lesson styles), Bunny video upload from the admin and watch-position resume.
