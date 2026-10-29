// The wrapper every Community route handler goes through: session, cross-site check, viewer, typed JSON errors.
import { guarded, json } from "@/modules/auth/guard";
import { CommunityError } from "./core";
import { ensureDefaultMembership, viewerFor, type Viewer } from "./context";

export type Handler = (viewer: Viewer) => Promise<Response | { status?: number; body: object }>;

export async function api(request: Request, handler: Handler, opts: { membership?: boolean } = {}): Promise<Response> {
  return guarded(request, undefined, async (user) => {
    try {
      const viewer = await viewerFor(user);
      if (opts.membership !== false) await ensureDefaultMembership(user.id);
      const out = await handler(viewer);
      if (out instanceof Response) return out;
      return json(out.body, out.status ?? 200);
    } catch (e) {
      if (e instanceof CommunityError) return json({ error: e.message, ...e.extra }, e.status);
      throw e;
    }
  });
}

export const ok = (body: object, status = 200) => ({ status, body });

/** The JSON body of a write, or an empty object. */
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const b = await request.json().catch(() => null);
  return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
}

export const param = async <T extends string>(ctx: { params: Promise<Record<T, string>> }, key: T) => (await ctx.params)[key];
export type Ctx<K extends string> = { params: Promise<Record<K, string>> };
