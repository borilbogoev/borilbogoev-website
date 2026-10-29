# HANDOVER PROMPT: Community Module v1.0.0 for borilbogoev.com

You are working inside the borilbogoev.com codebase (Next.js app on Vercel, Neon Postgres, Vercel file storage). Build a new self-contained **Community module** end to end, in one pass, following this document. Read it fully before writing code.

---

## 0. Working agreement

- Work on a new feature branch `feature/community-v1`. Commit after each build step in section 13 with a clear message.
- Do not stop to ask questions. When something is ambiguous, pick the most reasonable option, follow the existing conventions of the repo, and log the decision in `docs/community/DECISIONS.md` (one line each: decision, reason).
- Real blockers only (missing credentials, an unsolvable conflict with existing code): finish everything not blocked, then report the blocker clearly at the end.
- After every step run typecheck, lint and build. Fix everything before moving on.
- Generate database migrations but **never run them against production**. Apply them only to the development or preview database branch. List the migration files in the final report so the owner can apply them to production deliberately.
- Do not modify or break existing modules (Forms, Landing Pages, School, etc.). Touch shared code only where the module must integrate (navigation, profile page, admin menu, notification bell mount point). Keep those edits minimal.
- No email sending anywhere in this module. Email is not ready app-wide.
- Writing style for any UI copy and docs: direct, short, no corporate filler, no long dashes (use hyphens or colons).

---

## 1. Phase 0: Discovery (do this first, write findings to `docs/community/DISCOVERY.md`)

Do not assume. Inspect the repo and record:

1. **Auth**: how the current user is resolved on the server (session helper), user table name and columns (id type, display name, username/slug, avatar, role fields), how SuperAdmin is identified.
2. **Database layer**: ORM or query builder in use, migration tool and folder, naming conventions (snake_case or camelCase, id type uuid or int, timestamps), how the Neon connection is created (pooled, serverless driver).
3. **File storage**: how uploads currently work (client direct upload vs server upload), helper functions, size limits.
4. **Admin backend**: how existing modules (Forms, Landing Pages, School) register their admin pages, menu items, layouts and permission checks. Mirror this pattern exactly for the Community control panel.
5. **Profile page**: route, layout, existing tabs or sections, how another user's public profile differs from the owner's view.
6. **UI system**: component library, styling approach (Tailwind, CSS modules, etc.), design tokens, existing form, modal, toast, avatar, tabs, dropdown components. Reuse them. Do not introduce a new UI library.
7. **i18n**: whether the app uses a translation layer. If yes, use it. If not, centralize all module strings in one file `src/.../community/strings.ts` so translation is easy later (Bulgarian and regional versions are planned).
8. **Existing patterns** for route handlers vs server actions, validation (zod or similar), error handling, rate limiting, and tests.

Use what exists. Where this document names a technology generically (for example "object storage"), use whatever the repo already uses.

---

## 2. Scope

### In v1.0.0

1. **Multi-community**: a platform can host several communities. One default community is seeded.
2. **Feed** per community: create, edit, delete (soft) posts with text and up to 4 images. Newest first, cursor pagination.
3. **Comments**: flat comments on posts, edit and delete own.
4. **Mentions**: `@` autocomplete in posts, comments and chat. Stored as structured records.
5. **In-app notifications**: bell with unread count (mention, comment on your post).
6. **1-1 chat**: platform-wide direct messages with conversation list and unread indicators.
7. **Live updates** by polling, prioritized for posts and comments.
8. **Profile "Community" tab**: Posts, Comments, Mentions, Conversations (messages live inside conversations).
9. **Safety**: reporting, block user, rate limiting, banning.
10. **SuperAdmin Control Panel** for communities, members, moderation and global settings.

### Explicitly out of v1.0.0 (do not build)

Likes or reactions, channels or categories inside a community, pinned posts, nested replies, rich text editor, video upload, link previews, group chat, typing indicators, read receipts, global search, member directory, levels and points, paid or tiered access, region-aware communities, email or push notifications, websockets.

