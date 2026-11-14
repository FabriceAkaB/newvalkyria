/** Parcours client décortiqué (règles pures, testées) : un arbre étape par étape, de la découverte à la réinscription.
 *  Chaque nœud dit qui agit (la famille, l'académie, une automatisation), ce à quoi la famille a droit, ou un choix
 *  (une branche). Le point de départ reprend le parcours Valkyria (parcours-valkyria.ts) et ce que chaque programme
 *  inclut (season-2027.ts) ; ensuite tout se bonifie dans l'admin (table customer_journey_nodes). */

import { PARCOURS_FAMILLE, type ItemStatus } from "@/lib/parcours-valkyria";
import { PROGRAMS } from "@/lib/season-2027";

export type NodeKind = "etape" | "famille" | "droit" | "academie" | "auto" | "choix";
export const NODE_KINDS: { id: NodeKind; label: string; icon: string }[] = [
  { id: "etape", label: "Étape", icon: "📍" },
  { id: "famille", label: "La famille fait", icon: "👨‍👩‍👧" },
  { id: "droit", label: "Elle a droit à", icon: "🎁" },
  { id: "academie", label: "L'académie fait", icon: "🧑‍🏫" },
  { id: "auto", label: "Automatique", icon: "⚙️" },
  { id: "choix", label: "Choix / branche", icon: "🔀" }
];
export const kindOf = (k: string) => NODE_KINDS.find((x) => x.id === k) ?? NODE_KINDS[0];
export const STATUSES: { id: ItemStatus; label: string }[] = [
  { id: "en-place", label: "En place" },
  { id: "en-cours", label: "En cours" },
  { id: "prevu", label: "Prévu" }
];

export interface JourneyNode {
  id: string;
  parent_id: string | null;
  sort_order: number;
  kind: NodeKind;
  title: string;
  detail: string | null;
  status: ItemStatus;
  where_ref: string | null;
}
export interface JourneyTree extends JourneyNode {
  children: JourneyTree[];
}

/** De la liste à plat à l'arbre, dans l'ordre (les nœuds orphelins remontent à la racine). */
export function buildTree(nodes: JourneyNode[]): JourneyTree[] {
  const byId = new Map(nodes.map((n) => [n.id, { ...n, children: [] as JourneyTree[] }]));
  const roots: JourneyTree[] = [];
  for (const n of byId.values()) {
    const parent = n.parent_id ? byId.get(n.parent_id) : null;
    (parent ? parent.children : roots).push(n);
  }
  const sort = (xs: JourneyTree[]) => {
    xs.sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title, "fr"));
    xs.forEach((x) => sort(x.children));
  };
  sort(roots);
  return roots;
}

export function countByStatus(nodes: JourneyNode[]): Record<ItemStatus, number> {
  const out: Record<ItemStatus, number> = { "en-place": 0, "en-cours": 0, prevu: 0 };
  for (const n of nodes) if (n.kind !== "etape" && n.kind !== "choix") out[n.status]++;
  return out;
}

/** L'arbre de départ (gabarit) : la base qu'on bonifie ensuite dans l'admin. */
export interface SeedNode {
  kind: NodeKind;
  title: string;
  detail?: string;
  status?: ItemStatus;
  where?: string;
  children?: SeedNode[];
}

const fromParcours = (i: number): SeedNode[] =>
  PARCOURS_FAMILLE[i].items.map((it) => ({ kind: /courriel|confirmation|prélevé|robot|automatique/i.test(it.text) ? "auto" : "academie", title: it.text, status: it.status, where: it.where }));

const programBranch = (code: keyof typeof PROGRAMS, note?: string): SeedNode => {
  const p = PROGRAMS[code];
  return {
    kind: "choix",
    title: `${p.name} (${p.priceLabel})`,
    detail: note ?? p.tagline,
    children: p.includes.map((t) => ({ kind: "droit" as const, title: t }))
  };
};

