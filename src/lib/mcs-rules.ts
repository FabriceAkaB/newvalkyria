/** Les règles du lien entre l'académie et MonClubSportif, propres à chaque club (enregistrées en base, modifiables dans
 *  l'admin) : ce qui doit se passer tout seul dès qu'une joueuse paie, les rappels de présence, les photos.
 *  Règles pures (sans base de données), testées ; la lecture et l'écriture sont dans `mcs-rules-repo.ts`. */

export interface McsRules {
  /** Le robot agit pour vrai seulement une fois activé par JP ; avant, il montre ce qu'il ferait (mode assistant). */
  robotActive: boolean;
  /** Dès le paiement : la joueuse est ajoutée dans ses équipes MonClubSportif et le parent reçoit l'invitation. */
  inviteOnPaid: boolean;
  /** La joueuse ajoutée reçoit tout le calendrier de l'équipe (pratiques et matchs). */
  assignAllEvents: boolean;
  /** Sa photo (si on l'a) est mise sur son profil MonClubSportif, par défaut. */
  photoAuto: boolean;
  /** Le nom du club adverse est écrit sur le match dès qu'il paie sa plage. */
  opponentOnPaid: boolean;
  /** Le calendrier du site (plages et programmes) est recopié dans MonClubSportif : pratiques ajoutées, heures corrigées. */
  calendarSync: boolean;
  /** Les familles peuvent mettre ou changer la présence en tout temps (aucun verrou avant un match ou une pratique). */
  presenceAlwaysEditable: boolean;
  /** Rappels aux familles qui n'ont pas mis leur présence : X heures avant, puis à ces heures le jour même.
   *  `channel` : « mcs » = notification MonClubSportif (publication privée, sans courriel ; choix de JP le 6 nov. 2026)
   *  ou « courriel ». */
  reminders: { active: boolean; hoursBefore: number[]; sameDayHours: number[]; channel: "mcs" | "courriel" };
  /** Joueuse remboursée : la retirer de MonClubSportif seulement après validation de JP (par défaut), toute seule, ou jamais. */
  removeOnRefund: "validation" | "auto" | "jamais";
  /** Programme du site → niveau de l'équipe de matchs (ex. Team Valkyria Avancé → AV). */
  matchLevelByProgram: Record<string, "AV" | "INT">;
  /** Personnes (nom affiché dans MCS) assignées à TOUTES les activités de toutes les équipes, même absentes :
   *  la direction voit ainsi tout dans son calendrier MonClubSportif. */
  alwaysAssigned: string[];
  /** Personnes indiquées « présentes » par défaut à toutes les activités à partir d'une date (si elles n'ont rien mis). */
  defaultPresent: { name: string; from: string }[];
  /** Personnes rangées dans la section « Autre personnel » (pas « Entraîneurs ») dans chaque équipe. */
  staffNames: string[];
  /** Seules ces personnes peuvent avoir « Accès à la gestion de l'équipe » ; le robot retire ce droit à tous les autres. */
  managers: string[];
}

export const DEFAULT_MCS_RULES: McsRules = {
  robotActive: false,
  inviteOnPaid: true,
  assignAllEvents: true,
  photoAuto: true,
  opponentOnPaid: true,
  calendarSync: true,
  presenceAlwaysEditable: true,
  reminders: { active: true, hoursBefore: [48, 24], sameDayHours: [9, 15], channel: "mcs" },
  removeOnRefund: "validation",
  matchLevelByProgram: { TVA: "AV", SVA: "AV", TV: "INT", SV: "INT", TVD: "INT" },
  alwaysAssigned: ["Jean-Paul Aka Boidi"],
  defaultPresent: [{ name: "Jean-Paul Aka Boidi", from: "2026-11-09" }],
  staffNames: ["Alexandre Ali-Ngindu"],
  managers: ["Jean-Paul Aka Boidi", "Annie Tremblay", "Christine Durand"]
};

const hours = (v: unknown, max: number) =>
  Array.isArray(v)
    ? [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= max))].sort((a, b) => b - a)
    : null;

