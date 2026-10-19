import { ApiAuthError, requireApiUser, type CurrentUser } from "./current";
import type { Permission } from "./roles";

const json = (body: object, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Blocks cross-site writes: browsers always send Origin on POST, PUT, PATCH and DELETE. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // non-browser clients cannot carry the session cookie from another site
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Wraps an admin route handler: checks the session and role, blocks cross-site writes and turns
 * thrown errors into JSON. Returns the handler's Response.
 */
export async function guarded(request: Request, permission: Permission | undefined, handler: (user: CurrentUser) => Promise<Response>): Promise<Response> {
  try {
    if (request.method !== "GET" && request.method !== "HEAD" && !sameOrigin(request)) return json({ error: "Cross-site request blocked." }, 403);
    const user = await requireApiUser(permission);
    return await handler(user);
  } catch (error) {
    if (error instanceof ApiAuthError) return json({ error: error.message }, error.status);
    console.error("[admin api]", error instanceof Error ? error.message : error);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}

export { json };