### Future-proofing (cheap hooks only, no logic)

- `communities.region_id` nullable, unused.
- Conversations modeled with a participants table so group chat can come later.
- All module strings centralized for translation.

---

## 3. Data model

Prefix every table with `community_`. Follow the repo's id type and timestamp conventions (below uses `id` and `timestamptz`). Add all foreign keys with sensible `ON DELETE` behavior and the indexes listed.

### 3.1 `community_communities`
| column | type | notes |
|---|---|---|
| id | pk | |
| slug | text unique not null | url segment, lowercase, immutable after creation |
| name | text not null | |
| description | text | |
| icon_url | text | |
| cover_url | text | |
| visibility | text not null default 'listed' | `listed` or `hidden` (hidden = only members can see it exists) |
| join_mode | text not null default 'open' | `open` (anyone logged in can join) or `closed` (admin adds members) |
| status | text not null default 'active' | `active` or `archived` (archived = read only, no new posts or comments) |
| is_default | boolean not null default false | exactly one true, enforce with a partial unique index |
| region_id | nullable fk or text | unused in v1, reserved |
| sort_order | int default 0 | |
| created_by | fk user | |
| created_at, updated_at | timestamptz | |

### 3.2 `community_members`
`id`, `community_id`, `user_id`, `role` (`member` or `moderator`), `status` (`active` or `banned`), `banned_reason`, `banned_at`, `banned_by`, `joined_at`.
Unique `(community_id, user_id)`. Index `(user_id)`.

### 3.3 `community_posts`
`id`, `community_id`, `author_id`, `body` (text, max 5000), `comment_count` (int default 0, denormalized), `status` (`published`, `hidden_by_mod`, `deleted`), `edited_at`, `deleted_at`, `created_at`, `updated_at`.
Indexes: `(community_id, created_at desc, id desc)` where status = 'published'; `(author_id, created_at desc)`.

### 3.4 `community_post_media`
`id`, `post_id`, `url`, `storage_key`, `mime_type`, `width`, `height`, `size_bytes`, `position` (0 to 3), `created_at`. Index `(post_id, position)`.

### 3.5 `community_comments`
`id`, `post_id`, `community_id` (denormalized for permission checks and profile queries), `author_id`, `body` (text, max 2000), `status` (`published`, `hidden_by_mod`, `deleted`), `edited_at`, `deleted_at`, `created_at`.
Indexes: `(post_id, created_at asc, id asc)`; `(author_id, created_at desc)`.

### 3.6 `community_mentions`
`id`, `community_id` (nullable for chat mentions), `source_type` (`post`, `comment`, `message`), `source_id`, `mentioned_user_id`, `author_id`, `created_at`.
Unique `(source_type, source_id, mentioned_user_id)`. Index `(mentioned_user_id, created_at desc)`.

### 3.7 `community_conversations`
`id`, `type` (`direct` only in v1), `dm_key` (text unique, sorted `"<smallerUserId>:<largerUserId>"` so one direct conversation per pair), `last_message_at`, `created_at`.

### 3.8 `community_conversation_participants`
`id`, `conversation_id`, `user_id`, `last_read_at`, `created_at`. Unique `(conversation_id, user_id)`. Index `(user_id)`.

### 3.9 `community_messages`
`id`, `conversation_id`, `sender_id`, `body` (text, max 4000), `status` (`sent`, `deleted`), `created_at`, `deleted_at`.
Index `(conversation_id, created_at desc, id desc)`.

### 3.10 `community_notifications`
`id`, `user_id` (recipient), `type` (`mention`, `post_comment`), `actor_id`, `community_id`, `post_id`, `comment_id` nullable, `source_type`, `source_id`, `read_at` nullable, `created_at`.
Indexes: `(user_id, read_at, created_at desc)`. Never notify a user about their own action. Do not create notification rows for direct messages (unread messages are derived from `last_read_at`).

