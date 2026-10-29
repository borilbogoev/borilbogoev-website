# Community: manual QA

Test users: **A** (member), **B** (member), **M** (moderator), and the **SuperAdmin**. Use two browsers (or one normal and one private window) for the live checks. Run against the local database or a preview deployment, never production.

Setup: `docs/community/README.md` has the local database steps. In the control panel (`/admin/communities`) create a second community, add A, B and M to it, and make M a moderator of both communities.

1. Posting and images
   - [ ] A posts text only.
   - [ ] A posts text with 4 images.
   - [ ] A fifth image is rejected with a clear message.
   - [ ] An oversized file is rejected.
   - [ ] A non-image (a renamed text file) is rejected.
   - [ ] An image can get a description (alt text) before posting.
2. Live updates and mentions
   - [ ] B sees A's post appear through the "1 new post" pill within about 20 s, without reload and without the page jumping.
   - [ ] B comments and mentions A.
   - [ ] A gets exactly one notification and sees the comment appear live on the open post.
3. Edit and delete
   - [ ] A edits a comment and a post (an "edited" label shows).
   - [ ] A deletes a comment and a post.
   - [ ] Comment counts are correct on the post, the feed and the profile.
4. Mentions of strangers
   - [ ] A mentions a person who is not in the community: it falls back to plain text and nobody is notified.
   - [ ] A mentions themselves: plain text, no notification.
   - [ ] Editing a post to remove a mention removes the notification.
5. Reports and moderation
   - [ ] B reports A's post. A second report of the same post by B is blocked.
   - [ ] M hides the post from the moderation page. It disappears for B.
   - [ ] A still sees it, marked "Hidden by a moderator".
6. Bans
   - [ ] M bans B in the community. B can read but cannot post or comment there.
   - [ ] B can still post in the other community.
   - [ ] M unbans B.
7. Pause
   - [ ] SuperAdmin pauses posting in Settings. The banner shows, posting and commenting are blocked, messages still work.
   - [ ] SuperAdmin resumes. Posting works again within 30 seconds.
8. Archive and default
   - [ ] SuperAdmin archives a community. It becomes read only for everyone, including M.
   - [ ] SuperAdmin makes another community the default. Exactly one default remains.
9. Chat
   - [ ] A starts a chat with B twice, also from two tabs at once. There is one conversation.
   - [ ] B sees an unread dot, opens the thread, the dot clears.
   - [ ] B blocks A. A's next message fails with "You can't message this user".
   - [ ] B still sees the earlier messages.
   - [ ] B reports a message. The SuperAdmin sees the copied text in the queue.
10. Profiles
   - [ ] On A's own profile (Account > Community): Posts, Comments, Mentions, Conversations.
   - [ ] B's view of A (`/community/u/<id>`): Posts, Comments, Mentions only, plus Message and Block / Report.
   - [ ] The community filter changes the lists.
   - [ ] Content in a hidden community does not appear to a non-member.
   - [ ] Hidden and deleted content appears nowhere on a profile.
11. Rate limits
   - [ ] Exceeding the posts-per-hour limit gives a friendly message with the wait time (HTTP 429).
   - [ ] The SuperAdmin is not limited.
   - [ ] A suspended person (Suspensions page) can read, but cannot post, comment, message or mention, anywhere.
12. Direct URLs
   - [ ] A non-participant opening `/community/messages/<id>` gets "not found" (also the SuperAdmin).
   - [ ] A non-member opening a hidden community gets "not found".
   - [ ] A normal user opening `/admin/communities` is sent away; the admin API answers 403.
   - [ ] A person who does not moderate anything gets "not found" on `/community/moderate`.
13. Mobile (about 390 px wide)
   - [ ] Composer, feed, a thread and the admin tables are usable (tables scroll sideways).
15. Likes
   - [ ] A likes B's post and a comment: the count goes up once, a second click removes it.
   - [ ] Liking still works while posting is paused, and not in an archived community.

14. Keyboard only
   - [ ] Write a post, type `@`, pick a person with the arrow keys and Enter.
   - [ ] Open an image, close it with Escape.
   - [ ] Open a conversation and send a message with the keyboard.
   - [ ] Every control shows a visible focus ring.

16. Rich content (SuperAdmin)
   - [ ] Create categories (Categories page); published ones show as tabs after "All".
   - [ ] A member posts into a category and sees it only under that tab and "All".
   - [ ] Build a rich post with a hero, a form and a countdown; publish it. It shows as a dark snippet with chips and a picture.
   - [ ] Open it: the built page shows, with likes and comments below.
   - [ ] Pin it: it stays first under Default, New and Top, and in its own category. Unpin it.
   - [ ] Turn comments off: the composer is replaced by a note and the API refuses new comments. Turn them on.
   - [ ] Change a member's post category, edit a member's text post, ban its author from the post menu.
   - [ ] Set a category's sorting to Top and "All" to New; the feed follows without picking a sort. The sort menu still switches to Unread.
   - [ ] "Build a rich post" in the feed opens the builder on the right community and category.
   - [ ] A normal member sees none of: Build a rich post, Pin, Turn off comments, drafts.

17. Snippet looks and pictures (SuperAdmin)
   - [ ] In the builder, each of the five looks changes the preview and the feed (Ink, Paper, Signal, Tint, Frame).
   - [ ] With no featured media, the first image block becomes the snippet picture.
   - [ ] A post whose first visual is a video block shows its cover image or YouTube thumbnail with a play mark.
   - [ ] A featured picture wins over the blocks; a featured video link adds the play mark.
   - [ ] A post with no visual shows text only. On a phone the picture stacks under the text (above it for Tint).