const names = (v: unknown[]) => [...new Set(v.map((n) => String(n ?? "").trim().replace(/\s+/g, " ")).filter((n) => n.length >= 3 && n.length <= 80))].slice(0, 10);

/** Fusionne des règles enregistrées (même partielles ou anciennes) avec les valeurs par défaut, en refusant le n'importe quoi. */
export function normalizeRules(input: unknown): McsRules {
  const r = (input && typeof input === "object" ? input : {}) as Partial<McsRules> & Record<string, any>;
  const bool = (k: keyof McsRules) => (typeof r[k] === "boolean" ? (r[k] as boolean) : (DEFAULT_MCS_RULES[k] as boolean));
  const rem = (r.reminders ?? {}) as Partial<McsRules["reminders"]>;
  const levels: Record<string, "AV" | "INT"> = {};
  for (const [k, v] of Object.entries(r.matchLevelByProgram ?? DEFAULT_MCS_RULES.matchLevelByProgram)) if ((v === "AV" || v === "INT") && /^[A-Z0-9-]{1,12}$/.test(k)) levels[k] = v;
  return {
    robotActive: bool("robotActive"),
    inviteOnPaid: bool("inviteOnPaid"),
    assignAllEvents: bool("assignAllEvents"),
    photoAuto: bool("photoAuto"),
    opponentOnPaid: bool("opponentOnPaid"),
    calendarSync: bool("calendarSync"),
    presenceAlwaysEditable: bool("presenceAlwaysEditable"),
    reminders: {
      active: typeof rem.active === "boolean" ? rem.active : DEFAULT_MCS_RULES.reminders.active,
      hoursBefore: hours(rem.hoursBefore, 336) ?? DEFAULT_MCS_RULES.reminders.hoursBefore,
      sameDayHours: (hours(rem.sameDayHours, 23) ?? DEFAULT_MCS_RULES.reminders.sameDayHours).sort((a, b) => a - b),
      channel: rem.channel === "courriel" ? "courriel" : "mcs"
    },
    removeOnRefund: r.removeOnRefund === "auto" || r.removeOnRefund === "jamais" ? r.removeOnRefund : "validation",
    matchLevelByProgram: levels,
    alwaysAssigned: Array.isArray(r.alwaysAssigned)
      ? [...new Set(r.alwaysAssigned.map((n: unknown) => String(n ?? "").trim().replace(/\s+/g, " ")).filter((n: string) => n.length >= 3 && n.length <= 80))].slice(0, 10)
      : DEFAULT_MCS_RULES.alwaysAssigned,
    defaultPresent: Array.isArray(r.defaultPresent)
      ? r.defaultPresent.map((d: any) => ({ name: names([d?.name])[0] ?? "", from: /^\d{4}-\d{2}-\d{2}$/.test(String(d?.from)) ? String(d.from) : "" })).filter((d: { name: string; from: string }) => d.name && d.from).slice(0, 10)
      : DEFAULT_MCS_RULES.defaultPresent,
    staffNames: Array.isArray(r.staffNames) ? names(r.staffNames) : DEFAULT_MCS_RULES.staffNames,
    managers: Array.isArray(r.managers) && names(r.managers).length ? names(r.managers) : DEFAULT_MCS_RULES.managers
  };
}

/* ── Rappels de présence ─────────────────────────────────────────── */

/** Les moments de rappel d'un événement (en ms), du plus tôt au plus tard, avec leur clé. `localDayStart` = minuit
 *  du jour de l'événement à l'heure du club (ms). */
