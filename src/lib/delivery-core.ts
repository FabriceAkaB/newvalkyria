/** Promesses tenues (demande de JP, 6 nov. 2026) : une « barre de protection » qui compare, groupe par groupe et
 *  joueuse par joueuse, ce qui a été vendu (le nombre de pratiques promises par chaque programme) à ce qui est donné,
 *  à venir et annulé dans MonClubSportif. Un écart = des séances à remettre (reprise, rabais ou crédit).
 *  Calculs purs, testés ; les données viennent de `delivery-repo.ts` (table `delivery_events`, relue chaque jour). */

/** Pratiques techniques semi-privé promises par programme de saison (offre 2026-2027, `season-2027.ts`). */
export const TECH_PROMISE: Record<string, number> = { TV: 20, TVA: 20, NV: 20, SV: 15, SVA: 15, TVD: 10 };
/** Pratiques d'équipe promises (équipes de matchs). */
export const TEAM_PROMISE: Record<string, number> = { TV: 10, TVA: 10, SV: 10, SVA: 10, TVD: 5 };
/** Séances individuelles promises (Solo). */
export const SOLO_PROMISE: Record<string, number> = { SV: 5, SVA: 5 };

export type GroupKind = "technique" | "equipe" | "solo" | "programme";

export const GROUP_KIND_LABEL: Record<GroupKind, string> = {
  technique: "Pratiques techniques",
  equipe: "Pratiques d'équipe",
  solo: "Séances solo",
  programme: "Programme à dates fixes"
};

export interface DeliveryEvent {
  id: number;
  title: string;
  /** AAAA-MM-JJ ; null = date inconnue (considérée passée). */
  date: string | null;
  kind: "pratique" | "match";
  cancelled: boolean;
}

export interface PlayerPromise {
  name: string;
  program: string;
  promised: number;
  /** Demi-saison : dernière date couverte. */
  until: string | null;
}

export interface PlayerDelivery extends PlayerPromise {
  given: number;
  upcoming: number;
  /** Ce qui manque une fois tout l'horaire prévu donné (> 0 = à remettre). */
  shortfall: number;
}

export interface GroupDelivery {
  teamName: string;
  kind: GroupKind;
  given: number;
  upcoming: number;
  cancelled: { date: string | null; title: string }[];
  promised: number;
  shortfall: number;
  players: PlayerDelivery[];
}

/** « Match », « Tournoi », « vs » : pas une pratique. */
export function eventKind(title: string): "pratique" | "match" {
  return /\b(match|tournoi|partie|vs\.?|contre)\b/i.test(title) ? "match" : "pratique";
}

/** Annulée dans MonClubSportif (titre « ANNULÉE : … » ou « [Annulé] »). */
export function isCancelled(title: string): boolean {
  return /^\s*(\[)?\s*annul/i.test(title.normalize("NFD").replace(/[̀-ͯ]/g, ""));
}

/** Le bilan d'un groupe : chaque joueuse reçoit-elle ce qu'elle a acheté ? */
export function computeGroup(teamName: string, kind: GroupKind, events: DeliveryEvent[], players: PlayerPromise[], today: string): GroupDelivery {
  const practices = events.filter((e) => e.kind === "pratique");
  const live = practices.filter((e) => !e.cancelled);
  const isPast = (e: DeliveryEvent) => !e.date || e.date < today;
  const count = (until: string | null) => {
    const mine = live.filter((e) => !until || !e.date || e.date <= until);
    return { given: mine.filter(isPast).length, upcoming: mine.filter((e) => !isPast(e)).length };
  };
  const all = count(null);
  const rows = players.map((p) => {
    const c = count(p.until);
    return { ...p, ...c, shortfall: Math.max(0, p.promised - c.given - c.upcoming) };
  });
  const promised = Math.max(0, ...rows.filter((r) => !r.until).map((r) => r.promised));
  return {
    teamName,
    kind,
    given: all.given,
    upcoming: all.upcoming,
    cancelled: practices.filter((e) => e.cancelled).map((e) => ({ date: e.date, title: e.title })),
    promised,
    shortfall: Math.max(0, ...rows.map((r) => r.shortfall)),
    players: rows.sort((a, b) => b.shortfall - a.shortfall || a.name.localeCompare(b.name, "fr"))
  };
}

/** Ce qu'une joueuse a acheté pour ce type de groupe (0 = rien de promis ici). Demi-saison : la moitié. */
export function promiseFor(kind: GroupKind, program: string, half: boolean, programPractices?: number | null): number {
  const p = half && program !== "TVD" ? "TVD" : program;
  if (kind === "technique") return TECH_PROMISE[p] ?? 0;
  if (kind === "equipe") return TEAM_PROMISE[p] ?? 0;
  if (kind === "solo") return half ? Math.ceil((SOLO_PROMISE[program] ?? 0) / 2) : SOLO_PROMISE[program] ?? 0;
  return programPractices ?? 0;
}
