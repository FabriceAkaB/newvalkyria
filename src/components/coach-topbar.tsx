"use client";

import { AdminThemeToggle } from "@/components/admin-theme-toggle";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  coachName: string;
}

const LINKS = [
  { href: "/entraineur/dashboard", label: "Mes pratiques" },
  { href: "/entraineur/sondage", label: "Sondage des jeunes" },
  { href: "/entraineur/joueuses", label: "Joueuses" },
  { href: "/entraineur/exercices", label: "Exercices" },
  { href: "/entraineur/laboratoire", label: "Laboratoire" },
  { href: "/entraineur/methode", label: "Méthode" },
  { href: "/entraineur/formation", label: "Ma formation" },
  { href: "/entraineur/dossier", label: "Mon dossier" }
];

export function CoachTopbar({ coachName }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/coach/auth", { method: "DELETE" });
    router.push("/entraineur");
  };

  return (
    <aside className="admin-sidebar" data-menu-open={String(menuOpen)}>
      <div className="admin-sidebar-brand">
        <div className="admin-sidebar-brand-id coach-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={26} height={31} className="admin-sidebar-logo" />
          <div>
            <p className="admin-sidebar-brand-title">Espace Technique</p>
            <p className="admin-sidebar-brand-sub">{coachName}</p>
          </div>
        </div>
        <button type="button" className="admin-sidebar-menu-btn" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? "Fermer" : "Menu"}
        </button>
      </div>

      <nav className="admin-sidebar-nav">
        <div className="admin-sidebar-group">
          {LINKS.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`) || (link.href === "/entraineur/dashboard" && pathname.startsWith("/entraineur/activites"));
            return (
              <Link key={link.href} href={link.href} data-active={String(isActive)} className="admin-sidebar-link">
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="admin-sidebar-footer">
        <AdminThemeToggle />
        <button onClick={handleLogout} className="admin-logout-btn">
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
