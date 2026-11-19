"use client";

import { FlaskConical, Globe, Handshake, House, LogOut, Menu, MessageSquareHeart, Receipt, Star, TrendingUp, Users, Video, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

/** Navigation de l'app famille (JP, 17 nov. 2026) : comme une application, une barre d'onglets en bas sur
 *  téléphone (Accueil, Points, Progression, Matchs, Plus) et des onglets en haut sur ordinateur. Mêmes adresses
 *  /compte/… qu'avant : les liens déjà envoyés par courriel continuent de marcher. */

export const FAMILY_TABS: { href: string; label: string; icon: LucideIcon; main: boolean }[] = [
  { href: "/compte/espace", label: "Accueil", icon: House, main: true },
  { href: "/compte/points", label: "Points", icon: Star, main: true },
  { href: "/compte/progression", label: "Progression", icon: TrendingUp, main: true },
  { href: "/compte/matchs", label: "Matchs", icon: Video, main: true },
  { href: "/compte/lab", label: "Valkyria Lab", icon: FlaskConical, main: false },
  { href: "/compte/factures", label: "Programmes et factures", icon: Receipt, main: false },
  { href: "/compte/enfants", label: "Mes enfants", icon: Users, main: false },
  { href: "/compte/recommandations", label: "Recommandations", icon: Handshake, main: false },
  { href: "/compte/idees", label: "Boîte à suggestions", icon: MessageSquareHeart, main: false }
];

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
            <t.icon strokeWidth={1.75} aria-hidden />
            {t.label}
          </Link>
        ))}
        <button type="button" className="fam-tab fam-tab--quiet" onClick={logout}>Se déconnecter</button>
      </nav>

      <nav aria-label="Espace famille" className="fam-bottom">
        {FAMILY_TABS.filter((t) => t.main).map((t) => (
          <Link key={t.href} href={t.href} data-active={isActive(path, t.href) || undefined} aria-current={isActive(path, t.href) ? "page" : undefined}>
            <t.icon strokeWidth={1.75} aria-hidden />
            {t.label}
          </Link>
        ))}
        <button type="button" data-active={moreActive || more || undefined} aria-expanded={more} onClick={() => setMore((v) => !v)}>
          <Menu strokeWidth={1.75} aria-hidden />
          Plus
        </button>
      </nav>

      {more ? (
        <div className="fam-sheet" role="dialog" aria-label="Plus" onClick={() => setMore(false)}>
          <div className="fam-sheet__panel" onClick={(e) => e.stopPropagation()}>
            {FAMILY_TABS.filter((t) => !t.main).map((t) => (
              <Link key={t.href} href={t.href} data-active={isActive(path, t.href) || undefined}>
                <t.icon strokeWidth={1.75} aria-hidden />
                {t.label}
              </Link>
            ))}
            <Link href="/">
              <Globe strokeWidth={1.75} aria-hidden />
              Site de l&apos;académie
            </Link>
            <button type="button" onClick={logout}>
              <LogOut strokeWidth={1.75} aria-hidden />
              Se déconnecter
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
