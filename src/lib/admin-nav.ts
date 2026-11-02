/** Organisation de l'espace admin : des sections (menu de gauche) qui
 *  regroupent des « hubs », chacun avec ses onglets. Le menu montre un lien
 *  par hub ; l'en-tête de page affiche le titre du hub et ses onglets. Une
 *  seule source pour les deux, pour qu'ils ne divergent jamais.
 *
 *  `{saison}` dans un lien = la saison de la page affichée, sinon la saison
 *  active (via la redirection /admin/saison?vue=…). */

export type AdminNavIcon =
  | "home" | "list" | "users" | "gauge" | "grid" | "flask" | "shield" | "tag" | "bag" | "calendar" | "chart" | "user" | "sun" | "chevron" | "mail" | "archive";

export interface AdminTab {
  href: string;
  label: string;
  /** Réservé au rôle "admin" (finances, RH) — la page le vérifie aussi côté serveur. */
  adminOnly?: boolean;
}

export interface AdminHub {
  key: string;
  label: string;
  icon: AdminNavIcon;
  /** Une phrase affichée sous le titre, quand le hub a plusieurs onglets. */
  description: string;
  tabs: AdminTab[];
}

export interface AdminNavSection {
  key: string;
  label: string;
  dotColor: string;
  hubs: AdminHub[];
  /** Section repliée par défaut (dépliée d'office quand on y est). */
  collapsible?: boolean;
}

export const TODAY_HUB: AdminHub = {
  key: "aujourdhui",
  label: "Aujourd'hui",
  icon: "sun",
  description: "Ce qui demande une action aujourd'hui.",
  tabs: [{ href: "/admin/aujourdhui", label: "Aujourd'hui" }]
};

