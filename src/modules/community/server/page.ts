// Helpers for pages (server components): the signed-in viewer, and "not found" for anything the viewer may not see.
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/current";
import { CommunityError } from "./core";
import { ensureDefaultMembership, scopeBySlug, scopeById, viewerFor, type Scope, type Viewer } from "./context";

export const requireViewer = cache(async (): Promise<Viewer> => {
  const user = await getCurrentUser();
  if (!user) redirect("/account/login");
  await ensureDefaultMembership(user.id);
  return viewerFor(user);
});

async function orNotFound(p: Promise<Scope>): Promise<Scope> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof CommunityError) notFound();
    throw e;
  }
}
export const pageScopeBySlug = (v: Viewer, slug: string) => orNotFound(scopeBySlug(v, slug));
export const pageScopeById = (v: Viewer, id: number) => orNotFound(scopeById(v, id));

export const me = (v: Viewer) => ({ id: v.user.id, name: v.user.name || v.user.email.split("@")[0], username: "", avatarUrl: "" });