### 3.11 `community_reports`
`id`, `reporter_id`, `target_type` (`post`, `comment`, `message`, `user`), `target_id`, `community_id` nullable, `reason` (`spam`, `abuse`, `inappropriate`, `other`), `details` (text, max 500), `message_snapshot` (text nullable, filled only for message reports), `status` (`open`, `resolved`, `dismissed`), `resolved_by`, `resolved_at`, `resolution_note`, `created_at`.
Unique `(reporter_id, target_type, target_id)` to prevent duplicate reports.

### 3.12 `community_blocks`
`id`, `blocker_id`, `blocked_id`, `created_at`. Unique `(blocker_id, blocked_id)`.
Effect: the blocked user cannot start or continue a direct conversation with the blocker (sending returns a generic error), and their mentions of the blocker create no notification.

### 3.13 `community_suspensions`
`id`, `user_id`, `reason`, `created_by`, `created_at`, `lifted_at` nullable. A suspended user is read-only across the whole module (cannot post, comment, message, mention). SuperAdmin only.

### 3.14 `community_settings`
Single row table (id = 1): `posting_paused` bool, `max_images_per_post` int default 4, `max_image_mb` int default 8, `rate_post_per_hour` int default 10, `rate_comment_per_hour` int default 60, `rate_message_per_minute` int default 20, `updated_by`, `updated_at`. Settings are read through one cached helper with a short TTL (30 s).

### Seeding (in the migration or an idempotent seed script)
- Insert the default community: name "Community", slug `community`, `is_default = true`, `join_mode = 'open'`, `visibility = 'listed'`.
- Insert the `community_settings` row.
- Backfill: do **not** mass-insert all users. Use lazy membership: a helper `ensureDefaultMembership(userId)` is called on first visit to any community route or the profile tab and inserts an active member row in the default community if none exists.

---

## 4. Roles and permission matrix

Roles: **SuperAdmin** (platform role, resolve from the existing auth), **Moderator** (per community), **Member** (per community), **Visitor** (logged in, not a member), **Anonymous**.

Create one module `permissions.ts` with pure functions taking `(user, membership, community, resource)`. Every route handler and server action must call these. Never rely on UI hiding.

| Action | Anonymous | Visitor | Member | Moderator | SuperAdmin |
|---|---|---|---|---|---|
| View listed community feed and posts | no | yes | yes | yes | yes |
| View hidden community | no | no | yes | yes | yes |
| Join open community | no | yes | n/a | n/a | yes |
| Create post or comment | no | no | yes | yes | yes |
| Edit or delete own post or comment | no | no | yes | yes | yes |
| Hide or delete others' post or comment (in community) | no | no | no | yes | yes (all) |
| Ban or unban member (in community) | no | no | no | yes | yes (all) |
| Assign moderators | no | no | no | no | yes |
| Create, edit, archive communities | no | no | no | no | yes |
| Global settings, suspensions, global moderation queue | no | no | no | no | yes |
| Direct message another user | no | yes | yes | yes | yes (unless blocked or suspended) |

Additional rules:
- Banned members: read only in that community.
- Archived community: read only for everyone, including moderators (SuperAdmin can still hide or delete).
- `posting_paused = true` in settings: nobody can create posts or comments (messages still work). Show a clear banner.
- Moderators see and act on reports for their community only. SuperAdmin sees all.

---

## 5. Routes

Match the repo's routing and layout conventions. Suggested structure (adjust paths to the repo):

### Pages
- `/community` : default community feed.
- `/community/[slug]` : feed of a community. Header shows name, description, member count, Join button (if open and not a member), community switcher.
- `/community/[slug]/post/[postId]` : single post with comments.
- `/community/communities` : list of listed communities with Join buttons.
- `/community/messages` : conversation list.
- `/community/messages/[conversationId]` : conversation thread.
- `/community/messages/new?user=<userId>` : creates or opens the direct conversation with that user and redirects.
- `/community/notifications` : full notification list with mark all as read.
- Profile: add a **Community** tab to the profile page, see section 10.
- Admin: section 11.

