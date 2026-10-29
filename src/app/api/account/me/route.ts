import { getCurrentUser } from "@/modules/auth/current";
import { json } from "@/modules/auth/guard";
import { getProfile } from "@/modules/account/lib/profile";
import { canUseAdmin } from "@/modules/auth/roles";

export const runtime = "nodejs";

// Who is signed in, for the account bar on the public site. Public pages stay static: they ask this after they load.
export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return json({ signedIn: false }, 200);
  const profile = await getProfile(user.id).catch(() => null);
  return json({ signedIn: true, name: user.name || user.email, avatarUrl: profile?.avatarUrl ?? "", admin: canUseAdmin(user.role) }, 200);
}
