// Limits and vocabularies shared by the server, the API and the screens. Pure: safe to import anywhere.

export const LIMITS = {
  postBody: 5000,
  commentBody: 2000,
  messageBody: 4000,
  reportDetails: 500,
  mentionsPerItem: 10,
  postPage: 20,
  commentPage: 30,
  messagePage: 30,
  notificationPage: 20,
  suggest: 8,
  maxImages: 4,
} as const;

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export const RESERVED_SLUGS = ["communities", "messages", "notifications", "post", "new", "admin", "u", "moderate"] as const;

export const VISIBILITY = ["listed", "hidden"] as const;
export const JOIN_MODES = ["open", "closed"] as const;
export const COMMUNITY_STATUS = ["active", "archived"] as const;
export const CONTENT_STATUS = ["published", "hidden_by_mod", "deleted"] as const;
export const REPORT_TARGETS = ["post", "comment", "message", "user"] as const;
export const REPORT_REASONS = ["spam", "abuse", "inappropriate", "other"] as const;
export const REPORT_STATUS = ["open", "resolved", "dismissed"] as const;
export const REPORT_ACTIONS = ["dismiss", "hide", "delete", "ban", "suspend"] as const;

export type Visibility = (typeof VISIBILITY)[number];
export type JoinMode = (typeof JOIN_MODES)[number];
export type CommunityStatus = (typeof COMMUNITY_STATUS)[number];
export type ContentStatus = (typeof CONTENT_STATUS)[number];
export type ReportTarget = (typeof REPORT_TARGETS)[number];
export type ReportReason = (typeof REPORT_REASONS)[number];
export type ReportAction = (typeof REPORT_ACTIONS)[number];

/** Polling intervals in milliseconds (section 7 of the spec). */
export const POLL = { feed: 15_000, comments: 10_000, bell: 30_000, unread: 30_000, thread: 10_000, conversations: 30_000 } as const;
