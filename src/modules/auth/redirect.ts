/** Only allow redirects to paths inside this app (blocks open redirects). Defaults to the admin home. */
export function safeNext(next: string | null | undefined, fallback = "/admin") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
