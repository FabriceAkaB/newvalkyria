/** Progression en vidéo (JP, 19 nov. 2026) : chaque fille est filmée (ball mastery, gestes de la saison) à quelques
 *  moments de la saison, pour que la famille voie sa progression et qu'on montre un avant / après à la fin.
 *  Les petites (nées en 2016 et après) : début, milieu et fin de saison. Les grandes (2015 et avant) : milieu et fin.
 *  Règles pures. Vidéos d'enfants : stockage privé, vues seulement par la famille de la joueuse (Loi 25). */

export const CHECKPOINTS = [
  { key: "debut", label: "Début de saison" },
  { key: "mi", label: "Mi-saison" },
  { key: "fin", label: "Fin de saison" }
] as const;
export type Checkpoint = (typeof CHECKPOINTS)[number]["key"];
export const isCheckpoint = (v: unknown): v is Checkpoint => CHECKPOINTS.some((c) => c.key === v);
export const checkpointLabel = (k: string | null | undefined) => CHECKPOINTS.find((c) => c.key === k)?.label ?? (k || "Autre");

/** Les années de naissance d'une catégorie (« 2016 », « 2014-2013 », « 2016-2017 »). */
const yearsOf = (category: string | null | undefined) => (String(category ?? "").match(/20\d\d/g) ?? []).map(Number);

/** Les petites ont trois moments ; les 2015 et plus vieilles, deux (mi-saison et fin). */
export function checkpointsFor(category: string | null | undefined): Checkpoint[] {
  const years = yearsOf(category);
  const youngest = years.length ? Math.max(...years) : 2016;
  return youngest >= 2016 ? ["debut", "mi", "fin"] : ["mi", "fin"];
}

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** Quand filmer chaque moment : début = les 6 premières semaines ; mi-saison = autour du bulletin du 15 décembre ;
 *  fin = les 3 dernières semaines de la saison. */
export function checkpointWindow(season: { starts_on: string; ends_on: string }, cp: Checkpoint): { from: string; to: string } {
  const start = season.starts_on.slice(0, 10);
  const end = season.ends_on.slice(0, 10);
  if (cp === "debut") return { from: start, to: addDays(start, 42) };
  if (cp === "fin") return { from: addDays(end, -21), to: end };
  const year = Number(start.slice(0, 4));
  return { from: `${year}-12-01`, to: `${year}-12-20` };
}

/** Le moment à filmer en ce moment (ou le prochain), pour l'écran de l'admin. */
export function currentCheckpoint(season: { starts_on: string; ends_on: string }, today: string): Checkpoint {
  for (const c of CHECKPOINTS.map((x) => x.key)) if (today <= checkpointWindow(season, c).to) return c;
  return "fin";
}

/** Avant / après : la vidéo du premier moment filmé et celle du dernier, s'il y en a au moins deux différents. */
export function beforeAfter<T extends { checkpoint: string | null; createdAt: string }>(videos: T[]): { before: T; after: T } | null {
  const order = (k: string | null) => CHECKPOINTS.findIndex((c) => c.key === k);
  const sorted = videos.filter((v) => isCheckpoint(v.checkpoint)).sort((a, b) => order(a.checkpoint) - order(b.checkpoint) || a.createdAt.localeCompare(b.createdAt));
  if (!sorted.length) return null;
  const before = sorted[0];
  const after = [...sorted].reverse().find((v) => v.checkpoint !== before.checkpoint);
  return after ? { before, after } : null;
}

/* ── Toutes les vidéos d'une joueuse et demandes de vidéos du jour (JP, 25 nov. 2026) ──────────────────────────── */

/** Première journée de demande de vidéos : le groupe du jeudi 26 novembre 2026, puis chaque jour de pratique de filles. */
export const VIDEO_REQUESTS_START = "2026-11-26";

/** Étape facultative : « debut », « mi », « fin », ou rien (« Autre ») ; une valeur inconnue devient rien. */
export const parseCheckpoint = (v: unknown): Checkpoint | null => (isCheckpoint(v) ? v : null);

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
export const isIsoDay = (v: unknown): v is string => typeof v === "string" && ISO_DAY.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));

