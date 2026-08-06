"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface Props {
  coachName: string;
}

const LINKS = [
  { href: "/entraineur/dashboard", label: "Tableau de bord" },
  { href: "/entraineur/joueuses", label: "Joueuses" }
];

export function CoachTopbar({ coachName }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch("/api/coach/auth", { method: "DELETE" });
    router.push("/entraineur");
  };

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <div>
          <p className="admin-sidebar-brand-title">New Valkyria</p>
          <p className="admin-sidebar-brand-sub">{coachName}</p>
        </div>
      </div>

      <nav className="admin-sidebar-nav">
        <div className="admin-sidebar-group">
          {LINKS.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link key={link.href} href={link.href} data-active={String(isActive)} className="admin-sidebar-link">
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="admin-sidebar-footer">
        <button onClick={handleLogout} className="admin-logout-btn">
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
