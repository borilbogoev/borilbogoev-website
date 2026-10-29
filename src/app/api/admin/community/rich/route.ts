import { api, ok, readBody } from "@/modules/community/server/api";
import { createRich } from "@/modules/community/server/rich";

export const runtime = "nodejs";

// A new draft rich post; the builder opens on the returned id.
export async function POST(request: Request) {
  return api(request, async (viewer) => ok({ id: await createRich(viewer, await readBody(request)) }, 201), { membership: false });
}