export const JOURNEY_SEED: SeedNode[] = [
  {
    kind: "etape",
    title: "1. Découverte",
    detail: "Avant le premier contact : comment la famille entend parler de nous.",
    children: [
      { kind: "famille", title: "Voit une vidéo, une publication, une affiche, ou entend parler de nous par une amie", where: "/admin/reseaux" },
      ...fromParcours(0)
    ]
  },
  {
    kind: "etape",
    title: "2. Essai gratuit",
    detail: "Une pratique gratuite pour voir si elle aime.",
    children: [
      { kind: "famille", title: "Remplit le formulaire d'essai (joueuse, groupe, date, « comment nous avez-vous connus ? »)", where: "/inscription/essai" },
      { kind: "auto", title: "Courriel de confirmation : date, heure, lieu, quoi apporter" },
      { kind: "academie", title: "L'éducatrice voit l'essai dans son briefing et l'accueille", where: "Portail des éducateurs" },
      { kind: "droit", title: "1 pratique gratuite dans son groupe d'âge" },
      {
        kind: "choix",
        title: "Après l'essai",
        children: [
          { kind: "choix", title: "Elle s'inscrit", detail: "→ étape 3", children: [{ kind: "academie", title: "Lien de paiement envoyé (complet, en versements, bourse si accordée)", where: "skill paiement" }] },
          {
            kind: "choix",
            title: "Elle hésite ou ne s'inscrit pas",
            children: [
              { kind: "academie", title: "Relance personnelle, notée dans le journal des relances", where: "/admin/relances" },
              { kind: "academie", title: "Offre spéciale à date limite (lien personnel)", where: "/offre/[lien]" }
            ]
          }
        ]
      }
    ]
  },
  {
    kind: "etape",
    title: "3. Inscription et choix du programme",
    detail: "La famille choisit le programme, le groupe et la façon de payer.",
    children: [
      {
        kind: "choix",
        title: "Choix du programme",
        children: [programBranch("NV"), programBranch("TV"), programBranch("SV"), programBranch("TVA", "Sur invitation : le groupe avancé (l'Académie)."), programBranch("SVA")]
      },
      {
        kind: "choix",
        title: "Façon de payer",
        children: [
          { kind: "droit", title: "Paiement complet en ligne" },
          { kind: "droit", title: "Versements prélevés automatiquement", detail: "Un versement refusé : nouvel essai, puis lien de paiement." },
          { kind: "droit", title: "Bourse Valkyria (jusqu'à la moitié du prix)", status: "en-cours" }
        ]
      },
      { kind: "auto", title: "Courriel de confirmation d'Annie avec le reçu" },
      { kind: "auto", title: "Robot MonClubSportif : ajout à ses équipes, invitation de la famille, calendrier, photo", where: "/admin/monclubsportif/robot" }
    ]
  },
  { kind: "etape", title: "4. Accueil (semaine 1)", detail: "Ce qui doit marquer la famille dès le début.", children: fromParcours(2) },
  {
    kind: "etape",
    title: "5. La saison",
    detail: "Chaque semaine, de septembre à avril.",
    children: [
      ...fromParcours(3),
      { kind: "droit", title: "Matchs et pratiques d'équipe (programmes Team et Solo)", where: "MonClubSportif" },
      { kind: "droit", title: "Vidéos des matchs dans l'espace famille", where: "/compte/matchs" },
      { kind: "famille", title: "Répond au sondage de fin sur la borne iPad (5 questions sur 10)", where: "Coaching · Sondage de fin" },
      { kind: "famille", title: "Propose une idée dans la boîte à idées", where: "/compte/idees" },
      { kind: "droit", title: "Valkyria Lab : la routine maison du mois", status: "en-cours", where: "/admin/valkyria-lab" }
    ]
  },
  { kind: "etape", title: "6. Fin de saison et suite", detail: "Garder la famille pour l'été et la saison suivante.", children: fromParcours(4) }
];
