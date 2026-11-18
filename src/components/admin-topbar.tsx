"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Apple, Archive, Check, ChevronsUpDown, BookOpen, Brain, BriefcaseBusiness, CalendarCheck, CalendarDays, Camera, ChartColumn, ChartLine, ChevronRight, Clapperboard,
  ClipboardCheck, School, Tent, Download, Dumbbell, Eye, FlaskConical, GraduationCap, Handshake, History, House, LayoutGrid, ListChecks, LogOut, Mail, MapPin,
  Megaphone, MessageSquareHeart, Mic, Gauge, RefreshCw, Repeat, Route, Search, Shirt, ShieldCheck, ShoppingBag, Sun, Tag, Target, Ticket, TrendingUp, Trophy,
  UserRound, Users, UsersRound, Wallet, type LucideIcon
} from "lucide-react";
import { useEffect, useState } from "react";

import { AdminPageHeader, AdminTabs } from "@/components/admin-page-header";
import { AdminThemeToggle } from "@/components/admin-theme-toggle";
import { ADMIN_NAV, SPACE_HINT, SPACE_HOME, SPACE_LABEL, TODAY_HUB, findActive, resolveHref, seasonFromPath, spaceOfHub, visibleTabs, type AdminHub, type AdminNavIcon, type AdminSpace } from "@/lib/admin-nav";

/* Icônes Lucide (charte docs/DESIGN_ADMIN.md) : une icône propre à chaque hub, sinon celle de son type. */
const BY_TYPE: Record<AdminNavIcon, LucideIcon> = {
  home: House, list: ListChecks, users: Users, gauge: Gauge, grid: LayoutGrid, flask: FlaskConical, shield: ShieldCheck, tag: Tag,
  bag: ShoppingBag, calendar: CalendarDays, chart: ChartColumn, user: UserRound, sun: Sun, chevron: ChevronRight, mail: Mail, archive: Archive
};
const BY_HUB: Record<string, LucideIcon> = {
  aujourdhui: Sun, mandalart: Target, saison: Users, essais: ClipboardCheck, "parcours-client": Route, uniformes: Shirt, garcons: UsersRound,
  lieux: MapPin, camps: Tent, parascolaire: School, monclubsportif: RefreshCw, communications: Mail, voix: MessageSquareHeart, marketing: Megaphone, revenus: Wallet,
  equipe: BriefcaseBusiness, partenaires: Handshake, matchs: Ticket, coaching: CalendarCheck, pratiques: CalendarDays, "nos-matchs": Trophy,
  methode: BookOpen, exercices: Dumbbell, progression: TrendingUp, "valkyria-lab": FlaskConical, "suivi-educateurs": GraduationCap,
  contenu: Clapperboard, "contenu-captation": Camera, "contenu-entrevues": Mic, "contenu-portee": ChartLine, "ma-journee": Sun,
  "mon-calendrier": CalendarDays, "mes-habitudes": Repeat, "ma-nutrition": Apple, "mes-connaissances": Brain, historique: History,
  apercu: Eye, audit: ShieldCheck, exports: Download, "ete-2026": Archive
};

const SPACES: AdminSpace[] = ["academie", "coaching", "contenu", "jp"];
const SPACE_ICON: Record<AdminSpace, LucideIcon> = { academie: House, coaching: Trophy, contenu: Megaphone, jp: UserRound };

