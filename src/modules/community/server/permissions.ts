// The one place that decides who may do what in Community. Pure functions: no database, no session.
// Every route handler and server action calls these with data it loaded itself; hiding a button is never the check.

export type Actor = { id: string; superAdmin: boolean; suspended: boolean };
export type MemberState = { role: "member" | "moderator"; status: "active" | "banned" } | null;
export type CommunityState = { status: "active" | "archived"; visibility: "listed" | "hidden"; joinMode: "open" | "closed"; access?: "private" | "public" };
export type GlobalState = { postingPaused: boolean };

export type Decision = { ok: true } | { ok: false; code: "signin" | "forbidden" | "not_found" | "read_only" | "paused" | "archived" | "banned" | "suspended" | "not_member" | "closed"; message: string };

const yes: Decision = { ok: true };
const no = (code: Extract<Decision, { ok: false }>["code"], message: string): Decision => ({ ok: false, code, message });

type A = Actor | null;

const isMember = (m: MemberState) => !!m;
const isActiveMember = (m: MemberState) => m?.status === "active";
export const isModerator = (a: A, m: MemberState) => !!a && (a.superAdmin || (m?.role === "moderator" && m.status === "active"));

/** A public community: anyone reads its published rich posts; only the SuperAdmin posts; signed-in people comment. */
export const isPublic = (c: Pick<CommunityState, "access">) => c.access === "public";

/** Reading the public face of a community (its rich posts and their comments). No account needed. */
export function canViewPublic(c: Pick<CommunityState, "access">): Decision {
  return isPublic(c) ? yes : no("not_found", "Not found.");
}

/** Seeing that a community exists and reading it. Hidden communities answer "not found" to outsiders. A public community is open to every signed-in person. */
export function canView(a: A, m: MemberState, c: CommunityState): Decision {
  if (!a) return no("signin", "Please sign in.");
  if (a.superAdmin || isPublic(c)) return yes;
  if (c.visibility === "hidden" && !isMember(m)) return no("not_found", "Not found.");
  return yes;
}

export function canJoin(a: A, m: MemberState, c: CommunityState): Decision {
  const v = canView(a, m, c);
  if (!v.ok) return v;
  if (isMember(m)) return no("forbidden", "You are already a member.");
  if (a!.suspended && !a!.superAdmin) return no("suspended", "Your Community access is read only.");
  if (c.status === "archived") return no("archived", "This community is archived.");
  if (c.joinMode === "closed" && !a!.superAdmin) return no("closed", "This community is closed.");
  return yes;
}

/** Shared gate for every write that adds or changes content inside a community. */
function canWrite(a: A, m: MemberState, c: CommunityState, g: GlobalState, opts: { paused: boolean }): Decision {
  const v = canView(a, m, c);
  if (!v.ok) return v;
  if (a!.suspended) return no("suspended", "Your Community access is read only.");
  if (c.status === "archived") return no("archived", "This community is archived.");
  if (opts.paused && g.postingPaused) return no("paused", "Posting is paused.");
  if (a!.superAdmin) return yes;
  if (!isMember(m)) return no("not_member", "Join this community first.");
  if (m!.status === "banned") return no("banned", "You are banned from this community.");
  return yes;
}

/** Posting: members of a private community. In a public community only the SuperAdmin publishes. */
export function canPost(a: A, m: MemberState, c: CommunityState, g: GlobalState): Decision {
  if (a && !a.superAdmin && isPublic(c)) return no("forbidden", "Only the author publishes in this community. You can comment on posts.");
  return canWrite(a, m, c, g, { paused: true });
}

/**
 * Commenting and liking. Private communities: members only. Public communities: any signed-in person who is not banned; an open
 * community adds them as a member with their first comment, a closed one needs an existing membership.
 */