### API (route handlers, or server actions if that is the repo's pattern; all validated with a schema, all return typed JSON)
Feed and posts
- `GET /api/community/[slug]/posts?cursor=` : page of 20, returns `items`, `nextCursor`.
- `GET /api/community/[slug]/posts/updates?after=<cursor>` : returns `{ newCount, newestCursor }` only (cheap poll).
- `POST /api/community/[slug]/posts`
- `PATCH /api/community/posts/[id]`, `DELETE /api/community/posts/[id]`
- `POST /api/community/uploads/image` : returns a signed or direct upload token per the repo's storage pattern, enforcing type and size.

Comments
- `GET /api/community/posts/[id]/comments?cursor=` (page of 30, oldest first)
- `GET /api/community/posts/[id]/comments/updates?after=<cursor>` : returns comments newer than the cursor (small payload, usually empty).
- `POST /api/community/posts/[id]/comments`
- `PATCH /api/community/comments/[id]`, `DELETE /api/community/comments/[id]`

Mentions
- `GET /api/community/mentions/suggest?q=&communityId=` : up to 8 active members (display name, username, avatar) of that community matching a prefix. Without `communityId` (chat) search users who already have a conversation with the caller first, then any user by exact username prefix. Minimum 2 characters of query for non-community scope.

Notifications
- `GET /api/community/notifications?cursor=`, `GET /api/community/notifications/unread-count`
- `POST /api/community/notifications/read` (ids or all)

Chat
- `GET /api/community/conversations` (with last message preview and unread flag)
- `POST /api/community/conversations` (body: `userId`) : get or create the direct conversation.
- `GET /api/community/conversations/[id]/messages?cursor=` and `?after=` for updates.
- `POST /api/community/conversations/[id]/messages`
- `POST /api/community/conversations/[id]/read`
- `GET /api/community/conversations/unread-count`

Safety
- `POST /api/community/reports`
- `POST /api/community/blocks`, `DELETE /api/community/blocks/[userId]`

Membership
- `POST /api/community/[slug]/join`, `POST /api/community/[slug]/leave` (the default community cannot be left)

Admin (SuperAdmin or community moderator as per section 4, enforced server side)
- Communities CRUD and archive, members list and actions, reports queue and resolution, settings, suspensions. See section 11.

---

## 6. Business rules

### 6.1 Posts
- Body trimmed, 1 to 5000 chars, may be empty only if at least one image is attached.
- Up to `max_images_per_post` images. Allowed types: JPEG, PNG, WebP, GIF. Max `max_image_mb` each. Validate MIME by content where possible, not only extension. Store width and height.
- Render body as **plain text** with line breaks preserved. No HTML injection. URLs are auto-linked with `rel="noopener noreferrer nofollow ugc"` and `target="_blank"`. No link previews.
- Edit sets `edited_at` and shows an "edited" label. Delete is soft: status `deleted`, body cleared from public responses (show "This post was deleted" only where a thread needs context, otherwise omit from feed). Deleting a post hides its comments from lists.
- Counts: `comment_count` is incremented and decremented in the same transaction as comment create and delete. Count only `published` comments.

### 6.2 Comments
- Flat. Body 1 to 2000 chars. Same plain-text and auto-link rules.
- Replying to someone: the user types `@name`, which creates a mention (no nesting).