export function reminderMoments(startMs: number, localDayStartMs: number, rules: McsRules): { key: string; at: number }[] {
  const out: { key: string; at: number }[] = [];
  for (const h of rules.reminders.hoursBefore) out.push({ key: `${h}h`, at: startMs - h * 3_600_000 });
  for (const h of rules.reminders.sameDayHours) {
    const at = localDayStartMs + h * 3_600_000;
    if (at < startMs) out.push({ key: `jour-${h}h`, at });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Le rappel à envoyer maintenant pour cet événement : le dernier moment déjà passé, s'il date de moins de `graceMs`
 *  (le cron passe chaque heure ; un rappel manqué de plus longtemps n'est pas envoyé en retard). Null s'il n'y en a pas. */
export function dueReminder(startMs: number, localDayStartMs: number, nowMs: number, rules: McsRules, graceMs = 3 * 3_600_000): string | null {
  if (!rules.reminders.active || nowMs >= startMs) return null;
  const passed = reminderMoments(startMs, localDayStartMs, rules).filter((m) => m.at <= nowMs);
  const last = passed.at(-1);
  return last && nowMs - last.at <= graceMs ? last.key : null;
}

/* ── Qui va dans quelle équipe MonClubSportif ────────────────────── */

export interface TeamTarget {
  id: string;
  name: string;
  kind: "pratique" | "match" | "programme";
  birth_years: number[];
  slot_ids: string[];
  program_ids: string[];
  session_program_slugs: string[];
  mcs_team_id: number | null;
  mcs_season_id: number | null;
}

export interface Enrolled {
  /** Inscription de saison : plage horaire, programme et années de la catégorie. */
  slotId?: string | null;
  programId?: string | null;
  years?: number[];
  /** Programme à dates fixes (garçons, privés…). */
  sessionProgramSlug?: string | null;
}

/** Les années d'une catégorie écrite librement (« 2014–2013 », « 2017-2018 », « 2015 »). */
export function yearsOf(label: string | null | undefined): number[] {
  const ys = [...String(label ?? "").matchAll(/20\d{2}/g)].map((m) => Number(m[0]));
  if (ys.length === 2) {
    const [a, b] = ys.sort((x, y) => x - y);
    return Array.from({ length: b - a + 1 }, (_, i) => a + i);
  }
  return ys;
}

/** Les équipes MonClubSportif où doit être la joueuse : son groupe de pratique (plage horaire), son équipe de matchs
 *  (programme et années) ou son programme à dates fixes. Une équipe sans numéro MCS est ignorée. */
export function teamsFor(e: Enrolled, teams: TeamTarget[]): TeamTarget[] {
  return teams.filter((t) => {
    if (!t.mcs_team_id || !t.mcs_season_id) return false;
    if (e.sessionProgramSlug) return t.session_program_slugs.includes(e.sessionProgramSlug);
    if (e.slotId && t.slot_ids.includes(e.slotId)) return true;
    if (t.kind === "match" && e.programId && t.program_ids.includes(e.programId)) return (e.years ?? []).some((y) => t.birth_years.includes(y));
    if (t.kind === "programme" && e.programId && t.program_ids.includes(e.programId)) return true;
    return false;
  });
}

/** Comparaison de noms MonClubSportif ↔ site (accents, majuscules et espaces ignorés). */
export const personKey = (first: unknown, last: unknown) =>
  `${first ?? ""} ${last ?? ""}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Le même jeune dans MonClubSportif et sur le site, même si le nom diffère un peu : même prénom (premier mot)
 *  et au moins un mot du nom de famille en commun (« Isabella Batista » = « Isabella Batista Maceirinha »). */
export function sameMemberName(mcsName: string, first: string, last: string): boolean {
  const a = personKey(mcsName, "").split(" ").filter(Boolean);
  const f = personKey(first, "").split(" ").filter(Boolean);
  const l = personKey(last, "").split(" ").filter((w) => w.length > 1);
  if (!a.length || !f.length) return false;
  if (a.join(" ") === [...f, ...l].join(" ")) return true;
  if (a[0] === f[0] && l.some((w) => a.slice(1).includes(w))) return true;
  // Prénom et nom inversés dans le site (« Afanador Reyes » / « Gabriella » = « Gabriella Rojas Afanador ») :
  // le prénom de MonClubSportif est dans le nom du site et un autre mot du nom est commun.
  const site = new Set([...f, ...l].filter((w) => w.length > 1));
  return site.has(a[0]) && !f.includes(a[0]) && a.slice(1).some((w) => w.length > 1 && site.has(w));
}

/** État d'une présence MonClubSportif → statut de présence du site (rien si la famille n'a pas répondu ou hésite). */
export function attendanceFromMcs(state: string | undefined): "present" | "late" | "absent" | null {
  return state === "present" ? "present" : state === "late" ? "late" : state === "absent" ? "absent" : null;
}

/* ── Calendrier : site → MonClubSportif ──────────────────────────── */

export interface SiteEvent {
  date: string;
  start: string;
  end: string | null;
  title: string;
  location: string;
}
export interface McsCalEvent {
  id: number;
  date: string;
  start: string;
  end: string | null;
  title: string;
  isPractice: boolean;
}
export interface CalendarDiff {
  create: SiteEvent[];
  retime: { id: number; from: string; to: SiteEvent }[];
  extra: McsCalEvent[];
}

const minOf = (t: string | null) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : NaN);

/** Ce qu'il faut faire dans MonClubSportif pour qu'une équipe ait exactement les pratiques prévues dans le site :
 *  créer celles qui manquent, corriger l'heure de celles qui ont bougé (même jour, une seule pratique de chaque côté),
 *  et signaler les pratiques MonClubSportif qui ne sont plus dans le site (jamais supprimées toutes seules). Les
 *  matchs et autres événements MonClubSportif ne sont jamais touchés. */
export function calendarDiff(site: SiteEvent[], mcs: McsCalEvent[]): CalendarDiff {
  const out: CalendarDiff = { create: [], retime: [], extra: [] };
  const used = new Set<number>();
  const leftSite: SiteEvent[] = [];
  for (const s of site) {
    const same = mcs.find((m) => !used.has(m.id) && m.date === s.date && Math.abs(minOf(m.start) - minOf(s.start)) <= 15);
    if (!same) {
      leftSite.push(s);
      continue;
    }
    used.add(same.id);
    if (same.isPractice && Math.abs(minOf(same.start) - minOf(s.start)) > 0 || (same.isPractice && s.end && same.end && Math.abs(minOf(same.end) - minOf(s.end)) > 5))
      out.retime.push({ id: same.id, from: `${same.start}–${same.end ?? ""}`, to: s });
  }
  for (const s of leftSite) {
    const daySite = leftSite.filter((x) => x.date === s.date);
    const dayMcs = mcs.filter((m) => !used.has(m.id) && m.isPractice && m.date === s.date);
    if (daySite.length === 1 && dayMcs.length === 1) {
      used.add(dayMcs[0].id);
      out.retime.push({ id: dayMcs[0].id, from: `${dayMcs[0].start}–${dayMcs[0].end ?? ""}`, to: s });
    } else out.create.push(s);
  }
  out.extra = mcs.filter((m) => !used.has(m.id) && m.isPractice);
  return out;
}

/** Clé « cette personne est dans cette équipe MCS » (marque `membre-robot` dans mcs_sync_items). */
export const memberTeamKey = (personKeyValue: string, teamId: string) => `${personKeyValue}|${teamId}`;

export interface PendingMcsPlayer {
  key: string;
  name: string;
  parentEmail: string | null;
  createdAt: string;
  missingTeams: string[];
}

/** Joueuses payées depuis `sinceIso` qui ne sont pas encore (vues ou ajoutées par le robot) dans toutes leurs équipes MCS.
 *  C'est la liste qui ne doit jamais rester pleine : Aujourd'hui la montre en rouge et JP reçoit un avis après le paiement. */
export function pendingMcsPlayers(
  players: { key: string; firstName: string; lastName: string; parentEmail: string | null; createdAt: string | null; teams: { id: string; name: string }[] }[],
  inMcs: Set<string>,
  sinceIso: string
): PendingMcsPlayer[] {
  return players
    .filter((p) => p.createdAt && p.createdAt >= sinceIso)
    .map((p) => ({ key: p.key, name: `${p.firstName} ${p.lastName}`.trim(), parentEmail: p.parentEmail, createdAt: p.createdAt!, missingTeams: p.teams.filter((t) => !inMcs.has(memberTeamKey(p.key, t.id))).map((t) => t.name) }))
    .filter((p) => p.missingTeams.length > 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