export const ADMIN_NAV: AdminNavSection[] = [
  {
    key: "plan",
    label: "Plan 1,5 M$",
    dotColor: "#b49bf2",
    hubs: [
      {
        key: "mandalart",
        label: "Mandalart 2028",
        icon: "gauge",
        description: "1 500 000 $ encaissés en 2028 : ce qu'il faut faire ce mois-ci, les 8 piliers, les niveaux, les chiffres et les agents.",
        tabs: [
          { href: "/admin/mandalart", label: "Ce mois-ci", adminOnly: true },
          { href: "/admin/mandalart/piliers", label: "Les 8 piliers", adminOnly: true },
          { href: "/admin/mandalart/niveaux", label: "Niveaux", adminOnly: true },
          { href: "/admin/mandalart/trajectoire", label: "Trajectoire $", adminOnly: true },
          { href: "/admin/mandalart/indicateurs", label: "Indicateurs", adminOnly: true },
          { href: "/admin/mandalart/agents", label: "Agents IA", adminOnly: true },
          { href: "/admin/mandalart/journal", label: "Journal", adminOnly: true }
        ]
      }
    ]
  },
  {
    key: "familles",
    label: "Familles & inscriptions",
    dotColor: "#f0c878",
    hubs: [
      {
        key: "saison",
        label: "Saison en cours",
        icon: "home",
        description: "Inscriptions, horaire des groupes et places disponibles de la saison en cours.",
        tabs: [
          { href: "/admin/saison/{saison}", label: "Vue d'ensemble" },
          { href: "/admin/saison/{saison}/inscriptions", label: "Inscriptions" },
          { href: "/admin/saison/{saison}/horaire", label: "Horaire" },
          { href: "/admin/saison/{saison}/capacite", label: "Capacité" },
          { href: "/admin/saison/{saison}/solo", label: "Groupes solo" }
        ]
      },
      {
        key: "essais",
        label: "Essais",
        icon: "flask",
        description: "Les joueuses inscrites à un essai, les dates offertes et le calendrier de tous les essais.",
        tabs: [
          { href: "/admin/saison/{saison}/essais", label: "Inscriptions aux essais" },
          { href: "/admin/essais-dates", label: "Dates d'essai" },
          { href: "/admin/essais-calendrier", label: "Calendrier des essais" }
        ]
      },
      {
        key: "uniformes",
        label: "Uniformes & boutique",
        icon: "bag",
        description: "Commandes à préparer et à remettre, problèmes à régler et produits en vente.",
        tabs: [
          { href: "/admin/uniformes", label: "Tableau de bord" },
          { href: "/admin/uniformes/a-remettre", label: "À remettre" },
          { href: "/admin/uniformes/aujourdhui", label: "Distribution du jour" },
          { href: "/admin/uniformes/problemes", label: "Problèmes" },
          { href: "/admin/uniformes/kit-inscription", label: "Kit d'inscription" },
          { href: "/admin/boutique/commandes", label: "Commandes boutique" },
          { href: "/admin/boutique", label: "Produits" }
        ]
      }
    ]
  },
  {
    key: "programmes",
    label: "Programmes & horaires",
    dotColor: "#78a8f0",
    hubs: [
      {
        key: "garcons",
        label: "Garçons & Sport-Études",
        icon: "users",
        description: "Inscriptions, places et liens d'inscription de chaque programme garçons et du Sport-Études.",
        tabs: [
          { href: "/admin/inscriptions-garcons", label: "Toutes les inscriptions" },
          { href: "/admin/programme/intensif-garcons", label: "Intensif 2015" },
          { href: "/admin/programme/garcons-2014", label: "Intensif 2014" },
          { href: "/admin/programme/garcons-2018", label: "Garçons 2018" },
          { href: "/admin/garcons-prives", label: "Programmes privés" },
          { href: "/admin/sport-etudes", label: "Sport-Études" }
        ]
      },
      {
        key: "lieux",
        label: "Calendrier & terrains",
        icon: "calendar",
        description: "Toutes les activités au calendrier, les terrains, leur location et les séances privées.",
        tabs: [
          { href: "/admin/calendrier", label: "Calendrier global" },
          { href: "/admin/terrains", label: "Terrains" },
          { href: "/admin/location-terrains", label: "Location de terrains" },
          { href: "/admin/seances-privees", label: "Séances privées" }
        ]
      },
      {
        key: "pratiques",
        label: "Pratiques",
        icon: "flask",
        description: "Chaque pratique préparée 2 semaines d'avance : vert, jaune, rouge. Aussi les pratiques que JP donne hors de l'Académie.",
        tabs: [{ href: "/admin/pratiques", label: "À préparer" }]
      },
      {
        key: "evaluations",
        label: "Évaluations",
        icon: "chart",
        description: "Événements d'évaluation des joueuses.",
        tabs: [{ href: "/admin/evaluations", label: "Événements" }]
      }
    ]
  },
  {
    key: "communications",
    label: "Communications",
    dotColor: "#c3a6ff",
    hubs: [
      {
        key: "communications",
        label: "Messages aux familles",
        icon: "mail",
        description: "Envoi de messages, suivi des relances et campagne de références.",
        tabs: [
          { href: "/admin/communications", label: "Envoyer un message", adminOnly: true },
          { href: "/admin/relances", label: "Relances et suivi", adminOnly: true },
          { href: "/admin/references", label: "Références & crédits" }
        ]
      },
      {
        key: "voix",
        label: "Voix des familles",
        icon: "chart",
        description: "Sondages avec un lien par famille : qui a répondu quoi, satisfaction, familles à rappeler et familles intéressées par un projet.",
        tabs: [{ href: "/admin/sondages", label: "Sondages", adminOnly: true }]
      }
    ]
  },
  {
    key: "finances",
    label: "Finances",
    dotColor: "#ff9999",
    hubs: [
      {
        key: "revenus",
        label: "Revenus & paiements",
        icon: "chart",
        description: "Revenus par saison, paiements échelonnés, trésorerie et budget.",
        tabs: [
          { href: "/admin/revenus", label: "Vue d'ensemble", adminOnly: true },
          { href: "/admin/revenus/paiements", label: "Paiements échelonnés", adminOnly: true },
          { href: "/admin/revenus/tresorerie", label: "Trésorerie", adminOnly: true },
          { href: "/admin/revenus/budget", label: "Budget annuel", adminOnly: true },
          { href: "/admin/revenus/annuel", label: "Vue annuelle", adminOnly: true }
        ]
      }
    ]
  },
  {
    key: "equipe",
    label: "Équipe & partenaires",
    dotColor: "#a0c8ff",
    hubs: [
      {
        key: "equipe",
        label: "Équipe",
        icon: "users",
        description: "Entraîneurs, entraînements, contenu technique, paie et contrats d'embauche.",
        tabs: [
          { href: "/admin/entraineurs", label: "Entraîneurs", adminOnly: true },
          { href: "/admin/entraineurs/activites", label: "Entraînements", adminOnly: true },
          { href: "/admin/exercices", label: "Exercices", adminOnly: true },
          { href: "/admin/themes", label: "Thèmes", adminOnly: true },
          { href: "/admin/entraineurs/paie", label: "Paie", adminOnly: true },
          { href: "/admin/contrats", label: "Contrats", adminOnly: true },
          { href: "/admin/entraineurs/statistiques", label: "Statistiques", adminOnly: true }
        ]
      },
      {
        key: "partenaires",
        label: "Commandites & partenaires",
        icon: "tag",
        description: "Emplacements de commandite 2027, suivi des commanditaires et offres de partenariat.",
        tabs: [
          { href: "/admin/sponsors-2027", label: "Commandites 2027" },
          { href: "/admin/commandites", label: "Suivi des commanditaires" }
        ]
      },
      {
        key: "matchs",
        label: "Matchs & arbitres",
        icon: "calendar",
        description: "Plages de match offertes aux autres clubs, arbitres qui réservent leurs matchs, paie des arbitres et bilan financier de chaque match.",
        tabs: [
          { href: "/admin/matchs", label: "Vente de matchs" },
          { href: "/admin/arbitres", label: "Arbitres et bilan", adminOnly: true }
        ]
      }
    ]
  },
  {
    key: "outils",
    label: "Outils",
    dotColor: "#9d9da0",
    collapsible: true,
    hubs: [
      {
        key: "historique",
        label: "Historique de l'académie",
        icon: "list",
        description: "Récit, chiffres clés et chronologie de l'académie.",
        tabs: [{ href: "/admin/historique", label: "Historique", adminOnly: true }]
      },
      {
        key: "audit",
        label: "Journal d'audit",
        icon: "shield",
        description: "Toutes les modifications faites dans l'admin.",
        tabs: [{ href: "/admin/audit", label: "Journal d'audit", adminOnly: true }]
      },
      {
        key: "exports",
        label: "MonClubSportif",
        icon: "list",
        description: "Ce qui manque dans MonClubSportif (nouvelles inscrites, activités, retraits) et les fichiers d'export complets.",
        tabs: [
          { href: "/admin/monclubsportif", label: "À faire dans MonClubSportif", adminOnly: true },
          { href: "/admin/exports", label: "Exports complets", adminOnly: true }
        ]
      },
      {
        key: "ete-2026",
        label: "Été 2026 (saison passée)",
        icon: "archive",
        description: "Archives de la saison Été 2026 : inscriptions, joueuses, groupes, essais et clubs.",
        tabs: [
          { href: "/admin/dashboard", label: "Vue d'ensemble" },
          { href: "/admin/inscriptions", label: "Inscriptions" },
          { href: "/admin/joueuses", label: "Joueuses" },
          { href: "/admin/plages", label: "Plages" },
          { href: "/admin/capacite", label: "Capacité" },
          { href: "/admin/essais", label: "Essais" },
          { href: "/admin/clubs", label: "Clubs" }
        ]
      }
    ]
  }
];

