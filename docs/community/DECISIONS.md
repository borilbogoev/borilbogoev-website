# Community: decisions

One line each: decision, reason.

- SuperAdmin is the `owner` role, through a new permission `community.manage` granted to owner only. The spec says "SuperAdmin" and the roles file labels owner that way.
- Ids are `serial` integers for module tables, uuid for users. Matches School and Forms.
- Atomic multi-row writes use single-statement CTEs, not `db.transaction`. The Neon HTTP driver has no interactive transactions.
- `created_at` is always set from the app clock (millisecond precision), never `now()`. Cursors are `<iso>_<id>` and ISO strings only carry milliseconds; microsecond defaults would repeat or skip rows at page edges.
- Idempotency uses a `request_id` column with a unique index per author on posts, comments and messages (permanent, stricter than 5 minutes, simpler than a cleanup job).
- Images are uploaded through the server (as avatars are), re-encoded by `sharp` to WebP (EXIF stripped), and stored under `images/community/` so the existing public media route serves them. Each upload creates a `community_post_media` row with `post_id` null and a new `uploader_id`; creating a post attaches the caller's own pending rows. Unattached rows are an orphan cleanup follow-up.
- `GET .../uploads/image` token flow from the spec is replaced by server upload, which is this repo's pattern and lets the server validate type by content, size and dimensions.
- The profile is the account area. Community adds an `/account/community` page (the owner view, four sub-tabs through `?section=`) and `/community/u/[userId]` for other people (three sub-tabs, Message, Block / Report). Both render the same component.
- Moderators may be any role (often students), who cannot open `/admin`. The reduced moderator view (Members, Reports) is `/community/moderate`; the full control panel is `/admin/communities` (owner).
- Mentions: a plain textarea shows `@Name`; picked people are kept beside it and the stored token `@[Name](user:<id>)` is built on submit. No contenteditable, no dependency. Editing converts tokens back to `@Name` and re-picks them.
- Message mentions create `community_mentions` rows (communityId null) but no notification, as the spec says no notification rows for chat.
- Notification for a comment on your post is one row per comment, collapsed by post in the UI.
- Member counts use a count query with a 30 s in-memory cache per instance.
- Settings cache: in-memory 30 s per server instance; writes clear the cache of the instance that handled them.
- Rate limits count rows in the window from the content table itself (posts per hour, comments per hour, messages per minute). Hidden or deleted rows still count, so deleting does not reset the limit.
- Reported message: the body is stored in `message_snapshot` at report time; nobody else can read messages.
- A banned member can read but not post, comment, edit or delete in that community.
- Hiding a post removes it from lists for others; the author still sees it in their own feed marked "Hidden by a moderator".
- Soft-deleted posts and comments are never returned in lists. A deleted post's comments are hidden with it.
- Strings: no translation layer exists, so one `strings.ts` file.
