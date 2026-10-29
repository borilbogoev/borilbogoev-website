// Every word the Community module shows. No translation layer exists in the app yet, so the strings live here
// (Bulgarian and regional versions are planned): to translate, copy this object and switch on the locale.

export const t = {
  brand: "Community",
  nav: { feed: "Feed", communities: "Communities", messages: "Messages", notifications: "Notifications", moderate: "Moderation", profile: "Community" },
  eyebrow: { feed: "Community", communities: "Communities", messages: "Messages", notifications: "Notifications", post: "Post", profile: "Profile", moderate: "Moderation" },
  action: {
    post: "Post", posting: "Posting...", save: "Save", saving: "Saving...", cancel: "Cancel", edit: "Edit", delete: "Delete", report: "Report", hide: "Hide", unhide: "Show again",
    join: "Join", leave: "Leave", comment: "Comment", reply: "Reply", send: "Send", sending: "Sending...", retry: "Try again", close: "Close", message: "Message", block: "Block", unblock: "Unblock",
    addImages: "Add images", removeImage: "Remove image", markAllRead: "Mark all as read", loadMore: "Load more", more: "More", openCommunity: "Open",
  },
  like: { like: "Like", liked: "Liked", count: (n: number) => (n === 1 ? "1 like" : `${n} likes`) },
  composer: { placeholder: "Write something. Type @ to mention a member.", commentPlaceholder: "Write a comment. Type @ to mention a member.", messagePlaceholder: "Write a message", altPlaceholder: "Describe this image (optional)", count: (n: number, max: number) => `${n} / ${max}` },
  post: { edited: "edited", deleted: "This post was deleted.", hidden: "Hidden by a moderator", comments: (n: number) => (n === 1 ? "1 comment" : `${n} comments`), confirmDelete: "Delete this post? This cannot be undone." },
  comment: { deleted: "This comment was deleted.", hidden: "Hidden by a moderator", none: "No comments yet. Start the conversation.", confirmDelete: "Delete this comment?" },
  feed: { emptyTitle: "No posts yet", emptyText: "Be the first to post in this community.", end: "You have reached the end.", newPosts: (n: number) => (n === 1 ? "1 new post" : `${n} new posts`), newComments: (n: number) => (n === 1 ? "1 new comment" : `${n} new comments`) },
  community: {
    members: (n: number) => (n === 1 ? "1 member" : `${n} members`),
    archivedBanner: "This community is archived. You can read it, but no one can post or comment.",
    pausedBanner: "Posting is paused for now. You can read everything and still send messages.",
    bannedBanner: "You are banned from posting in this community. You can still read it.",
    suspendedBanner: "Your Community access is read only. Contact the site owner if you think this is a mistake.",
    joinToPost: "Join this community to post and comment.",
    closedToPost: "This community is closed. An admin adds new members.",
    listEmpty: "No communities yet.",
    switcher: "Switch community",
    defaultBadge: "Default",
    closed: "Invite only",
    archived: "Archived",
    hidden: "Hidden",
  },
  mention: { listLabel: "Mention suggestions", none: "No members found", hint: "Type @ and a name" },
  notifications: {
    empty: "Nothing new.", emptyText: "You will see mentions and comments on your posts here.", bell: "Notifications", unread: (n: number) => (n === 1 ? "1 unread notification" : `${n} unread notifications`),
    mention: (name: string) => `${name} mentioned you`, comment: (name: string, n: number) => (n > 1 ? `${n} new comments on your post` : `${name} commented on your post`),
  },
  chat: {
    title: "Messages", empty: "No conversations yet", emptyText: "Open a profile and choose Message to start one.", noMessages: "No messages yet. Say hello.", deleted: "Message deleted", you: "You",
    blocked: "You can't message this user", self: "You can't message yourself", unread: "Unread messages", back: "All conversations",
  },
  report: {
    title: "Report", intro: "Tell the moderators what is wrong. Reports are private.", reason: "Reason", details: "Details (optional)", submit: "Send report", sent: "Report sent. Thank you.", again: "You already reported this.",
    reasons: { spam: "Spam", abuse: "Abuse or harassment", inappropriate: "Inappropriate content", other: "Something else" },
  },
  safety: { blocked: "User blocked.", unblocked: "User unblocked.", blockConfirm: "Block this user? They will not be able to message you or notify you." },
  profile: {
    tabs: { posts: "Posts", comments: "Comments", mentions: "Mentions", conversations: "Conversations" },
    allCommunities: "All communities", emptyPosts: "No posts yet.", emptyComments: "No comments yet.", emptyMentions: "No mentions yet.", emptyConversations: "No conversations yet.",
    mentionedBy: (name: string) => `Mentioned by ${name}`, inPost: "On the post", filter: "Community",
  },
  state: { loading: "Loading", error: "Something went wrong.", forbidden: "You can't do that.", notFound: "Not found", ago: { now: "just now" } },
  errors: {
    signIn: "Please sign in to use Community.", forbidden: "You can't do that.", notFound: "Not found.", invalid: "Check what you entered and try again.", rate: (s: number) => `You are doing that too fast. Try again in ${s} seconds.`,
    bodyOrImage: "Write something or add an image.", tooLong: (n: number) => `That is too long. The limit is ${n} characters.`, imageType: "Use a JPG, PNG, WebP or GIF image.", imageSize: (mb: number) => `Each image can be up to ${mb} MB.`, imageCount: (n: number) => `You can add up to ${n} images.`,
    generic: "Something went wrong. Please try again.", reservedSlug: "That address is reserved.", slugTaken: "That address is taken.",
  },
  a11y: { skip: "Skip to content", image: "Image", lightbox: "Image viewer", prev: "Previous image", next: "Next image", menu: "Post actions" },
} as const;

export type Strings = typeof t;