### 6.3 Mentions (important, build once and reuse for posts, comments, messages)
- Storage format inside the text body: `@[Display Name](user:<userId>)`. The editor inserts this token when the user picks a suggestion. The display name inside the token is cosmetic.
- On save, a shared function `extractMentions(body)` parses tokens, de-duplicates user ids (max 10 per item), then **validates server side**: for community content each mentioned user must be an active member of that community; for chat each user must exist and not have blocked the sender. Invalid tokens are rewritten to plain `@Name` text.
- Write rows to `community_mentions`. On edit, diff: add new mentions, remove dropped ones. Create a `mention` notification only for newly added mentions and never for self mentions or users who blocked the author.
- Rendering: tokens render as links to the user's profile (using the current display name looked up at render time, fall back to the stored name if the user is gone).
- Provide a reusable `MentionTextarea` component: typing `@` opens an accessible suggestion list (keyboard up, down, enter, escape), debounced 200 ms requests to the suggest endpoint, inserts the token, shows the friendly name in the visible text. A simple approach is acceptable: keep a plain textarea holding tokens, and show a rendered preview or highlight the tokens. Choose the most robust, dependency-light approach and document it in DECISIONS.md.

### 6.4 Notifications
- `post_comment`: when someone comments on your post (not your own comment). One notification per comment, but collapse in the UI by post ("3 new comments on your post").
- `mention`: see 6.3.
- Opening a notification marks it read and navigates to the target. "Mark all as read" supported.

### 6.5 Chat
- One direct conversation per pair, enforced by `dm_key` unique constraint. Creating handles the race by catching the unique violation and reading the existing row.
- You cannot message yourself.
- A message from a blocked sender is rejected with a generic "You can't message this user" error. The blocker still sees past messages.
- Unread = messages from the other participant with `created_at > my last_read_at`. Opening a thread or receiving messages while the thread is open calls the read endpoint.
- Conversation list sorted by `last_message_at desc`. Update `last_message_at` in the same transaction as message insert.
- Message bodies are plain text with auto-link and mention tokens. Max 4000 chars. Soft delete own messages (shows "Message deleted").
- Conversations and messages are private to participants. Admins have **no** read access to message contents in v1, except through reported messages: a report on a message snapshots the body into the report's `details` context so a SuperAdmin can review it (store `message_snapshot` as a column on the report row for this case).

### 6.6 Rate limiting (serverless safe)
Use the repo's existing rate limiter if there is one. Otherwise implement DB-count based limits: count the user's rows created in the last window from the relevant table, compare to `community_settings`. Return HTTP 429 with a friendly message and `retryAfter`. Limits: posts per hour, comments per hour, messages per minute. SuperAdmin exempt.

### 6.7 Reporting
- Any member can report a post, comment, message or user once. Show a confirmation toast. The report enters the queue with status `open`.
- Resolving options for admins: `dismiss`, `hide content` (sets `hidden_by_mod`), `delete content`, `ban from community`, `suspend from module`. Each action records `resolved_by`, `resolved_at`, `resolution_note`.

### 6.8 Membership
- `open` communities: Join creates an active member row. `closed`: Join button hidden, admin adds members.
- Leaving a community keeps content but the user can no longer post there. The default community cannot be left.
- Member counts: computed with a count query, cached briefly, not denormalized in v1.

---

## 7. Live updates (polling spec)

Posts and comments are the priority. Build one reusable hook `usePolling(fn, { intervalMs, enabled })` with these behaviors:
- Pauses while `document.visibilityState !== 'visible'`, resumes immediately on focus with one catch-up call.
- Adds +/- 20% random jitter to the interval.
- Exponential backoff on errors (max 60 s), resets on success.
- Cancels in-flight requests on unmount or dependency change.
- Pauses when `navigator.onLine` is false.

Usage:
| Surface | Interval | Mechanism |
|---|---|---|
| Community feed | 15 s | call `posts/updates?after=<newestCursor>`. If `newCount > 0`, show a sticky pill "N new posts". Clicking fetches the new items and prepends them, scrolls to top. Never insert automatically while the user is scrolled down. |
| Post page comments | 10 s | call `comments/updates?after=<lastCommentCursor>`. Append new comments inline if the user is near the bottom, otherwise show "N new comments" pill. Own comments render instantly (optimistic) and reconcile with the server id. |
| Notification bell | 30 s | `unread-count`. |
| Messages unread badge | 30 s | `conversations/unread-count`. |
| Open conversation | 10 s | `messages?after=`. Own messages optimistic. |
| Conversation list | 30 s | refetch list while the page is open. |

