"use client";

import { Moon, Sun } from "lucide-react";

/** Mode jour / nuit de l'admin et du portail des éducateurs (JP, 17 nov. 2026). Retenu un an dans le cookie
 *  nv_admin_theme, lu par le serveur (data-theme sur .admin-shell) : la page s'ouvre directement dans le bon mode.
 *  Sans état React : le bouton actif se dessine en CSS selon data-theme, donc rien à synchroniser. */
export const ADMIN_THEME_COOKIE = "nv_admin_theme";

function pick(t: "light" | "dark") {
  document.querySelectorAll(".admin-shell").forEach((el) => el.setAttribute("data-theme", t));
  document.cookie = `${ADMIN_THEME_COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`;
}

export function AdminThemeToggle({ compact = false }: { compact?: boolean }) {
  return (
    <div className="adm-theme" data-compact={compact || undefined} role="group" aria-label="Apparence">
      <button type="button" data-t="light" onClick={() => pick("light")} aria-label="Mode jour">
        <Sun size={14} strokeWidth={1.75} aria-hidden />
        {compact ? null : " Jour"}
      </button>
      <button type="button" data-t="dark" onClick={() => pick("dark")} aria-label="Mode nuit">
        <Moon size={14} strokeWidth={1.75} aria-hidden />
        {compact ? null : " Nuit"}
      </button>
    </div>
  );
}
