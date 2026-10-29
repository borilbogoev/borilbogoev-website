# My account

Every signed-in person has their own area at `https://borilbogoev.com/account`: students, and staff too. It is where the people who joined a Session or a course look after their details and find their things again.

| Page | Address | What it shows |
|---|---|---|
| Home | `/account` | A personal summary, one block per enrolled course and one per form the person answered, each linking to the full page |
| My Info | `/account/info` | Profile picture, name, username, phone, country, company, job title, time zone, about, password change. Email is shown but read-only |
| My Courses | `/account/courses` | Every enrolled course: picture, title, instructor line, description, modules, lessons, join date, progress, a Course details button and a Continue link |
| My Responses | `/account/responses` | Every form the person answered, each response listed, with the full answers on `/account/responses/<id>` |
| Sign in | `/account/login` | Emailed link (no password), password, or Google. A signed-out visitor to any `/account` page lands here |

The menu (Home, My Info, My Courses, My Responses, Website, Log out, plus Admin for staff) is one list in `src/modules/account/components/nav.tsx`. To add a page: add a route under `src/app/(account)/account/(area)/`, one entry in that list, and a block on Home.

## How a person is matched to responses

Forms do not store who filled them in. A response belongs to a person when one of its answers equals their email (any case), or when an admin recorded it for them (`user_id`). Changing the email on an account would break that link, so My Info does not allow it. Every query is in `src/modules/account/lib/data.ts` and is scoped to the signed-in user; asking for someone else's response returns 404.

## Profile fields

Added to `users` by migration `drizzle/0005_damp_franklin_richards.sql` (additive, nullable): `username` (unique, lowercase), `avatar_url`, `phone`, `company`, `job_title`, `country`, `timezone`, `bio`.

## Bringing form respondents in

```bash
npx tsx scripts/enrol-respondents.ts --form you-and-ai --course <course-slug>          # dry run: counts only
npx tsx scripts/enrol-respondents.ts --form you-and-ai --course <course-slug> --apply  # create students and enrol
```

It reads `first_name`, `last_name` and `email` from each response, creates one Student account per email (existing accounts are never changed), sets a username from the email, and enrols everyone with an active account. It prints counts and never full email addresses. Running it twice does nothing the second time. New students have no password: they sign in with an emailed link at `/account/login`.

## The Session block

The dark card for a dated live event is a block, not page code. Add a `session` block in a landing page, a form, a presentation or a lesson. Fields: eyebrow, title, subtitle, text, up to six bullets, date (`2026-11-12`), start time (`13:00`), UTC offset, time zone label, button label and link, optional second button, optional picture. Without a date the card has no date frame. Defined in `modules/forms/lib/blocks.ts` (`SESSION_CONTROLS`), drawn by `src/components/session-card.tsx`.