All "updates" endpoints must be cheap: single indexed query, return empty payloads quickly, and send `Cache-Control: no-store`. Use cursor of the form `<createdAtIso>_<id>` for stable ordering.

Isolate this behind the hook and a tiny data layer, so a managed realtime service can replace polling later without touching components.

---

## 8. UI requirements

Reuse the repo's design system and brand tokens. Mobile first, fully responsive. Accessible: keyboard navigable, visible focus states, labels on all controls, `aria-live="polite"` for the new-items pills, alt text prompt for images (optional field).

Components to build (names indicative):
- `CommunityShell` (header with community switcher, join button, banner area for paused posting or archived state)
- `PostComposer` (textarea with mentions, image picker with previews and remove, character counter, submit with loading state)
- `PostCard` (author, time, edited label, body, images grid, comment count, menu: edit, delete, report, hide for mods)
- `ImageGrid` and `ImageLightbox` (simple, keyboard closable)
- `CommentList`, `CommentItem`, `CommentComposer`
- `MentionTextarea`, `MentionText` (renderer)
- `NewItemsPill`
- `NotificationBell`, `NotificationList`
- `ConversationList`, `ConversationThread`, `MessageComposer`, `StartChatButton` (placed on user profiles and next to author names)
- `ReportDialog`, `BlockUserButton`
- `CommunityCard`, `CommunityList`
- `EmptyState`, `Skeleton` loaders, error boundaries with retry

States to design for every list: loading skeleton, empty, error with retry, end of list.

Time display: relative ("5 min ago") with full timestamp on hover, rendered in the viewer's timezone. Be hydration safe (render relative time client side only).

---

## 9. Security and quality requirements

- Every endpoint: authenticate, authorize through `permissions.ts`, validate input with schemas, return generic errors for forbidden resources (avoid leaking existence of hidden communities or private conversations).
- All queries parameterized. No raw string interpolation.
- Escape or never render user HTML. No `dangerouslySetInnerHTML` for user content.
- Uploads: allowlist MIME types, size cap, server issues the storage key (user cannot choose paths), strip EXIF GPS if the repo already has an image pipeline, otherwise note it as follow-up in DECISIONS.md.
- Deleted or hidden content must never be returned by any list endpoint, profile tab, notification, or mention listing for normal users.
- Profile tab data is filtered by what the **viewer** can see: content from hidden communities the viewer is not a member of must not appear.
- Idempotency: double-click on submit must not create duplicate posts, comments or messages (disable button while pending and add a client-generated request id accepted by the server for create endpoints, unique per user for 5 minutes).
- Transactions where counts or multiple rows change together.
- Performance: no N+1 queries. Feed query returns posts, authors, media and viewer-relevant flags in at most 3 queries. Add the indexes from section 3.

---

## 10. Profile "Community" tab