/** Saison dans l'URL (/admin/saison/automne-hiver-2026/...), s'il y en a une. */
export function seasonFromPath(pathname: string): string | null {
  return pathname.match(/^\/admin\/saison\/([^/?#]+)/)?.[1] ?? null;
}

/** Résout `{saison}` : la saison de la page affichée, sinon la redirection vers la saison active. */
export function resolveHref(href: string, seasonId: string | null): string {
  if (!href.includes("{saison}")) return href;
  if (seasonId) return href.replace("{saison}", seasonId);
  const vue = href.split("{saison}")[1].replace(/^\//, "");
  return vue ? `/admin/saison?vue=${vue}` : "/admin/saison";
}

export const visibleTabs = (hub: AdminHub, role: string | null) => hub.tabs.filter((t) => !t.adminOnly || role === "admin");

/** Onglet (et son hub) le plus précis qui correspond à l'URL affichée. */
export function findActive(pathname: string, role: string | null): { hub: AdminHub; tab: AdminTab; href: string } | null {
  const seasonId = seasonFromPath(pathname);
  let best: { hub: AdminHub; tab: AdminTab; href: string } | null = null;
  for (const hub of [TODAY_HUB, ...ADMIN_NAV.flatMap((s) => s.hubs)]) {
    for (const tab of visibleTabs(hub, role)) {
      const href = resolveHref(tab.href, seasonId);
      if ((pathname === href || pathname.startsWith(`${href}/`)) && (!best || href.length > best.href.length)) best = { hub, tab, href };
    }
  }
  return best;
}
