/** Invitations à l'avancé (JP, 18 nov. 2026) : quand des filles du groupe avancé annoncent d'avance leur absence dans
 *  MonClubSportif, on invite autant de filles du groupe intermédiaire du même âge à prendre leur place. Toujours de
 *  l'intermédiaire vers l'avancé, jamais l'inverse. C'est la promesse faite aux parents : les filles de
 *  l'intermédiaire sont poussées vers l'avancé pour progresser. Règles pures. */

export interface InviteSettings {
  /** Nombre d'absences à partir duquel on invite (une seule absence : on n'invite pas). */
  threshold: number;
  /** Jours d'avance regardés dans MonClubSportif. */
  horizonDays: number;
  enabled: boolean;
}
export const INVITE_DEFAULTS: InviteSettings = { threshold: 2, horizonDays: 7, enabled: true };

export function inviteSettings(raw: unknown): InviteSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const n = (v: unknown, d: number, min: number, max: number) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Math.round(Number(v)))) : d);
  return { threshold: n(r.threshold, INVITE_DEFAULTS.threshold, 1, 10), horizonDays: n(r.horizonDays, INVITE_DEFAULTS.horizonDays, 1, 21), enabled: r.enabled !== false };
}

/** Statuts d'une invitation : proposée (attend la confirmation de JP), envoyée au parent, acceptée, refusée, expirée, annulée. */
export type InviteStatus = "proposee" | "envoyee" | "acceptee" | "refusee" | "expiree" | "annulee";
/** Invitations qui occupent une place (on n'en propose pas d'autres pour ces places). */
export const ACTIVE_INVITES: InviteStatus[] = ["proposee", "envoyee", "acceptee"];

/** Combien de filles inviter : autant que d'absentes, à partir du seuil, moins les invitations déjà en cours. */
export function invitesNeeded(absent: number, active: number, threshold: number): number {
  if (absent < threshold) return 0;
  return Math.max(0, absent - active);
}

export interface Candidate {
  registrationId: string;
  name: string;
  /** Rang épinglé par JP dans la liste de priorités (1 = la première), null sinon. */
  pinned: number | null;
  /** Invitations envoyées cette saison (rotation : chacune son tour). */
  invites: number;
  /** Moyenne des évaluations des 60 derniers jours (ball mastery, prestation, attitude, sur 5). */
  evalAvg: number | null;
  /** Présence aux pratiques des 60 derniers jours, de 0 à 1. */
  attendance: number | null;
}

/** L'ordre des priorités, cohérent et expliqué : 1. les filles épinglées par JP, dans son ordre ; 2. celles qui ont
 *  été le moins invitées (chacune son tour) ; 3. les meilleures évaluations ; 4. la meilleure présence ; 5. le prénom. */
export function rankCandidates<T extends Candidate>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    if (a.pinned != null || b.pinned != null) {
      if (a.pinned == null) return 1;
      if (b.pinned == null) return -1;
      if (a.pinned !== b.pinned) return a.pinned - b.pinned;
    }
    if (a.invites !== b.invites) return a.invites - b.invites;
    const ev = (b.evalAvg ?? -1) - (a.evalAvg ?? -1);
    if (Math.abs(ev) > 0.05) return ev;
    const at = (b.attendance ?? -1) - (a.attendance ?? -1);
    if (Math.abs(at) > 0.01) return at;
    return a.name.localeCompare(b.name, "fr");
  });
}

/** Pourquoi elle est à ce rang, en mots simples. */
export function rankReason(c: Candidate): string {
  const parts: string[] = [];
  if (c.pinned != null) parts.push(`priorité ${c.pinned} choisie par JP`);
  parts.push(c.invites ? `invitée ${c.invites} fois cette saison` : "pas encore invitée");
  if (c.evalAvg != null) parts.push(`évaluations ${c.evalAvg.toLocaleString("fr-CA", { maximumFractionDigits: 1 })}/5`);
  if (c.attendance != null) parts.push(`présence ${Math.round(c.attendance * 100)} %`);
  return parts.join(" · ");
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
/** Deux plages qui se chevauchent le même jour (une fille ne peut pas être à deux pratiques en même temps). */
export function overlaps(a: { day: string; start: string; end: string | null }, b: { day: string; start: string; end: string | null }): boolean {
  if (a.day.toLowerCase() !== b.day.toLowerCase()) return false;
  const aEnd = a.end ? toMin(a.end) : toMin(a.start) + 90;
  const bEnd = b.end ? toMin(b.end) : toMin(b.start) + 90;
  return toMin(a.start) < bEnd && toMin(b.start) < aEnd;
}

const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
export const dayName = (iso: string) => JOURS[new Date(`${iso}T12:00:00Z`).getUTCDay()];

/** Seulement les pratiques de semaine (JP, 18 nov. 2026) : jamais le samedi ni le dimanche. Lundi 18 h, l'avancé des
 *  petites (2016-2017) ; mercredi 19 h 30, l'avancé 2014-2015. */
export const isWeekday = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return d >= 1 && d <= 5;
};
