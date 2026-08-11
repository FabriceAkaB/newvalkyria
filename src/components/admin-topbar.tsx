"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type IconName = "home" | "list" | "users" | "gauge" | "grid" | "flask" | "shield" | "tag" | "bag" | "calendar" | "chart" | "user";

function Icon({ name }: { name: IconName }) {
  const common = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "home":
      return <svg {...common}><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9a1 1 0 0 0 1 1H10v-5.5h4V20h3.5a1 1 0 0 0 1-1v-9" /></svg>;
    case "list":
      return <svg {...common}><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></svg>;
    case "users":
      return <svg {...common}><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><path d="M16.5 4.5A3.2 3.2 0 0 1 17 11" /><path d="M21.5 20c0-3-2-5.2-5-5.8" /></svg>;
    case "gauge":
      return <svg {...common}><circle cx="12" cy="13" r="8" /><path d="M12 13 15.5 9" /><path d="M8.5 5.5 9.5 7M15.5 5.5 14.5 7" /></svg>;
    case "grid":
      return <svg {...common}><rect x="3.5" y="3.5" width="7" height="7" rx="1" /><rect x="13.5" y="3.5" width="7" height="7" rx="1" /><rect x="3.5" y="13.5" width="7" height="7" rx="1" /><rect x="13.5" y="13.5" width="7" height="7" rx="1" /></svg>;
    case "flask":
      return <svg {...common}><path d="M9.5 3h5" /><path d="M10.5 3v6l-5.5 9a1.5 1.5 0 0 0 1.3 2.3h11.4a1.5 1.5 0 0 0 1.3-2.3L13.5 9V3" /><path d="M7.5 15h9" /></svg>;
    case "shield":
      return <svg {...common}><path d="M12 3 5 6v6c0 4.2 3 7.5 7 9 4-1.5 7-4.8 7-9V6z" /><path d="m9.5 12 1.8 1.8L15 10" /></svg>;
    case "tag":
      return <svg {...common}><path d="M12.5 3.5H6a1 1 0 0 0-1 1v6.5a1 1 0 0 0 .3.7l9.5 9.5a1 1 0 0 0 1.4 0l6.5-6.5a1 1 0 0 0 0-1.4l-9.5-9.5a1 1 0 0 0-.7-.3Z" /><circle cx="9" cy="9" r="1.3" /></svg>;
    case "bag":
      return <svg {...common}><path d="M6 8h12l1 12.5a1 1 0 0 1-1 1.1H6a1 1 0 0 1-1-1.1L6 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>;
    case "calendar":
      return <svg {...common}><rect x="3.5" y="5" width="17" height="15.5" rx="1.5" /><path d="M3.5 9.5h17" /><path d="M8 3v4M16 3v4" /><path d="m8.5 14 2 2 4-4" /></svg>;
    case "chart":
      return <svg {...common}><path d="M4 20V10M11 20V4M18 20v-7" /><path d="M2.5 20h19" /></svg>;
    case "user":
      return <svg {...common}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" /></svg>;
  }
}

const SEASON_ETE_LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin/dashboard", label: "Vue d'ensemble", icon: "home" },
  { href: "/admin/inscriptions", label: "Inscriptions", icon: "list" },
  { href: "/admin/joueuses", label: "Joueuses", icon: "users" },
  { href: "/admin/capacite", label: "Capacité", icon: "gauge" },
  { href: "/admin/plages", label: "Plages", icon: "grid" },
  { href: "/admin/essais", label: "Essais", icon: "flask" },
  { href: "/admin/clubs", label: "Clubs", icon: "shield" },
];

const SEASON_AUTOMNE_HIVER_LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin/saison/automne-hiver-2026", label: "Vue d'ensemble", icon: "home" },
  { href: "/admin/saison/automne-hiver-2026/inscriptions", label: "Inscriptions", icon: "list" },
  { href: "/admin/saison/automne-hiver-2026/essais", label: "Essais", icon: "flask" },
  { href: "/admin/saison/automne-hiver-2026/capacite", label: "Capacité", icon: "gauge" },
  { href: "/admin/saison/automne-hiver-2026/horaire", label: "Horaire", icon: "grid" },
  { href: "/admin/saison/automne-hiver-2026/solo", label: "Solo", icon: "user" },
];