function canInteract(a: A, m: MemberState, c: CommunityState, g: GlobalState, paused: boolean): Decision {
  if (!isPublic(c)) return canWrite(a, m, c, g, { paused });
  if (!a) return no("signin", "Sign in to comment.");
  if (a.suspended) return no("suspended", "Your Community access is read only.");
  if (c.status === "archived") return no("archived", "This community is archived.");
  if (paused && g.postingPaused) return no("paused", "Posting is paused.");
  if (a.superAdmin) return yes;
  if (m?.status === "banned") return no("banned", "You are banned from this community.");
  if (!m && c.joinMode === "closed") return no("not_member", "This community is closed.");
  return yes;
}
export const canComment = (a: A, m: MemberState, c: CommunityState, g: GlobalState) => canInteract(a, m, c, g, true);

/** Liking: the same rules as commenting, but allowed while posting is paused. */
export const canReact = (a: A, m: MemberState, c: CommunityState, g: GlobalState) => canInteract(a, m, c, g, false);

/** Own posts and comments: editing or deleting. Authors only; the same read-only rules apply. */
export function canEditOwn(a: A, m: MemberState, c: CommunityState, g: GlobalState, authorId: string): Decision {
  if (!a) return no("signin", "Please sign in.");
  if (a.id !== authorId) return no("forbidden", "You can't do that.");
  return canWrite(a, m, c, g, { paused: false });
}

/** Pinning, turning comments off, building rich posts, editing any member's post: SuperAdmin only. Everything here still respects archived communities for the writes that change content. */
export function canPin(a: A): Decision {
  return a?.superAdmin ? yes : no("forbidden", "You can't do that.");
}
export const canLockComments = canPin;
export const canBuildRich = canPin;
export const canEditAnyPost = canPin;

/** Moving a post to another category: its author, or the SuperAdmin. */
export function canChangeCategory(a: A, m: MemberState, c: CommunityState, g: GlobalState, authorId: string): Decision {
  if (a?.superAdmin) return yes;
  return canEditOwn(a, m, c, g, authorId);
}

/** Hiding or deleting someone else's post or comment. Archived communities are read only, except for the SuperAdmin. */
export function canModerateContent(a: A, m: MemberState, c: CommunityState): Decision {
  if (!a) return no("signin", "Please sign in.");
  if (a.superAdmin) return yes;
  if (!isModerator(a, m)) return no("forbidden", "You can't do that.");
  if (c.status === "archived") return no("archived", "This community is archived.");
  return yes;
}

export const canBan = canModerateContent;

export function canAssignModerators(a: A): Decision {
  return a?.superAdmin ? yes : no("forbidden", "You can't do that.");
}
export const canManageCommunities = canAssignModerators;
export const canManageGlobal = canAssignModerators;

/** Reports of a community: its moderators, or everyone's for the SuperAdmin. */
export function canSeeReports(a: A, m: MemberState): Decision {
  return a && isModerator(a, m) ? yes : no("forbidden", "You can't do that.");
}

/** Reporting needs to be able to see the thing. Banned members may still report. */
export function canReport(a: A, m: MemberState, c: CommunityState | null): Decision {
  if (!a) return no("signin", "Please sign in.");
  if (a.suspended && !a.superAdmin) return no("suspended", "Your Community access is read only.");
  return c ? canView(a, m, c) : yes;
}

/** Direct messages work platform wide, also while posting is paused. */
export function canDirectMessage(a: A, target: { id: string }, rel: { blockedByTarget: boolean }): Decision {
  if (!a) return no("signin", "Please sign in.");
  if (a.id === target.id) return no("forbidden", "You can't message yourself.");
  if (a.suspended) return no("suspended", "Your Community access is read only.");
  if (rel.blockedByTarget) return no("forbidden", "You can't message this user.");
  return yes;
}

export function canBlock(a: A, targetId: string): Decision {
  if (!a) return no("signin", "Please sign in.");
  return a.id === targetId ? no("forbidden", "You can't block yourself.") : yes;
}

/** Leaving: members only, never the default community. */
export function canLeave(m: MemberState, c: { isDefault: boolean }): Decision {
  if (!m) return no("not_member", "You are not a member.");
  if (c.isDefault) return no("forbidden", "You can't leave the default community.");
  return yes;
}

export const memberOnly = isActiveMember;
