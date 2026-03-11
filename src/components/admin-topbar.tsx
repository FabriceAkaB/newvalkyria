"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_LINKS = [
  { href: "/admin/dashboard", label: "Vue d'ensemble" },
  { href: "/admin/inscriptions", label: "Inscriptions" },
  { href: "/admin/joueuses", label: "Joueuses" },
  { href: "/admin/capacite", label: "Capacité" },
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
      <nav className="admin-nav">
        {NAV_LINKS.map((link) => (
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
  );
}
