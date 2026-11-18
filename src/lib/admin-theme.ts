import { cookies } from "next/headers";

/** Le mode choisi (jour par défaut), lu dans le cookie posé par AdminThemeToggle. */
export async function getAdminTheme(): Promise<"light" | "dark"> {
  return (await cookies()).get("nv_admin_theme")?.value === "dark" ? "dark" : "light";
}