/** Une pratique de filles de l'Académie (jamais les garçons, jamais les activités hors Académie) entre dans la demande. */
export function isVideoRequestActivity(a: { activity_date: string; activity_type?: string | null; organization?: string | null; category?: string | null; title?: string | null }): boolean {
  if (String(a.activity_date).slice(0, 10) < VIDEO_REQUESTS_START) return false;
  if ((a.activity_type ?? "Pratique") !== "Pratique" || a.organization) return false;
  if (!a.category || /gar[cç]on/i.test(`${a.category} ${a.title ?? ""}`)) return false;
  return /^(filles|équipe)\b/i.test(String(a.category).trim());
}

/** L'étape proposée pour une vidéo filmée tel jour : celle dont c'est la période, si la fille a cette étape ; sinon rien. */
export function defaultCheckpointFor(season: { starts_on: string; ends_on: string } | null, day: string, category: string | null | undefined): Checkpoint | null {
  if (!season) return null;
  for (const c of checkpointsFor(category)) {
    const w = checkpointWindow(season, c);
    if (day >= w.from && day <= w.to) return c;
  }
  return null;
}

export type RequestStatus = "filmee" | "absente" | "a-filmer";

/** Où en est une fille dans la demande : filmée dès une capsule ; sinon absente si on l'a marquée absente, ou si
 *  MonClubSportif la dit absente et qu'on ne l'a pas remise présente ; sinon à filmer. */
export function requestStatus(input: { videos: number; mark: "absente" | "presente" | null; mcsStatus: string | null }): RequestStatus {
  if (input.videos > 0) return "filmee";
  if (input.mark === "absente") return "absente";
  if (input.mark === "presente") return "a-filmer";
  return input.mcsStatus === "absent" ? "absente" : "a-filmer";
}

export interface RequestSummary { total: number; filmed: number; absent: number; remaining: number; done: boolean }

export function summarizeRequest(statuses: RequestStatus[]): RequestSummary {
  const filmed = statuses.filter((s) => s === "filmee").length;
  const absent = statuses.filter((s) => s === "absente").length;
  const remaining = statuses.length - filmed - absent;
  return { total: statuses.length, filmed, absent, remaining, done: remaining === 0 };
}

/** « 12 sur 17 filmées, 2 absentes » (on ne compte pas les absentes dans les filles à filmer). */
export function summaryLabel(s: RequestSummary): string {
  const due = s.total - s.absent;
  const base = `${s.filmed} sur ${due} filmée${s.filmed > 1 ? "s" : ""}`;
  return s.absent ? `${base}, ${s.absent} absente${s.absent > 1 ? "s" : ""}` : base;
}

const frDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** La tâche de JP du jour (ref « videos-progression:<date> ») : ouverte tant qu'il reste des filles sans vidéo ni
 *  absence, cochée toute seule quand tout est fait. Rien à faire un jour sans demande. */
export function videoRequestTask(day: string, s: RequestSummary, groups: string[]): { ref: string; title: string; details: string; done: boolean } | null {
  if (!s.total) return null;
  return {
    ref: `videos-progression:${day}`,
    title: s.done ? `Vidéos de progression du ${frDay(day)} : tout est fait` : `Vidéos de progression du ${frDay(day)} : ${s.remaining} fille${s.remaining > 1 ? "s" : ""} sans vidéo`,
    details: `${groups.join(", ")}. ${summaryLabel(s)}. Déposer les capsules ou marquer « Absente ce jour-là » : Coaching › Progression › Demandes de vidéos du jour (/admin/coaching/progression-video/demandes?date=${day}). La tâche se coche toute seule quand chaque fille a sa vidéo ou est marquée absente.`,
    done: s.done
  };
}

/** Le jour à ouvrir : celui demandé ; sinon aujourd'hui s'il y a une demande ; sinon la prochaine ; sinon la dernière. */
export function pickRequestDay(days: string[], today: string, wanted?: string | null): string | null {
  const sorted = [...new Set(days)].sort();
  if (wanted && isIsoDay(wanted)) return wanted;
  if (!sorted.length) return null;
  return sorted.find((d) => d >= today) ?? sorted[sorted.length - 1];
}

/** Les vidéos d'une joueuse rangées par jour filmé, du plus récent au plus ancien. */
export function groupByDay<T extends { filmedOn: string | null; createdAt: string }>(videos: T[]): { day: string; videos: T[] }[] {
  const dayOf = (v: T) => v.filmedOn ?? v.createdAt.slice(0, 10);
  const days = [...new Set(videos.map(dayOf))].sort().reverse();
  return days.map((day) => ({ day, videos: videos.filter((v) => dayOf(v) === day).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) }));
}