const BOUTIQUE_LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin/boutique", label: "Produits", icon: "tag" },
  { href: "/admin/boutique/commandes", label: "Commandes", icon: "bag" },
];

const ESSAIS_LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin/essais-calendrier", label: "Calendrier", icon: "calendar" },
];

const UNIFORMES_LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin/uniformes", label: "Tableau de bord", icon: "gauge" },
  { href: "/admin/uniformes/a-remettre", label: "À remettre", icon: "bag" },
  { href: "/admin/uniformes/aujourdhui", label: "Aujourd'hui", icon: "calendar" },
  { href: "/admin/uniformes/problemes", label: "Problèmes", icon: "flask" },
];

const REVENUS_LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin/revenus", label: "Vue d'ensemble", icon: "chart" },
  { href: "/admin/revenus/paiements", label: "Paiements échelonnés", icon: "user" },
  { href: "/admin/revenus/tresorerie", label: "Trésorerie", icon: "gauge" },
  { href: "/admin/revenus/budget", label: "Budget annuel", icon: "chart" },
];

const ENTRAINEURS_LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin/entraineurs", label: "Entraîneurs", icon: "users" },
  { href: "/admin/entraineurs/activites", label: "Activités", icon: "calendar" },
  { href: "/admin/entraineurs/paie", label: "Paie", icon: "chart" },
  { href: "/admin/entraineurs/statistiques", label: "Statistiques", icon: "gauge" },
];

interface Group {
  label: string;
  dotColor: string;
  links: { href: string; label: string; icon: IconName }[];
  /** Masqué pour les rôles autres qu'"admin" (ex. Gérante) — sections
   *  financières et sensibles. */
  adminOnly?: boolean;
}

const GROUPS: Group[] = [
  { label: "Été 2026", dotColor: "#c8aae0", links: SEASON_ETE_LINKS },
  { label: "Automne / Hiver 2026", dotColor: "#f0c878", links: SEASON_AUTOMNE_HIVER_LINKS },
  { label: "Boutique", dotColor: "#8fce9f", links: BOUTIQUE_LINKS },
  { label: "Uniformes", dotColor: "#e0b0d8", links: UNIFORMES_LINKS },
  { label: "Essais", dotColor: "#88c0d0", links: ESSAIS_LINKS },
  { label: "Revenus", dotColor: "#ff9999", links: REVENUS_LINKS, adminOnly: true },
  { label: "Entraîneurs", dotColor: "#a0c8ff", links: ENTRAINEURS_LINKS, adminOnly: true },
];

export function AdminTopbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<"admin" | "gerante" | null>(null);

  useEffect(() => {
    fetch("/api/admin/session")
      .then((res) => res.json())
      .then((data: { role: "admin" | "gerante" | null }) => setRole(data.role))
      .catch(() => setRole(null));
  }, []);

  const visibleGroups = GROUPS.filter((g) => !g.adminOnly || role === "admin");

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin");
  };

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <div>
          <p className="admin-sidebar-brand-title">New Valkyria</p>
          <p className="admin-sidebar-brand-sub">Administration{role === "gerante" ? " — Gérante" : ""}</p>
        </div>
      </div>

      <nav className="admin-sidebar-nav">
        {visibleGroups.map((group) => (
          <div className="admin-sidebar-group" key={group.label}>
            <div className="admin-sidebar-group-head">
              <span className="admin-sidebar-dot" style={{ background: group.dotColor }} />
              <span className="admin-sidebar-group-label">{group.label}</span>
            </div>
            {group.links.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link key={link.href} href={link.href} data-active={String(isActive)} className="admin-sidebar-link">
                  <Icon name={link.icon} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="admin-sidebar-footer">
        <button onClick={handleLogout} className="admin-logout-btn">
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
