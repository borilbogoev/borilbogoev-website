import { NextResponse } from "next/server";
import { toId } from "@/modules/community/server/core";
import { listPublicComments } from "@/modules/community/server/public";

export const runtime = "nodejs";

// Comments of a public post, readable by anyone. `cursor` (next page) and `after` (what is new) are the same kind of value.
// Cached for a few seconds at the edge, so a busy post does not reach the database on every poll.
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = toId((await ctx.params).id);
  const url = new URL(request.url);
  const cursor = url.searchParams.get("after") ?? url.searchParams.get("cursor");
  const res = id ? await listPublicComments(id, cursor) : null;
  if (!res) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(res, { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" } });
}