Add a main tab **Community** to the user profile page (use the profile page's existing tab mechanism). Inside, sub-tabs (use the `?section=` query param so links are shareable):

1. **Posts**: the user's published posts, newest first, with community name, comment count, link to the post. Cursor pagination.
2. **Comments**: the user's comments, each showing a snippet, the post it belongs to and a link to it.
3. **Mentions**: items where the user was mentioned (post or comment), with author, snippet and link. Message mentions are shown only to the owner and only under Conversations context, not here.
4. **Conversations** (owner only): list of the user's conversations with last message preview and unread dot. Opening one shows the thread, including their messages, inside the profile area or navigates to `/community/messages/[id]`. Choose navigation to the messages route if embedding is complicated.

Rules:
- Add a community filter dropdown (All communities, or one) applied to Posts, Comments, Mentions.
- Viewing **your own** profile: all four sub-tabs.
- Viewing **someone else's** profile: Posts, Comments, Mentions only (filtered by what you can see), plus a "Message" button (`StartChatButton`) and a "Block / Report" menu.
- Show counts on the sub-tabs if cheap, otherwise omit.
- Calls `ensureDefaultMembership` for the profile owner view.

---

## 11. SuperAdmin Control Panel

Add a **Communities** section to the existing admin backend, mirroring how Forms, Landing Pages and School are registered. Access: SuperAdmin for everything; community moderators get a reduced view limited to their communities (Members and Reports only).

Pages:
1. **Communities list**: table with name, slug, visibility, join mode, status, member count, post count, default badge. Actions: create, edit, archive or unarchive, set as default (swaps the flag atomically), reorder.
2. **Community edit / create form**: name, slug (editable only on create), description, icon and cover upload, visibility, join mode, status. Validation: unique slug, reserved slugs blocked (`communities`, `messages`, `notifications`, `post`, `new`, `admin`).
3. **Members** (per community): searchable table with role and status. Actions: add member by searching users, remove, make or remove moderator (SuperAdmin only), ban or unban with reason.
4. **Moderation queue** (global for SuperAdmin, per community for moderators): filter by status, type, community. Row shows reporter, target preview, reason, details, date. Actions as in 6.7. Content preview must include a link to the item.
5. **Content tools**: search a post or comment by id or text within a community and hide or delete it (basic table, no complex search).
6. **Settings**: all fields from `community_settings` (pause posting, image limits, rate limits). Show who changed it last.
7. **Suspensions**: list, add by user search with reason, lift.
8. **Overview**: small stats cards: total communities, members, posts and comments last 7 days, open reports. Plain queries, no analytics infrastructure.

Every admin action writes to a lightweight audit log table `community_admin_log` (`id`, `actor_id`, `action`, `target_type`, `target_id`, `meta` json, `created_at`). Show the last 50 entries on the Overview page.

---

## 12. Documentation to produce

- `docs/community/DISCOVERY.md` (section 1)
- `docs/community/DECISIONS.md`
- `docs/community/README.md`: architecture summary, folder structure, data model diagram (text or mermaid), how to run migrations, how polling works, how to extend (add likes later, add realtime later, region support later), permission matrix.
- `docs/community/QA-CHECKLIST.md`: the manual test script from section 14 with checkboxes.

Folder structure suggestion (adapt to the repo): everything lives under one module folder (for example `src/modules/community/`) with `db/`, `server/` (services and permissions), `api/` or `actions/`, `components/`, `hooks/`, `lib/` (mentions, cursors, polling), `strings.ts`. Pages stay in the app router as thin wrappers.

---

## 13. Build steps (execute in order, commit after each, all acceptance criteria must pass before the next step)

### Step 1: Foundation
Do: discovery docs, schema and migrations for all tables in section 3 (including `community_admin_log`), seed default community and settings, `permissions.ts`, auth helpers, `ensureDefaultMembership`, settings helper, cursor utilities, shared validation schemas, strings file.
Accept: migrations apply cleanly on the dev database, are idempotent for seed, typecheck passes, unit tests for permissions and cursor utilities pass.

### Step 2: Feed, posts, uploads, community switcher
Do: community shell, switcher, join and leave, post composer with image upload, post cards, feed with cursor pagination, edit and soft delete, single post page.
Accept: a member can post text and up to 4 images, sees it in the feed, edits and deletes it. A non-member sees the feed but not the composer, and can join if the community is open. Archived and paused states block posting with a clear banner. Hidden communities return not found to non-members.

### Step 3: Comments
Do: comment list, composer, edit and delete, `comment_count` maintenance, post page integration.
Accept: counts stay correct after create, delete and moderator hide. Comments paginate. Duplicate submits do not create duplicates.

### Step 4: Mentions and notifications
Do: mention parser and validator, `MentionTextarea`, `MentionText`, suggest endpoint, mention rows, notifications for mentions and post comments, bell, notification page.
Accept: mentioning a member creates exactly one notification, editing to remove the mention removes the mention row, self mentions and non-member mentions are neutralized, clicking a notification marks it read and navigates correctly, unread count is accurate.

### Step 5: Live updates
Do: `usePolling` hook, updates endpoints, new items pills for feed and comments, optimistic own items, bell and badge polling.
Accept: with two browsers, a post from user A shows the "1 new post" pill for user B within about 20 s without a page reload and without moving the scroll position. Same for comments on an open post. Polling stops in a hidden tab (verify via network panel) and resumes on focus.

### Step 6: 1-1 chat
Do: conversations, messages, read state, unread badges, start chat from profile and author name, blocks, message mentions.
Accept: starting a chat twice with the same user opens the same conversation (also under a race), unread indicators clear on open, a blocked sender cannot send, messages are never visible to non-participants (including via direct URL).

### Step 7: Profile Community tab
Do: tab and sub-tabs per section 10 with community filter and visibility filtering.
Accept: owner sees four sub-tabs, others see three, nothing from hidden communities leaks, deleted and hidden content never appears, pagination works.

### Step 8: Safety and SuperAdmin Control Panel
Do: report dialog, block button, rate limits, bans, suspensions, full admin section per section 11, audit log.
Accept: reporting works once per target, each resolution action has the described effect, a banned member cannot post in that community but can in others, a suspended user is read-only everywhere, rate limits return 429 with a friendly message, moderators cannot act outside their community, settings changes take effect within the cache TTL.

### Step 9: Hardening and docs
Do: error boundaries, empty and loading states audit, accessibility pass, N+1 and index audit using query logging on the dev database, write all docs in section 12, run the manual QA checklist yourself with two test users and fix defects.
Accept: `npm run build` (or the repo's build command) succeeds with no type or lint errors, QA checklist fully checked, README complete.

---

## 14. Manual QA script (copy into `QA-CHECKLIST.md`)

Use three test users: A (member), B (member), M (moderator), plus the SuperAdmin.

1. A posts text only, text with 4 images, a 5th image is rejected, an oversized file is rejected, a non-image is rejected.
2. B sees A's post appear via the new posts pill, then comments mentioning A. A gets one notification and sees the comment appear live on the open post.
3. A edits and deletes a comment and a post. Counts are correct everywhere.
4. A mentions a user who is not in the community: it falls back to plain text, no notification.
5. B reports A's post twice: second attempt is blocked. M hides it. It disappears for B but A sees it marked hidden by a moderator.
6. M bans B in the community: B can read but not post or comment. B can still post in another community.
7. SuperAdmin pauses posting: banner appears, posting blocked, messages still work. Resume.
8. SuperAdmin archives a community: read only. Sets another community as default: only one default remains.
9. A starts a chat with B twice (also from two tabs at once): single conversation. B blocks A: A's send fails with the generic error.
10. A's profile: owner view shows Posts, Comments, Mentions, Conversations. B's view of A shows three tabs and no private data. Community filter works. Hidden community content does not leak to a non-member.
11. Rate limits: exceed the post limit, receive 429 with a friendly message, SuperAdmin is exempt.
12. Direct URL attempts: opening a conversation as a non-participant, a hidden community as a non-member, an admin page as a normal user: all denied.
13. Mobile viewport: composer, feed, thread, admin tables remain usable.
14. Keyboard only: compose a post with a mention, open the lightbox, close it, send a message.

---

## 15. Final report format

When done, reply with:
1. A summary of what was built per step (short).
2. The list of migration files and the exact order to apply them to production.
3. Any deviations from this document with reasons (also in DECISIONS.md).
4. Known limitations and suggested v1.1 items (likes first).
5. Environment variables or configuration that must be set, if any.
6. How to access the admin panel and the first manual checks the owner should run on the preview deployment.

Begin with Phase 0 discovery now.
