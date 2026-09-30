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
  { href: "/admin/essais-dates", label: "Dates d'essai", icon: "grid" },
];

const BOUTIQUE_LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin/boutique", label: "Produits", icon: "tag" },
  { href: "/admin/boutique/commandes", label: "Commandes", icon: "bag" },
];

const COMMUNICATIONS_LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin/communications", label: "Envoyer un message", icon: "list" },
];

const SPORT_ETUDES_LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin/sport-etudes", label: "Sport-Études", icon: "flask" },
  { href: "/admin/programme-intensif", label: "Programme Intensif", icon: "flask" },
];

const EVALUATIONS_LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin/evaluations", label: "Événements", icon: "chart" },
];

const SYSTEME_LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin/audit", label: "Journal d'audit", icon: "shield" },
  { href: "/admin/exports", label: "Exports MonClubSportif", icon: "list" },
];

const UNIFORMES_LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin/uniformes", label: "Tableau de bord", icon: "gauge" },
  { href: "/admin/uniformes/kit-inscription", label: "Kit d'inscription", icon: "list" },
  { href: "/admin/uniformes/a-remettre", label: "À remettre", icon: "bag" },
  { href: "/admin/uniformes/aujourdhui", label: "Aujourd'hui", icon: "calendar" },
  { href: "/admin/uniformes/problemes", label: "Problèmes", icon: "flask" },
];

const REVENUS_LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin/revenus", label: "Vue d'ensemble", icon: "chart" },
  { href: "/admin/revenus/annuel", label: "Vue annuelle", icon: "grid" },
  { href: "/admin/revenus/paiements", label: "Paiements échelonnés", icon: "user" },
  { href: "/admin/revenus/tresorerie", label: "Trésorerie", icon: "gauge" },
  { href: "/admin/revenus/budget", label: "Budget annuel", icon: "chart" },
];

const ENTRAINEURS_LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin/entraineurs", label: "Entraîneurs", icon: "users" },
  { href: "/admin/entraineurs/activites", label: "Entraînement", icon: "calendar" },
  { href: "/admin/exercices", label: "Exercices", icon: "flask" },
  { href: "/admin/themes", label: "Thèmes", icon: "tag" },
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
  /** Groupe "Saison" — bascule Été/Automne-Hiver en un clic plutôt que
   *  d'occuper deux sections distinctes dans le menu. */
  isSeasonSwitcher?: boolean;
}

const SEASON_LINKS_BY_KEY: Record<"ete" | "automne-hiver", { href: string; label: string; icon: IconName }[]> = {
  ete: SEASON_ETE_LINKS,
  "automne-hiver": SEASON_AUTOMNE_HIVER_LINKS
};

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

const GROUPS: Group[] = [
  { label: "Saison", dotColor: "#f0c878", links: [], isSeasonSwitcher: true },
  { label: "Programmes (Garçons)", dotColor: "#78a8f0", links: SPORT_ETUDES_LINKS },
  { label: "Évaluations", dotColor: "#8fce9f", links: EVALUATIONS_LINKS },
  { label: "Boutique", dotColor: "#8fce9f", links: BOUTIQUE_LINKS },
  { label: "Uniformes", dotColor: "#e0b0d8", links: UNIFORMES_LINKS },
  { label: "Revenus", dotColor: "#ff9999", links: REVENUS_LINKS, adminOnly: true },
  { label: "Entraîneurs", dotColor: "#a0c8ff", links: ENTRAINEURS_LINKS, adminOnly: true },
  { label: "Communications", dotColor: "#f0c878", links: COMMUNICATIONS_LINKS, adminOnly: true },
  { label: "Système", dotColor: "#9d9da0", links: SYSTEME_LINKS, adminOnly: true },
];

