import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ADMIN_COOKIE_NAME = "nv_admin";
export const ADMIN_COOKIE_VALUE = "ok";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "180180";

export function checkAdminPassword(password: string): boolean {
  return password === ADMIN_PASSWORD;
}

/** À appeler en haut de chaque Server Component/Route admin. Redirige vers /admin si non connecté. */
export async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies();
  if (cookieStore.get(ADMIN_COOKIE_NAME)?.value !== ADMIN_COOKIE_VALUE) {
    redirect("/admin");
  }
}

/** Vérifie l'auth dans les route handlers (ne peut pas utiliser redirect). */
export async function isAdminRequest(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_COOKIE_NAME)?.value === ADMIN_COOKIE_VALUE;
}