function Icon({ name, hub, size = 16 }: { name: AdminNavIcon; hub?: string; size?: number }) {
  const C = (hub && BY_HUB[hub]) || BY_TYPE[name] || ListChecks;
  return <C size={size} strokeWidth={1.75} aria-hidden />;
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
    <div className="admin-sidebar-search">
      <Search size={15} strokeWidth={1.75} aria-hidden className="admin-sidebar-search-icon" />
      <input
        className="admin-input"
        placeholder="Rechercher une joueuse, un éducateur…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        aria-label="Rechercher une joueuse ou un éducateur"
      />
      {open && hasQuery && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "var(--adm-surface)", boxShadow: "0 8px 24px rgba(24,22,31,0.12)", border: "1px solid var(--adm-border)", borderRadius: "8px", marginTop: "0.3rem", maxHeight: "320px", overflowY: "auto", padding: "0.4rem" }}>
          {loading && <p style={{ fontSize: "0.72rem", color: "var(--adm-text-3)", padding: "0.4rem" }}>Recherche...</p>}
          {!loading && !hasResults && <p style={{ fontSize: "0.72rem", color: "var(--adm-text-3)", padding: "0.4rem" }}>Aucun résultat.</p>}
          {!loading && results?.players.map((p) => (
            <div key={p.playerId} style={{ padding: "0.4rem", borderBottom: "1px solid var(--adm-line)" }}>
              <p style={{ fontSize: "0.75rem", color: "var(--adm-text)", fontWeight: 600, margin: "0 0 0.2rem" }}>{p.firstName} {p.lastName}</p>
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
            <Link key={c.id} href={`/admin/entraineurs/${c.id}`} style={{ display: "block", padding: "0.4rem", textDecoration: "none", borderBottom: "1px solid var(--adm-line)" }}>
              <p style={{ fontSize: "0.75rem", color: "var(--adm-info)", margin: 0 }}>🧑‍🏫 {c.firstName} {c.lastName}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* Le rôle, gardé en mémoire, évite que les liens réservés à l'admin clignotent. Au premier chargement il vaut null,
 * côté serveur comme à l'hydratation. */
let rememberedRole: "admin" | "gerante" | null = null;
/* Dernier espace affiché (Académie, Coaching ou JP), pour une page qui n'appartient à aucun hub. */
let rememberedSpace: AdminSpace = "academie";

/** Ancien point d'entrée : chaque page l'appelait encore avant `.admin-content`. Le menu vit maintenant une seule fois
 *  dans `(admin)/layout.tsx` (AdminChrome) : il ne se reconstruit plus et ne refait plus d'appel à chaque page.
 *  Ne rien rendre ici évite de toucher les ~90 pages ; une nouvelle page n'a plus besoin de l'importer. */
export function AdminTopbar() {
  return null;
}

/** Pages sans menu : la connexion et les fiches à imprimer des journées d'évaluation. */
const NO_CHROME = [/^\/admin\/?$/, /^\/admin\/evaluations\/[^/]+\/(terrain|fiche)/];

/** Menu de gauche (un lien par hub) + en-tête de la section affichée avec ses onglets, rendu une seule fois par la
 *  mise en page de l'admin, juste avant le contenu de chaque page. */
export function AdminChrome() {
  const pathname = usePathname();
  if (NO_CHROME.some((r) => r.test(pathname))) return null;
  return <AdminChromeInner pathname={pathname} />;
}

function AdminChromeInner({ pathname }: { pathname: string }) {
  const router = useRouter();
  const [role, setRole] = useState<"admin" | "gerante" | null>(rememberedRole);
  const [toolsOpen, setToolsOpen] = useState(false);
  // Liste des espaces (se referme quand on change de page).
  const [spaceOpenOn, setSpaceOpenOn] = useState<string | null>(null);
  const spaceOpen = spaceOpenOn === pathname;
  const setSpaceOpen = (open: boolean) => setSpaceOpenOn(open ? pathname : null);
  // Sur téléphone, le menu est replié derrière un bouton ; il se referme tout seul quand on change de page.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const menuOpen = openOn === pathname;
  const setMenuOpen = (open: boolean) => setOpenOn(open ? pathname : null);

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
  // Quatre espaces : l'Académie (le business), le Coaching (seulement le foot), Marketing et création de contenu (réseaux, filmer, publier, entrevues, acquisition) et JP (admin seulement).
  // L'espace suit la page affichée.
  const space: AdminSpace = active ? spaceOfHub(active.hub.key) : rememberedSpace;
  useEffect(() => {
    rememberedSpace = space;
  }, [space]);
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
        <Icon name={hub.icon} hub={hub.key} />
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
          {/* Sélecteur d'espace façon Stripe / Linear : l'académie, puis l'espace affiché ; un clic ouvre la liste. */}
          <div className="adm-space">
            <button type="button" className="adm-space__btn" aria-haspopup="menu" aria-expanded={spaceOpen} onClick={() => setSpaceOpen(!spaceOpen)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" width={26} height={31} className="admin-sidebar-logo" />
              <span className="adm-space__text">
                <span className="admin-sidebar-brand-title">New Valkyria</span>
                <span className="admin-sidebar-brand-sub">{SPACE_LABEL[space]}{role === "gerante" ? " · Gérante" : ""}</span>
              </span>
              <ChevronsUpDown size={15} strokeWidth={1.75} aria-hidden className="adm-space__chev" />
            </button>
            {spaceOpen ? (
              <div className="adm-space__menu" role="menu">
                {SPACES.filter((sp) => sp !== "jp" || role === "admin").map((sp) => {
                  const SpaceIcon = SPACE_ICON[sp];
                  return (
                    <Link key={sp} href={SPACE_HOME[sp]} role="menuitem" data-active={space === sp || undefined} onClick={() => setSpaceOpen(false)}>
                      <span className="adm-space__icon" aria-hidden><SpaceIcon size={15} strokeWidth={1.75} /></span>
                      <span className="adm-space__item">
                        <strong>{SPACE_LABEL[sp]}</strong>
                        <small>{SPACE_HINT[sp]}</small>
                      </span>
                      {space === sp ? <Check size={15} strokeWidth={2} aria-hidden className="adm-space__check" /> : null}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
          <button type="button" className="admin-sidebar-menu-btn" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? "Fermer" : "Menu"}
          </button>
        </div>

        <GlobalSearchBox />

        <nav className="admin-sidebar-nav">
          {space === "academie" && <div className="admin-sidebar-group">{renderHubLink(TODAY_HUB)}</div>}

          {ADMIN_NAV.filter((section) => (section.space ?? "academie") === space).map((section) => {
            const hubs = section.hubs.filter((h) => hubEntry(h));
            if (hubs.length === 0) return null;
            const containsActive = hubs.some((h) => h.key === active?.hub.key);
            const open = !section.collapsible || toolsOpen || containsActive;
            const head = (
              <>
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
          <AdminThemeToggle />
          <button onClick={handleLogout} className="admin-logout-btn">
            <LogOut size={15} strokeWidth={1.75} aria-hidden />
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
