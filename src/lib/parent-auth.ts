import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getParentSessionUserId } from "@/lib/parent-repo";

export const PARENT_COOKIE_NAME = "nv_parent_session";
export const PARENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

/** À appeler en haut d'un Server Component protégé. Redirige vers /compte si non connecté. */
export async function requireParentUserId(): Promise<string> {
  const userId = await getParentUserId();
  if (!userId) redirect("/compte");
  return userId;
}

/** Utilisable dans les route handlers (ne peut pas utiliser redirect) et les Server Components. */
export async function getParentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PARENT_COOKIE_NAME)?.value;
  if (!token) return null;
  return getParentSessionUserId(token);
}
