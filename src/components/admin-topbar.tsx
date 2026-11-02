"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

type IconName = "home" | "list" | "users" | "gauge" | "grid" | "flask" | "shield" | "tag" | "bag" | "calendar" | "chart" | "user" | "sun" | "chevron";

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
    case "chevron":
      return <svg {...common} width={12} height={12}><path d="m9 6 6 6-6 6" /></svg>;
  }
}

interface NavLink {
  href: string;
  label: string;
  icon: IconName;
  /** Masqué pour les rôles autres qu'"admin" (ex. Gérante) — finances et
   *  données RH. Les pages concernées vérifient aussi le rôle côté serveur. */
  adminOnly?: boolean;
}

type SeasonKey = "ete" | "automne-hiver";

/** Une section du menu = une tâche de la journée, pas une fonctionnalité.
 *  `seasonLinks` dépend de la saison choisie dans le sélecteur du haut. */
interface Section {
  key: string;
  label: string;
  dotColor: string;
  seasonLinks?: Record<SeasonKey, NavLink[]>;
  links: NavLink[];
}

const FAMILLES: Section = {
  key: "familles",
  label: "Familles & inscriptions",
  dotColor: "#f0c878",
  seasonLinks: {
    "automne-hiver": [
      { href: "/admin/saison/automne-hiver-2026", label: "Vue d'ensemble de la saison", icon: "home" },
      { href: "/admin/saison/automne-hiver-2026/inscriptions", label: "Inscriptions", icon: "list" },
      { href: "/admin/saison/automne-hiver-2026/essais", label: "Essais", icon: "flask" }
    ],
    ete: [
      { href: "/admin/dashboard", label: "Vue d'ensemble de la saison", icon: "home" },
      { href: "/admin/inscriptions", label: "Inscriptions", icon: "list" },
      { href: "/admin/essais", label: "Essais", icon: "flask" },
      { href: "/admin/joueuses", label: "Joueuses", icon: "users" },
      { href: "/admin/clubs", label: "Clubs", icon: "shield" }
    ]
  },
  links: [
    { href: "/admin/inscriptions-garcons", label: "Inscriptions garçons", icon: "users" },
    { href: "/admin/sport-etudes", label: "Sport-Études", icon: "flask" },
    { href: "/admin/uniformes/a-remettre", label: "Uniformes à remettre", icon: "bag" },
    { href: "/admin/boutique/commandes", label: "Commandes boutique", icon: "bag" },
    { href: "/admin/references", label: "Références & crédits", icon: "users" }
  ]
};

const PROGRAMMES: Section = {
  key: "programmes",
  label: "Programmes & horaires",
  dotColor: "#78a8f0",
  seasonLinks: {
    "automne-hiver": [
      { href: "/admin/saison/automne-hiver-2026/horaire", label: "Horaire", icon: "grid" },
      { href: "/admin/saison/automne-hiver-2026/capacite", label: "Capacité", icon: "gauge" },
      { href: "/admin/saison/automne-hiver-2026/solo", label: "Groupes solo", icon: "user" }
    ],
    ete: [
      { href: "/admin/plages", label: "Horaire", icon: "grid" },
      { href: "/admin/capacite", label: "Capacité", icon: "gauge" }
    ]
  },
  links: [
    { href: "/admin/calendrier", label: "Calendrier global", icon: "calendar" },
    { href: "/admin/essais-dates", label: "Dates d'essai", icon: "grid" },
    { href: "/admin/essais-calendrier", label: "Calendrier des essais", icon: "calendar" },
    { href: "/admin/programme/intensif-garcons", label: "Intensif garçons 2015", icon: "users" },
    { href: "/admin/programme/garcons-2014", label: "Intensif garçons 2014", icon: "users" },
    { href: "/admin/programme/garcons-2018", label: "Garçons 2018 (essais gratuits)", icon: "users" },
    { href: "/admin/garcons-prives", label: "Programmes privés", icon: "list" },
    { href: "/admin/seances-privees", label: "Séances privées", icon: "user" },
    { href: "/admin/evaluations", label: "Évaluations", icon: "chart" },
    { href: "/admin/terrains", label: "Terrains", icon: "grid" },
    { href: "/admin/location-terrains", label: "Location de terrains", icon: "calendar" }
  ]
};

const COMMUNICATIONS: Section = {
  key: "communications",
  label: "Communications",
  dotColor: "#c3a6ff",
  links: [
    { href: "/admin/communications", label: "Envoyer un message", icon: "list", adminOnly: true },
    { href: "/admin/relances", label: "Relances et suivi", icon: "users", adminOnly: true }
  ]
};

const FINANCES: Section = {
  key: "finances",
  label: "Finances",
  dotColor: "#ff9999",
  links: [
    { href: "/admin/revenus", label: "Revenus", icon: "chart", adminOnly: true },
    { href: "/admin/revenus/paiements", label: "Paiements échelonnés", icon: "user", adminOnly: true },
    { href: "/admin/revenus/tresorerie", label: "Trésorerie", icon: "gauge", adminOnly: true },
    { href: "/admin/revenus/budget", label: "Budget annuel", icon: "chart", adminOnly: true },
    { href: "/admin/revenus/annuel", label: "Vue annuelle", icon: "grid", adminOnly: true }
  ]
};

