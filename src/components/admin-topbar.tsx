"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AdminPageHeader, AdminTabs } from "@/components/admin-page-header";
import { ADMIN_NAV, TODAY_HUB, findActive, resolveHref, seasonFromPath, visibleTabs, type AdminHub, type AdminNavIcon } from "@/lib/admin-nav";

type IconName = AdminNavIcon;

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
    case "sun":
      return <svg {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></svg>;
    case "mail":
      return <svg {...common}><rect x="3" y="5.5" width="18" height="13" rx="1.5" /><path d="m3.5 6.5 8.5 6.5 8.5-6.5" /></svg>;
    case "archive":
      return <svg {...common}><rect x="3" y="4" width="18" height="4.5" rx="1" /><path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5" /><path d="M10 12.5h4" /></svg>;
    case "chevron":
      return <svg {...common} width={12} height={12}><path d="m9 6 6 6-6 6" /></svg>;
  }
}

interface SearchPlayer {
  playerId: string;
  firstName: string;
  lastName: string;
  registrations: { id: string; seasonId: string; status: string }[];
  leadCount: number;
}
interface SearchCoach { id: string; firstName: string; lastName: string; status: string }

function GlobalSearchBox() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<{ players: SearchPlayer[]; coaches: SearchCoach[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const hasQuery = query.trim().length >= 2;

  useEffect(() => {
    if (!hasQuery) return;
    const handle = setTimeout(() => {
      setLoading(true);
      fetch(`/api/admin/search?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((data) => setResults(data))
        .catch(() => setResults(null))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, hasQuery]);

  const hasResults = hasQuery && results && (results.players.length > 0 || results.coaches.length > 0);

  return (
    <div style={{ position: "relative", margin: "0 0 1rem" }}>
      <input
        className="admin-input"
        placeholder="🔍 Rechercher une joueuse, un entraîneur..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{ fontSize: "0.75rem", width: "100%" }}
      />
      {open && hasQuery && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "#17151e", border: "1px solid #302e36", borderRadius: "8px", marginTop: "0.3rem", maxHeight: "320px", overflowY: "auto", padding: "0.4rem" }}>
          {loading && <p style={{ fontSize: "0.72rem", color: "#6d6b71", padding: "0.4rem" }}>Recherche...</p>}
          {!loading && !hasResults && <p style={{ fontSize: "0.72rem", color: "#6d6b71", padding: "0.4rem" }}>Aucun résultat.</p>}
          {!loading && results?.players.map((p) => (
            <div key={p.playerId} style={{ padding: "0.4rem", borderBottom: "1px solid #1f1d25" }}>
              <p style={{ fontSize: "0.75rem", color: "#fff", fontWeight: 600, margin: "0 0 0.2rem" }}>{p.firstName} {p.lastName}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                {p.registrations.map((r) => (
                  <Link key={r.id} href={`/admin/saison/${r.seasonId}/inscriptions`} className="admin-btn-ghost" style={{ fontSize: "0.65rem", padding: "0.15rem 0.4rem", textDecoration: "none" }}>
                    {r.seasonId} · {r.status}
                  </Link>
                ))}
                {p.leadCount > 0 && (
                  <Link href="/admin/inscriptions" className="admin-btn-ghost" style={{ fontSize: "0.65rem", padding: "0.15rem 0.4rem", textDecoration: "none" }}>
                    Été 2026 ({p.leadCount})
                  </Link>
                )}
              </div>
            </div>
          ))}
          {!loading && results?.coaches.map((c) => (
            <Link key={c.id} href={`/admin/entraineurs/${c.id}`} style={{ display: "block", padding: "0.4rem", textDecoration: "none", borderBottom: "1px solid #1f1d25" }}>
              <p style={{ fontSize: "0.75rem", color: "#a0c8ff", margin: 0 }}>🧑‍🏫 {c.firstName} {c.lastName}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* Chaque page admin rend son propre menu : le rôle, gardé en mémoire entre
 * deux navigations côté client, évite que les liens réservés à l'admin
 * clignotent à chaque changement de page. Au premier chargement il vaut null,
 * côté serveur comme à l'hydratation. */
let rememberedRole: "admin" | "gerante" | null = null;

/** Menu de gauche (un lien par hub) + en-tête de la section affichée avec ses
 *  onglets. Rendu juste avant `.admin-content` par chaque page admin. */
export function AdminTopbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<"admin" | "gerante" | null>(rememberedRole);
  const [toolsOpen, setToolsOpen] = useState(false);
  // Sur téléphone, le menu est replié derrière un bouton (sinon il précède le contenu de chaque page).
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/admin/session")
      .then((res) => res.json())
      .then((data: { role: "admin" | "gerante" | null }) => {
        rememberedRole = data.role;
        setRole(data.role);
      })
      .catch(() => setRole(null));
  }, []);

  const seasonId = seasonFromPath(pathname);
  // Repérage sur tous les onglets : une page réservée à l'admin garde son en-tête
  // même avant que le rôle soit connu (la gérante, elle, est redirigée côté serveur).
  const active = findActive(pathname, "admin");
  const hubEntry = (hub: AdminHub) => {
    const first = visibleTabs(hub, role)[0];
    return first ? resolveHref(first.href, seasonId) : null;
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin");
  };

  const renderHubLink = (hub: AdminHub) => {
    const href = hubEntry(hub);
    if (!href) return null;
    return (
      <Link key={hub.key} href={href} data-active={String(active?.hub.key === hub.key)} className="admin-sidebar-link">
        <Icon name={hub.icon} />
        <span>{hub.label}</span>
      </Link>
    );
  };

  // Rôle encore inconnu sur une page réservée à l'admin : le serveur a déjà
  // vérifié le rôle, donc on affiche tout de suite les onglets de l'admin.
  const headerRole = role ?? (active?.tab.adminOnly ? "admin" : null);
  const headerTabs = active ? visibleTabs(active.hub, headerRole).map((t) => ({ href: resolveHref(t.href, seasonId), label: t.label })) : [];

  return (
    <>
      <aside className="admin-sidebar" data-menu-open={String(menuOpen)}>
        <div className="admin-sidebar-brand">
          <div>
            <p className="admin-sidebar-brand-title">New Valkyria</p>
            <p className="admin-sidebar-brand-sub">Administration{role === "gerante" ? " — Gérante" : ""}</p>
          </div>
          <button type="button" className="admin-sidebar-menu-btn" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? "Fermer" : "Menu"}
          </button>
        </div>

        <GlobalSearchBox />

        <nav className="admin-sidebar-nav">
          <div className="admin-sidebar-group">{renderHubLink(TODAY_HUB)}</div>

          {ADMIN_NAV.map((section) => {
            const hubs = section.hubs.filter((h) => hubEntry(h));
            if (hubs.length === 0) return null;
            const containsActive = hubs.some((h) => h.key === active?.hub.key);
            const open = !section.collapsible || toolsOpen || containsActive;
            const head = (
              <>
                <span className="admin-sidebar-dot" style={{ background: section.dotColor }} />
                <span className="admin-sidebar-group-label">{section.label}</span>
              </>
            );
            return (
              <div className="admin-sidebar-group" key={section.key}>
                {section.collapsible ? (
                  <button type="button" className="admin-sidebar-group-head admin-sidebar-group-toggle" aria-expanded={open} onClick={() => setToolsOpen(!open)}>
                    {head}
                    <span className="admin-sidebar-chevron" data-open={String(open)}>
                      <Icon name="chevron" />
                    </span>
                  </button>
                ) : (
                  <div className="admin-sidebar-group-head">{head}</div>
                )}
                {open && hubs.map(renderHubLink)}
              </div>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <button onClick={handleLogout} className="admin-logout-btn">
            Déconnexion
          </button>
        </div>
      </aside>

      {active && headerTabs.length > 1 && (
        <div className="admin-hub">
          <AdminPageHeader title={active.hub.label} description={active.hub.description}>
            <AdminTabs tabs={headerTabs} activeHref={active.href} />
          </AdminPageHeader>
        </div>
      )}
    </>
  );
}
