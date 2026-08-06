"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const SEASON_ETE_LINKS = [
  { href: "/admin/dashboard", label: "Vue d'ensemble" },
  { href: "/admin/inscriptions", label: "Inscriptions" },
  { href: "/admin/joueuses", label: "Joueuses" },
  { href: "/admin/capacite", label: "Capacité" },
  { href: "/admin/plages", label: "Plages" },
  { href: "/admin/essais", label: "Essais" },
  { href: "/admin/clubs", label: "Clubs" },
];

const SEASON_AUTOMNE_HIVER_LINKS = [
  { href: "/admin/saison/automne-hiver-2026", label: "Vue d'ensemble" },
  { href: "/admin/saison/automne-hiver-2026/inscriptions", label: "Inscriptions" },
  { href: "/admin/saison/automne-hiver-2026/essais", label: "Essais" },
  { href: "/admin/saison/automne-hiver-2026/capacite", label: "Capacité" },
  { href: "/admin/saison/automne-hiver-2026/horaire", label: "Horaire" },
  { href: "/admin/saison/automne-hiver-2026/solo", label: "Solo" },
];

const BOUTIQUE_LINKS = [
  { href: "/admin/boutique", label: "Produits" },
  { href: "/admin/boutique/commandes", label: "Commandes" },
];

const ESSAIS_LINKS = [
  { href: "/admin/essais-calendrier", label: "Calendrier" },
];

const REVENUS_LINKS = [
  { href: "/admin/revenus", label: "Vue d'ensemble" },
];

export function AdminTopbar() {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin");
  };

  return (
    <div className="admin-topbar-wrap">
      <div className="admin-topbar">
        <div>
          <p className="admin-topbar-brand">New Valkyria</p>
          <p className="admin-topbar-sub">Administration</p>
        </div>
        <button onClick={handleLogout} className="admin-logout-btn">
          Déconnexion
        </button>
      </div>

      {/* ── Saison Été 2026 (système actuel, inchangé) ── */}
      <div className="admin-season-subnav">
        <div className="admin-season-subnav-head">
          <span className="admin-season-badge">Saison</span>
          <span className="admin-season-subnav-label">Été 2026</span>
        </div>
        <nav className="admin-season-subnav-links">
          {SEASON_ETE_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              data-active={String(pathname.startsWith(link.href))}
              className="admin-nav-link"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* ── Saison Automne / Hiver 2026 (nouveau système) ── */}
      <div className="admin-season-subnav">
        <div className="admin-season-subnav-head">
          <span className="admin-season-badge admin-season-badge-new">Saison</span>
          <span className="admin-season-subnav-label">Automne / Hiver 2026</span>
        </div>
        <nav className="admin-season-subnav-links">
          {SEASON_AUTOMNE_HIVER_LINKS.map((link) => {
            const isActive =
              link.href === "/admin/saison/automne-hiver-2026"
                ? pathname === link.href
                : pathname.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href} data-active={String(isActive)} className="admin-nav-link">
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ── Boutique (indépendante des saisons) ── */}
      <div className="admin-season-subnav">
        <div className="admin-season-subnav-head">
          <span className="admin-season-badge admin-season-badge-shop">Boutique</span>
        </div>
        <nav className="admin-season-subnav-links">
          {BOUTIQUE_LINKS.map((link) => {
            const isActive = link.href === "/admin/boutique" ? pathname === link.href : pathname.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href} data-active={String(isActive)} className="admin-nav-link">
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ── Essais (toutes saisons confondues) ── */}
      <div className="admin-season-subnav">
        <div className="admin-season-subnav-head">
          <span className="admin-season-badge admin-season-badge-shop">Essais</span>
        </div>
        <nav className="admin-season-subnav-links">
          {ESSAIS_LINKS.map((link) => (
            <Link key={link.href} href={link.href} data-active={String(pathname.startsWith(link.href))} className="admin-nav-link">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* ── Revenus (toutes saisons et boutique confondues) ── */}
      <div className="admin-season-subnav">
        <div className="admin-season-subnav-head">
          <span className="admin-season-badge admin-season-badge-shop">Revenus</span>
        </div>
        <nav className="admin-season-subnav-links">
          {REVENUS_LINKS.map((link) => (
            <Link key={link.href} href={link.href} data-active={String(pathname.startsWith(link.href))} className="admin-nav-link">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