export function AdminTopbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<"admin" | "gerante" | null>(null);
  // Si la page affichée appartient clairement à une saison, on part de
  // celle-là (déterministe, identique serveur/client) ; sinon "automne-hiver"
  // par défaut. Le sélecteur bascule l'affichage pour la page courante — un
  // choix volontairement par page plutôt qu'une préférence globale, pour
  // éviter tout aller-retour avec le localStorage à l'hydratation.
  const currentSeasonLink = (season: "ete" | "automne-hiver") => {
    const links = SEASON_LINKS_BY_KEY[season];
    const exact = links.find((l) => pathname === l.href);
    if (exact) return exact;
    // Repli sur préfixe le plus spécifique — "Vue d'ensemble" (souvent la
    // racine de la saison) ne doit pas absorber les sous-pages qui
    // commencent aussi par son href.
    return links
      .filter((l) => pathname.startsWith(`${l.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0];
  };
  // Recalculé à chaque rendu directement depuis l'URL courante (usePathname
  // est réactif aux transitions client) — jamais désynchronisé après une
  // navigation, contrairement à un état qu'il faudrait resynchroniser.
  const pinnedSeason: "ete" | "automne-hiver" | null = currentSeasonLink("ete") ? "ete" : currentSeasonLink("automne-hiver") ? "automne-hiver" : null;
  // Mémoire du dernier choix manuel — utilisée seulement sur les pages
  // neutres (ni Été ni Automne/Hiver), où basculer ne change que l'affichage
  // du menu sans naviguer.
  const [manualSeason, setManualSeason] = useState<"ete" | "automne-hiver">("automne-hiver");
  const activeSeason = pinnedSeason ?? manualSeason;

  useEffect(() => {
    fetch("/api/admin/session")
      .then((res) => res.json())
      .then((data: { role: "admin" | "gerante" | null }) => setRole(data.role))
      .catch(() => setRole(null));
  }, []);

  const switchSeason = (season: "ete" | "automne-hiver") => {
    if (pinnedSeason && pinnedSeason !== season) {
      // Sur une page propre à une saison, basculer navigue vers l'équivalent
      // dans l'autre saison (même concept : Inscriptions → Inscriptions,
      // etc.) plutôt que de simplement relabelliser le menu sans bouger.
      const current = currentSeasonLink(pinnedSeason);
      const match = current && SEASON_LINKS_BY_KEY[season].find((l) => l.label === current.label);
      router.push(match?.href ?? SEASON_LINKS_BY_KEY[season][0].href);
      return;
    }
    setManualSeason(season);
  };

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

      <GlobalSearchBox />

      <nav className="admin-sidebar-nav">
        {visibleGroups.map((group) => {
          const links = group.isSeasonSwitcher ? SEASON_LINKS_BY_KEY[activeSeason] : group.links;
          return (
            <div className="admin-sidebar-group" key={group.label}>
              <div className="admin-sidebar-group-head">
                <span className="admin-sidebar-dot" style={{ background: group.dotColor }} />
                <span className="admin-sidebar-group-label">{group.label}</span>
              </div>
              {group.isSeasonSwitcher && (
                <div style={{ display: "flex", gap: "0.3rem", padding: "0.2rem 0 0.5rem" }}>
                  <button
                    onClick={() => switchSeason("automne-hiver")}
                    style={{
                      flex: 1, fontSize: "0.68rem", padding: "0.3rem 0.4rem", borderRadius: "6px", cursor: "pointer",
                      border: activeSeason === "automne-hiver" ? "1px solid #f0c878" : "1px solid #302e36",
                      background: activeSeason === "automne-hiver" ? "#3a3020" : "transparent",
                      color: activeSeason === "automne-hiver" ? "#f0c878" : "#9d9da0",
                      fontWeight: activeSeason === "automne-hiver" ? 600 : 400
                    }}
                  >
                    Automne / Hiver
                  </button>
                  <button
                    onClick={() => switchSeason("ete")}
                    style={{
                      flex: 1, fontSize: "0.68rem", padding: "0.3rem 0.4rem", borderRadius: "6px", cursor: "pointer",
                      border: activeSeason === "ete" ? "1px solid #c8aae0" : "1px solid #302e36",
                      background: activeSeason === "ete" ? "#2e2438" : "transparent",
                      color: activeSeason === "ete" ? "#c8aae0" : "#9d9da0",
                      fontWeight: activeSeason === "ete" ? 600 : 400
                    }}
                  >
                    Été
                  </button>
                </div>
              )}
              {links.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <Link key={link.href} href={link.href} data-active={String(isActive)} className="admin-sidebar-link">
                    <Icon name={link.icon} />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
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
  );
}