const EQUIPE: Section = {
  key: "equipe",
  label: "Équipe & partenaires",
  dotColor: "#a0c8ff",
  links: [
    { href: "/admin/entraineurs", label: "Entraîneurs", icon: "users", adminOnly: true },
    { href: "/admin/entraineurs/activites", label: "Entraînements", icon: "calendar", adminOnly: true },
    { href: "/admin/contrats", label: "Contrats d'embauche", icon: "list", adminOnly: true },
    { href: "/admin/entraineurs/paie", label: "Paie", icon: "chart", adminOnly: true },
    { href: "/admin/entraineurs/statistiques", label: "Statistiques", icon: "gauge", adminOnly: true },
    { href: "/admin/commandites", label: "Commandites (suivi)", icon: "tag" },
    { href: "/admin/sponsors-2027", label: "Sponsors 2027", icon: "tag" },
    { href: "/admin/matchs", label: "Vente de matchs", icon: "calendar" }
  ]
};

const OUTILS: Section = {
  key: "outils",
  label: "Outils",
  dotColor: "#9d9da0",
  links: [
    { href: "/admin/boutique", label: "Produits de la boutique", icon: "tag" },
    { href: "/admin/uniformes", label: "Uniformes : tableau de bord", icon: "gauge" },
    { href: "/admin/uniformes/aujourdhui", label: "Uniformes : distribution du jour", icon: "calendar" },
    { href: "/admin/uniformes/kit-inscription", label: "Uniformes : kit d'inscription", icon: "list" },
    { href: "/admin/uniformes/problemes", label: "Uniformes : problèmes", icon: "flask" },
    { href: "/admin/programme-intensif", label: "Intensif 2015 : séances et dates", icon: "calendar" },
    { href: "/admin/exercices", label: "Exercices", icon: "flask", adminOnly: true },
    { href: "/admin/themes", label: "Thèmes d'entraînement", icon: "tag", adminOnly: true },
    { href: "/admin/historique", label: "Historique de l'académie", icon: "list", adminOnly: true },
    { href: "/admin/audit", label: "Journal d'audit", icon: "shield", adminOnly: true },
    { href: "/admin/exports", label: "Exports MonClubSportif", icon: "list", adminOnly: true }
  ]
};

const SECTIONS: Section[] = [FAMILLES, PROGRAMMES, COMMUNICATIONS, FINANCES, EQUIPE, OUTILS];
const TODAY_LINK: NavLink = { href: "/admin/aujourdhui", label: "Aujourd'hui", icon: "sun" };

const sectionLinks = (section: Section, season: SeasonKey) => [...(section.seasonLinks?.[season] ?? []), ...section.links];
const seasonLinks = (season: SeasonKey) => SECTIONS.flatMap((s) => s.seasonLinks?.[season] ?? []);

/** Lien le plus précis qui correspond à l'URL — « Uniformes : tableau de bord »
 *  ne doit pas s'allumer en même temps que « Uniformes : problèmes ». */
