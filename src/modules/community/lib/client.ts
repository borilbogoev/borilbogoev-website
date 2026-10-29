// The browser's data layer. Components call these functions, never fetch directly, so polling can be swapped for a
// managed realtime service later without touching a component.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryAfter?: number,
  ) {
    super(message);
  }
}

export async function request<T>(method: string, url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    signal,
    headers: body instanceof FormData || body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; retryAfter?: number };
  if (!res.ok) throw new ApiError(res.status, data.error || (res.status === 401 ? "Please sign in again." : "Something went wrong. Please try again."), data.retryAfter);
  return data as T;
}

export const get = <T>(url: string, signal?: AbortSignal) => request<T>("GET", url, undefined, signal);
export const post = <T>(url: string, body?: unknown) => request<T>("POST", url, body ?? {});
export const patch = <T>(url: string, body: unknown) => request<T>("PATCH", url, body);
export const del = <T>(url: string) => request<T>("DELETE", url);

/** One id per submit, so a double click or a retry never creates the item twice. */
export const newRequestId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export const message = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong. Please try again.");

// ---- typed shapes returned by the API (see server/*.ts) ----
export type Person = { id: string; name: string; username: string; avatarUrl: string };
export type People = Record<string, Person>;
export type Media = { id: number; url: string; width: number; height: number; alt: string };
export type Post = {
  id: number; communityId: number; author: Person; body: string; createdAt: string; editedAt: string | null; commentCount: number; status: "published" | "hidden_by_mod";
  media: Media[]; cursor: string; mine: boolean; canEdit: boolean; canDelete: boolean; canModerate: boolean;
};
export type Comment = {
  id: number; postId: number; author: Person; body: string; createdAt: string; editedAt: string | null; status: "published" | "hidden_by_mod"; cursor: string;
  mine: boolean; canEdit: boolean; canDelete: boolean; canModerate: boolean;
};
export type Message = { id: number; conversationId: number; senderId: string; body: string; deleted: boolean; createdAt: string; cursor: string; mine: boolean };
export type Page<T> = { items: T[]; people: People; nextCursor: string | null };

export const api = {
  feed: (slug: string, q: { cursor?: string | null; after?: string | null }, signal?: AbortSignal) => {
    const p = new URLSearchParams();
    if (q.cursor) p.set("cursor", q.cursor);
    if (q.after) p.set("after", q.after);
    return get<Page<Post>>(`/api/community/${slug}/posts?${p}`, signal);
  },
  feedUpdates: (slug: string, after: string, signal?: AbortSignal) => get<{ newCount: number; newestCursor: string | null }>(`/api/community/${slug}/posts/updates?after=${encodeURIComponent(after)}`, signal),
  comments: (postId: number, cursor?: string | null) => get<Page<Comment>>(`/api/community/posts/${postId}/comments${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`),
  commentUpdates: (postId: number, after: string | null, signal?: AbortSignal) => get<{ items: Comment[]; people: People; commentCount: number }>(`/api/community/posts/${postId}/comments/updates${after ? `?after=${encodeURIComponent(after)}` : ""}`, signal),
  unreadNotifications: (signal?: AbortSignal) => get<{ count: number }>("/api/community/notifications/unread-count", signal),
  unreadConversations: (signal?: AbortSignal) => get<{ count: number }>("/api/community/conversations/unread-count", signal),
};
