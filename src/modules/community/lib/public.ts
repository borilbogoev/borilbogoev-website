// Choices of the public face of a community (Landing blocks, public pages). Pure: safe to import in the browser.

export const PUBLIC_RANGES = { all: "Any time", "7": "Last 7 days", "30": "Last 30 days", "90": "Last 90 days", "365": "Last year" } as const;
export type PublicRange = keyof typeof PUBLIC_RANGES;
export const PUBLIC_SORTS = { new: "Newest first", top: "Most liked", discussed: "Most discussed" } as const;
export type PublicSort = keyof typeof PUBLIC_SORTS;
export const PUBLIC_PICKS = { pinned: "The pinned post (else the newest)", latest: "The newest post", top: "The most liked post", post: "A post I choose" } as const;
export type PublicPick = keyof typeof PUBLIC_PICKS;

/** Where a public post lives. */
export const publicPostHref = (communitySlug: string, postId: number) => `/c/${communitySlug}/${postId}`;
