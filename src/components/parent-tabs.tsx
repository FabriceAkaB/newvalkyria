"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** Onglets de l'espace parent (JP, 17 nov. 2026) : un portail à elles, ouvert depuis « Connexion » sur le site. */
export const PARENT_TABS = [
  { href: "/compte/espace", label: "Accueil" },
  { href: "/compte/progression", label: "Progression" },
  { href: "/compte/factures", label: "Programmes et factures" },
  { href: "/compte/lab", label: "Valkyria Lab" },
  { href: "/compte/matchs", label: "Matchs" },
  { href: "/compte/recommandations", label: "Recommandations" },
  { href: "/compte/idees", label: "Idées" }
] as const;

export function ParentTabs() {
  const path = usePathname() ?? "";
  const nav = useRef<HTMLElement | null>(null);
  // Sur téléphone, l'onglet ouvert défile dans la vue.
  useEffect(() => {
    nav.current?.querySelector<HTMLElement>("[data-active]")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [path]);
  const active = (href: string) => path === href || path.startsWith(`${href}/`) || (href === "/compte/progression" && path.startsWith("/compte/bulletin"));
  return (
    <nav ref={nav} aria-label="Espace parent" className="parent-tabs">
      {PARENT_TABS.map((t) => (
        <Link key={t.href} href={t.href} className="parent-tab" data-active={active(t.href) || undefined} aria-current={active(t.href) ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