function bestMatch(links: NavLink[], pathname: string): NavLink | undefined {
  return links
    .filter((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

const OPEN_SECTIONS_KEY = "nv-admin-open-sections";

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

/* Chaque page admin rend son propre menu : ces valeurs, gardées en mémoire
 * entre deux navigations côté client, évitent que les liens réservés à
 * l'admin et les sections dépliées clignotent à chaque changement de page.
 * Au premier chargement elles valent null, côté serveur comme à l'hydratation. */
let rememberedRole: "admin" | "gerante" | null = null;

/** Sections dépliées par l'utilisateur, gardées dans le navigateur. Lu via
 *  useSyncExternalStore : rien de déplié au rendu serveur, puis le choix
 *  mémorisé dès l'hydratation, sans écart entre serveur et client. */
const openSectionsListeners = new Set<() => void>();
let openSectionsRaw: string | null = null;
function readOpenSections(): string {
  if (openSectionsRaw === null) {
    try {
      openSectionsRaw = localStorage.getItem(OPEN_SECTIONS_KEY) ?? "[]";
    } catch {
      openSectionsRaw = "[]"; // Stockage indisponible (navigation privée) : tout reste replié.
    }
  }
  return openSectionsRaw;
}
function writeOpenSections(next: string[]) {
  openSectionsRaw = JSON.stringify(next);
  try {
    localStorage.setItem(OPEN_SECTIONS_KEY, openSectionsRaw);
  } catch {
    // Préférence non conservée : sans conséquence.
  }
  openSectionsListeners.forEach((l) => l());
}
function subscribeOpenSections(listener: () => void) {
  openSectionsListeners.add(listener);
  return () => {
    openSectionsListeners.delete(listener);
  };
}
function parseOpenSections(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
}

export function AdminTopbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<"admin" | "gerante" | null>(rememberedRole);
  // Si la page affichée appartient clairement à une saison, on part de
  // celle-là (déterministe, identique serveur/client) ; sinon "automne-hiver"
  // par défaut. Le sélecteur bascule l'affichage pour la page courante — un
  // choix volontairement par page plutôt qu'une préférence globale, pour
  // éviter tout aller-retour avec le localStorage à l'hydratation.
  const currentSeasonLink = (season: SeasonKey) => bestMatch(seasonLinks(season), pathname);
  // Recalculé à chaque rendu directement depuis l'URL courante (usePathname
  // est réactif aux transitions client) — jamais désynchronisé après une
  // navigation, contrairement à un état qu'il faudrait resynchroniser.
  const pinnedSeason: SeasonKey | null = currentSeasonLink("ete") ? "ete" : currentSeasonLink("automne-hiver") ? "automne-hiver" : null;
  // Mémoire du dernier choix manuel — utilisée seulement sur les pages
  // neutres (ni Été ni Automne/Hiver), où basculer ne change que l'affichage
  // du menu sans naviguer.
  const [manualSeason, setManualSeason] = useState<SeasonKey>("automne-hiver");
  const activeSeason = pinnedSeason ?? manualSeason;

  // Sections dépliées par l'utilisateur (mémorisées). Celle de la page
  // affichée est dépliée d'office, sauf si on la replie pendant la visite.
  const openSectionsRawValue = useSyncExternalStore(subscribeOpenSections, readOpenSections, () => "[]");
  const openSections = useMemo(() => parseOpenSections(openSectionsRawValue), [openSectionsRawValue]);
  const [collapsedActive, setCollapsedActive] = useState(false);

  useEffect(() => {
    fetch("/api/admin/session")
      .then((res) => res.json())
      .then((data: { role: "admin" | "gerante" | null }) => {
        rememberedRole = data.role;
        setRole(data.role);
      })
      .catch(() => setRole(null));
  }, []);

  const switchSeason = (season: SeasonKey) => {
    if (pinnedSeason && pinnedSeason !== season) {
      // Sur une page propre à une saison, basculer navigue vers l'équivalent
      // dans l'autre saison (même concept : Inscriptions → Inscriptions,
      // etc.) plutôt que de simplement relabelliser le menu sans bouger.
      const current = currentSeasonLink(pinnedSeason);
      const target = seasonLinks(season);
      const match = current && target.find((l) => l.label === current.label);
      router.push(match?.href ?? target[0].href);
      return;
    }
    setManualSeason(season);
  };

  const visibleSections = SECTIONS.map((section) => ({
    section,
    links: sectionLinks(section, activeSeason).filter((l) => !l.adminOnly || role === "admin")
  })).filter((s) => s.links.length > 0);
  const activeLink = bestMatch([TODAY_LINK, ...visibleSections.flatMap((s) => s.links)], pathname);
  const activeSectionKey = visibleSections.find((s) => s.links.includes(activeLink as NavLink))?.section.key;
  const isSectionOpen = (key: string) => (key === activeSectionKey ? !collapsedActive : openSections.includes(key));

  const toggleSection = (key: string) => {
    if (key === activeSectionKey) {
      setCollapsedActive(!collapsedActive);
      return;
    }
    writeOpenSections(openSections.includes(key) ? openSections.filter((k) => k !== key) : [...openSections, key]);
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin");
  };

  const renderLink = (link: NavLink) => (
    <Link key={link.href} href={link.href} data-active={String(link === activeLink)} className="admin-sidebar-link">
      <Icon name={link.icon} />
      <span>{link.label}</span>
    </Link>
  );

  const seasonButton = (season: SeasonKey, label: string, color: string, bg: string) => (
    <button
      onClick={() => switchSeason(season)}
      style={{
        flex: 1, fontSize: "0.68rem", padding: "0.3rem 0.4rem", borderRadius: "6px", cursor: "pointer",
        border: activeSeason === season ? `1px solid ${color}` : "1px solid #302e36",
        background: activeSeason === season ? bg : "transparent",
        color: activeSeason === season ? color : "#9d9da0",
        fontWeight: activeSeason === season ? 600 : 400
      }}
    >
      {label}
    </button>
  );

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
        <div className="admin-sidebar-group">{renderLink(TODAY_LINK)}</div>

        <div style={{ display: "flex", gap: "0.3rem", padding: "0.1rem 1.25rem 0.8rem" }} title="Saison affichée dans le menu">
          {seasonButton("automne-hiver", "Automne / Hiver", "#f0c878", "#3a3020")}
          {seasonButton("ete", "Été", "#c8aae0", "#2e2438")}
        </div>

        {visibleSections.map(({ section, links }) => {
          const isOpen = isSectionOpen(section.key);
          return (
            <div className="admin-sidebar-group" key={section.key}>
              <button
                type="button"
                className="admin-sidebar-group-head admin-sidebar-group-toggle"
                aria-expanded={isOpen}
                onClick={() => toggleSection(section.key)}
              >
                <span className="admin-sidebar-dot" style={{ background: section.dotColor }} />
                <span className="admin-sidebar-group-label">{section.label}</span>
                <span className="admin-sidebar-chevron" data-open={String(isOpen)}>
                  <Icon name="chevron" />
                </span>
              </button>
              {isOpen && links.map(renderLink)}
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
