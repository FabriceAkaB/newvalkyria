"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

/** Navigation de l'app famille (JP, 17 nov. 2026) : comme une application, une barre d'onglets en bas sur
 *  téléphone (Accueil, Points, Progression, Matchs, Plus) et des onglets en haut sur ordinateur. Mêmes adresses
 *  /compte/… qu'avant : les liens déjà envoyés par courriel continuent de marcher. */

export const FAMILY_TABS = [
  { href: "/compte/espace", label: "Accueil", icon: "🏠", main: true },
  { href: "/compte/points", label: "Points", icon: "⭐", main: true },
  { href: "/compte/progression", label: "Progression", icon: "📈", main: true },
  { href: "/compte/matchs", label: "Matchs", icon: "⚽", main: true },
  { href: "/compte/lab", label: "Valkyria Lab", icon: "🧪", main: false },
  { href: "/compte/factures", label: "Programmes et factures", icon: "🧾", main: false },
  { href: "/compte/enfants", label: "Mes enfants", icon: "👧", main: false },
  { href: "/compte/recommandations", label: "Recommandations", icon: "🤝", main: false },
  { href: "/compte/idees", label: "Idées", icon: "💡", main: false }
] as const;

function isActive(path: string, href: string) {
  return path === href || path.startsWith(`${href}/`) || (href === "/compte/progression" && path.startsWith("/compte/bulletin"));
}

export function FamilyAppNav() {
  const path = usePathname() ?? "";
  const router = useRouter();
  // Le menu « Plus » se referme tout seul quand on change de page.
  const [moreAt, setMoreAt] = useState<string | null>(null);
  const more = moreAt === path;
  const setMore = (v: boolean | ((b: boolean) => boolean)) => setMoreAt((typeof v === "function" ? v(more) : v) ? path : null);
  const moreActive = FAMILY_TABS.some((t) => !t.main && isActive(path, t.href));

  const logout = async () => {
    await fetch("/api/compte/connexion", { method: "DELETE" }).catch(() => null);
    router.push("/compte");
    router.refresh();
  };

  return (
    <>
      <nav aria-label="Espace famille" className="fam-tabs">
        {FAMILY_TABS.map((t) => (
          <Link key={t.href} href={t.href} className="fam-tab" data-active={isActive(path, t.href) || undefined} aria-current={isActive(path, t.href) ? "page" : undefined}>
            {t.label}
          </Link>
        ))}
        <button type="button" className="fam-tab fam-tab--quiet" onClick={logout}>Se déconnecter</button>
      </nav>

      <nav aria-label="Espace famille" className="fam-bottom">
        {FAMILY_TABS.filter((t) => t.main).map((t) => (
          <Link key={t.href} href={t.href} data-active={isActive(path, t.href) || undefined} aria-current={isActive(path, t.href) ? "page" : undefined}>
            <span aria-hidden>{t.icon}</span>
            {t.label}
          </Link>
        ))}
        <button type="button" data-active={moreActive || more || undefined} aria-expanded={more} onClick={() => setMore((v) => !v)}>
          <span aria-hidden>☰</span>
          Plus
        </button>
      </nav>

      {more ? (
        <div className="fam-sheet" role="dialog" aria-label="Plus" onClick={() => setMore(false)}>
          <div className="fam-sheet__panel" onClick={(e) => e.stopPropagation()}>
            {FAMILY_TABS.filter((t) => !t.main).map((t) => (
              <Link key={t.href} href={t.href} data-active={isActive(path, t.href) || undefined}>
                <span aria-hidden>{t.icon}</span>
                {t.label}
              </Link>
            ))}
            <button type="button" onClick={logout}>
              <span aria-hidden>↩</span>
              Se déconnecter
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
