"use client";

import { AdminThemeToggle } from "@/components/admin-theme-toggle";
import { CoachSessionGuard } from "@/components/coach-session-guard";
import {
  BookOpen,
  CalendarCheck,
  Camera,
  Clapperboard,
  Compass,
  Ellipsis,
  FlaskConical,
  GraduationCap,
  Lightbulb,
  LogOut,
  MessageSquareHeart,
  UserRound,
  Users,
  Video,
  Wallet,
  X,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Props {
  coachName: string;
}

interface NavLink {
  href: string;
  label: string;
  /** Libellé court de l'onglet du bas (téléphone). */
  short?: string;
  icon: LucideIcon;
  videographer?: boolean;
}

/** Le menu de l'Espace Technique, en trois groupes (JP, 25 nov. 2026 : une vraie application, sur ordinateur
 *  comme au téléphone). Ordinateur : menu latéral fixe. Téléphone : 4 onglets en bas + « Plus » pour le reste. */
const GROUPS: { label: string; links: NavLink[] }[] = [
  {
    label: "Sur le terrain",
    links: [
      { href: "/entraineur/dashboard", label: "Mes pratiques", short: "Pratiques", icon: CalendarCheck },
      { href: "/entraineur/sondage", label: "Sondage des jeunes", short: "Sondage", icon: MessageSquareHeart },
      { href: "/entraineur/joueuses", label: "Joueuses", icon: Users },
      { href: "/entraineur/videos", label: "Vidéos", icon: Video },
      { href: "/entraineur/videos-joueuses", label: "Vidéos des joueuses", icon: Camera, videographer: true },
      { href: "/entraineur/guide-tournage", label: "Guide de tournage", icon: Clapperboard, videographer: true }
    ]
  },
  {
    label: "Apprendre",
    links: [
      { href: "/entraineur/exercices", label: "La Bible des exercices", short: "Bible", icon: BookOpen },
      { href: "/entraineur/methode", label: "Méthode", icon: Compass },
      { href: "/entraineur/laboratoire", label: "Laboratoire", icon: FlaskConical },
      { href: "/entraineur/formation", label: "Ma formation", icon: GraduationCap }
    ]
  },
  {
    label: "Moi",
    links: [
      { href: "/entraineur/paie", label: "Ma paie", short: "Paie", icon: Wallet },
      { href: "/entraineur/dossier", label: "Mon dossier", icon: UserRound },
      { href: "/entraineur/idees", label: "Boîte à suggestions", icon: Lightbulb }
    ]
  }
];

/** Les onglets du bas sur téléphone (les plus utilisés au bord du terrain). */
const TABS = ["/entraineur/dashboard", "/entraineur/sondage", "/entraineur/exercices", "/entraineur/paie"];

const isActive = (href: string, pathname: string) =>
  pathname === href || pathname.startsWith(`${href}/`) || (href === "/entraineur/dashboard" && pathname.startsWith("/entraineur/activites"));

export function CoachTopbar({ coachName }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  // Le menu reste ouvert seulement sur la page où on l'a ouvert : il se referme tout seul à chaque changement de page.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const menuOpen = openOn === pathname;
  const setMenuOpen = (open: boolean) => setOpenOn(open ? pathname : null);
  // L'espace vidéaste n'apparaît qu'à l'éducateur qui filme les joueuses (case « Vidéaste » de sa fiche).
  const [videographer, setVideographer] = useState(false);
  useEffect(() => {
    fetch("/api/coach/moi")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setVideographer(Boolean(d?.videographer)))
      .catch(() => null);
  }, []);
  const groups = GROUPS.map((g) => ({ ...g, links: g.links.filter((l) => !l.videographer || videographer) }));
  const all = groups.flatMap((g) => g.links);
  const tabs = TABS.map((href) => all.find((l) => l.href === href)!).filter(Boolean);
  const moreActive = !tabs.some((t) => isActive(t.href, pathname));

  const handleLogout = async () => {
    await fetch("/api/coach/auth", { method: "DELETE" });
    router.push("/entraineur");
  };

  return (
    <>
      {/* Hors du menu : sur téléphone, le menu fermé cache tout ce qu'il contient, l'alerte de session doit rester visible. */}
      <CoachSessionGuard />
      <aside className="admin-sidebar coach-sidebar" data-menu-open={String(menuOpen)}>
        <div className="admin-sidebar-brand">
          <Link href="/entraineur/dashboard" className="admin-sidebar-brand-id coach-brand" style={{ textDecoration: "none", color: "inherit" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" width={26} height={31} className="admin-sidebar-logo" />
            <div>
              <p className="admin-sidebar-brand-title">Espace Technique</p>
              <p className="admin-sidebar-brand-sub">{coachName}</p>
            </div>
          </Link>
          <div className="coach-sidebar__mobile-theme">
            <AdminThemeToggle compact />
          </div>
          <button type="button" className="admin-sidebar-menu-btn coach-sidebar__close" aria-label="Fermer le menu" onClick={() => setMenuOpen(false)}>
            <X size={18} strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        <nav className="admin-sidebar-nav" aria-label="Espace Technique">
          {groups.map((g) => (
            <div key={g.label} className="admin-sidebar-group">
              <div className="admin-sidebar-group-head">
                <span className="admin-sidebar-group-label">{g.label}</span>
              </div>
              {g.links.map((link) => {
                const Icon = link.icon;
                return (
                  <Link key={link.href} href={link.href} data-active={String(isActive(link.href, pathname))} aria-current={isActive(link.href, pathname) ? "page" : undefined} className="admin-sidebar-link">
                    <Icon size={17} strokeWidth={1.75} aria-hidden />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar-footer coach-sidebar__footer">
          <AdminThemeToggle />
          <button onClick={handleLogout} className="admin-logout-btn coach-logout">
            <LogOut size={14} strokeWidth={1.75} aria-hidden />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Téléphone : les onglets du bas, cibles de 44 px et plus. */}
      <nav className="coach-tabbar" aria-label="Navigation rapide">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = isActive(t.href, pathname) && !menuOpen;
          return (
            <Link key={t.href} href={t.href} data-active={String(active)} aria-current={active ? "page" : undefined} onClick={() => setMenuOpen(false)}>
              <Icon size={20} strokeWidth={1.75} aria-hidden />
              <span>{t.short ?? t.label}</span>
            </Link>
          );
        })}
        <button type="button" data-active={String(menuOpen || moreActive)} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          <Ellipsis size={20} strokeWidth={1.75} aria-hidden />
          <span>Plus</span>
        </button>
      </nav>
    </>
  );
}
