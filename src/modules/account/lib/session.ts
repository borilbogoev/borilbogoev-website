import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/modules/auth/current";

/** For the pages of /account: any signed-in, active user. Everyone else goes to the sign-in page. */
export async function requireAccountUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/account/login");
  return user;
}
