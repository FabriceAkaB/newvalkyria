import { randomBytes } from "node:crypto";

import { CLUB_ID } from "@/lib/club";
import { OWNER_NOTIFY_EMAIL } from "@/lib/email";
import { env } from "@/lib/env";
import { getResendClient } from "@/lib/resend";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Valkyria Lab, phase 1 (Mandalart P1.7.02, P1.7.12, automatisation AU08).
 *  Chaque mois : une routine maison (gestes avec courte vidéo de démonstration YouTube/Vimeo non répertoriée),
 *  un défi du mois et un jeu de la semaine. Chaque famille a un lien personnel (/lab/[token]) où elle voit la
 *  routine et envoie la vidéo de sa fille : le fichier va directement dans le bucket PRIVÉ « valkyria-lab »
 *  (lien de téléversement signé, il ne passe pas par le serveur), nommé Prénom-Nom_geste_AAAA-MM-JJ_maison.
 *  Le coach la regarde par un lien signé de 10 minutes et laisse un court commentaire à la famille.
 *  Mesure (indicateur familles_video_lab) : familles qui ont envoyé au moins une vidéo ce mois-ci ÷ familles actives.
 *  Loi 25 : les vidéos d'enfants ne quittent jamais le stockage privé ; seules les tables lab_* ont les prénoms. */

function db() {
  return getSupabaseAdminClient() as any;
}

export const LAB_BUCKET = "valkyria-lab";
/** Durée de vie du lien de lecture d'une vidéo dans l'admin (10 minutes). */
export const WATCH_SECONDS = 600;
/** Plafond du bucket (migration 20261115) : 300 Mo. */
export const BUCKET_MAX_MB = 300;
/** Vidéos qu'une famille peut envoyer dans une même journée (évite les envois en boucle). */
export const DAILY_UPLOAD_LIMIT = 15;
/** Objectif du plan : 50 % des familles actives envoient une vidéo par mois (condition de la phase 2). */
export const LAB_TARGET = 0.5;
export const CHALLENGE_GESTURE = "Défi du mois";
export const COMMENT_MAX = 280;

/** Taille maximale acceptée. Supabase applique aussi une limite globale au projet (50 Mo par défaut) :
 *  LAB_MAX_VIDEO_MB se règle dans Vercel une fois cette limite relevée (jusqu'à 300 Mo, le plafond du bucket). */
export function labMaxVideoBytes(): number {
  const mb = Number(process.env.LAB_MAX_VIDEO_MB ?? 50);
  const safe = Number.isFinite(mb) && mb > 0 ? Math.min(mb, BUCKET_MAX_MB) : 50;
  return Math.round(safe * 1024 * 1024);
}

// ─────────────────────────── Types ───────────────────────────

export interface LabExercise {
  name: string;
  how: string | null;
  videoUrl: string | null;
}

export interface LabGame {
  title: string;
  how: string | null;
  videoUrl: string | null;
}

export type RoutineStatus = "brouillon" | "publie";

export interface LabRoutine {
  id: string;
  month: string;
  title: string;
  instructions: string | null;
  exercises: LabExercise[];
  challenge: string | null;
  challenge_video_url: string | null;
  weekly_games: LabGame[];
  status: RoutineStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LabPlayer {
  firstName: string;
  lastName: string;
}

export interface LabAccess {
  id: string;
  token: string;
  parent_email: string;
  parent_name: string | null;
  players: LabPlayer[];
  season_id: string | null;
  active: boolean;
  sent_at: string | null;
  send_count: number;
  opened_at: string | null;
  last_seen_at: string | null;
  created_at: string;
}

export type SubmissionStatus = "a_voir" | "vu";

export interface LabSubmission {
  id: string;
  access_id: string;
  routine_id: string | null;
  player_name: string;
  gesture: string;
  storage_path: string;
  content_type: string | null;
  size_bytes: number | null;
  recorded_on: string;
  status: SubmissionStatus;
  coach_comment: string | null;
  seen_at: string | null;
  family_notified_at: string | null;
  created_at: string;
}

export interface LabSubmissionWithFamily extends LabSubmission {
  parentName: string | null;
  parentEmail: string | null;
}

// ─────────────────────────── Dates ───────────────────────────

const TZ = "America/Toronto";
export const todayIso = (d: Date = new Date()) => d.toLocaleDateString("en-CA", { timeZone: TZ });
export const monthOf = (iso: string) => iso.slice(0, 7);
const localDay = (ts: string) => todayIso(new Date(ts));

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** « novembre » */
export const monthName = (ym: string) => MONTHS[Number(ym.slice(5, 7)) - 1] ?? ym;
/** « novembre 2026 » */
export const monthTitle = (ym: string) => `${monthName(ym)} ${ym.slice(0, 4)}`;
/** « de novembre » / « d'avril », « d'août », « d'octobre » */
export const ofMonth = (ym: string) => (/^[aeiouyéèêâàô]/i.test(monthName(ym)) ? `d'${monthName(ym)}` : `de ${monthName(ym)}`);
/** « 2 nov. » */
export function shortDate(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${MONTHS_SHORT[m - 1]}`;
}

/** Semaine du mois (0 = du 1er au 7, … 4 = du 29 au 31). */
export const weekIndex = (iso: string) => Math.min(4, Math.floor((Number(iso.slice(8, 10)) - 1) / 7));

/** Jeu de la semaine : le jeu de la semaine en cours ; s'il y en a moins, le dernier sert jusqu'à la fin du mois. */
export function gameOfWeek(games: LabGame[], iso: string): { game: LabGame; week: number } | null {
  if (!games.length) return null;
  const i = Math.min(weekIndex(iso), games.length - 1);
  return { game: games[i], week: i + 1 };
}

// ─────────────────────────── Vidéos de démonstration (YouTube / Vimeo) ───────────────────────────

export interface VideoEmbed {
  provider: "youtube" | "vimeo";
  id: string;
  embedUrl: string;
  /** Format vertical (YouTube Shorts) : affiché en 9:16. */
  vertical: boolean;
}

/** Transforme un lien YouTube ou Vimeo (y compris non répertorié) en lecteur intégrable ; null si le lien n'est pas reconnu. */
export function videoEmbed(raw: string | null | undefined): VideoEmbed | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^www\.|^m\./, "");
  const ytId = (s: string | null | undefined) => (s && /^[A-Za-z0-9_-]{11}$/.test(s) ? s : null);
  if (host === "youtu.be" || host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    let id: string | null = null;
    let vertical = false;
    if (host === "youtu.be") id = ytId(parts[0]);
    else if (parts[0] === "watch") id = ytId(url.searchParams.get("v"));
    else if (parts[0] === "shorts") {
      id = ytId(parts[1]);
      vertical = true;
    } else if (parts[0] === "embed" || parts[0] === "live" || parts[0] === "v") id = ytId(parts[1]);
    if (!id) return null;
    return { provider: "youtube", id, embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`, vertical };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => /^\d{6,12}$/.test(p));
    if (idx < 0) return null;
    const id = parts[idx];
    // Vidéo non répertoriée : vimeo.com/123456789/abcdef1234 ou player.vimeo.com/video/123456789?h=abcdef1234
    const hash = url.searchParams.get("h") ?? (parts[idx + 1] && /^[0-9a-f]{6,20}$/i.test(parts[idx + 1]) ? parts[idx + 1] : null);
    return { provider: "vimeo", id, embedUrl: `https://player.vimeo.com/video/${id}?${hash ? `h=${hash}&` : ""}title=0&byline=0&portrait=0&dnt=1`, vertical: false };
  }
  return null;
}

// ─────────────────────────── Routine : validation ───────────────────────────

export interface RoutineInput {
  month: string;
  title: string;
  instructions?: string | null;
  exercises: { name: string; how?: string | null; videoUrl?: string | null }[];
  challenge?: string | null;
  challengeVideoUrl?: string | null;
  weeklyGames: { title: string; how?: string | null; videoUrl?: string | null }[];
}

export interface CleanRoutine {
  month: string;
  title: string;
  instructions: string | null;
  exercises: LabExercise[];
  challenge: string | null;
  challenge_video_url: string | null;
  weekly_games: LabGame[];
}

const clean = (s: string | null | undefined) => {
  const t = (s ?? "").replace(/\r\n/g, "\n").trim();
  return t ? t : null;
};

/** Nettoie la routine (lignes vides retirées) et refuse un lien vidéo qui n'est pas YouTube ou Vimeo. */
export function normalizeRoutine(input: RoutineInput): { ok: true; value: CleanRoutine } | { ok: false; error: string } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month)) return { ok: false, error: "Mois invalide." };
  const title = clean(input.title);
  if (!title) return { ok: false, error: "Donnez un titre à la routine." };
  const badLink = (url: string | null, where: string) => (url && !videoEmbed(url) ? `${where} : le lien vidéo doit être un lien YouTube ou Vimeo (non répertorié).` : null);
  const exercises: LabExercise[] = [];
  for (const [i, e] of input.exercises.entries()) {
    const name = clean(e.name);
    const how = clean(e.how);
    const videoUrl = clean(e.videoUrl);
    if (!name && !how && !videoUrl) continue;
    if (!name) return { ok: false, error: `Geste ${i + 1} : écrivez le nom du geste.` };
    const err = badLink(videoUrl, name);
    if (err) return { ok: false, error: err };
    exercises.push({ name, how, videoUrl });
  }
  const names = exercises.map((e) => e.name.toLowerCase());
  if (new Set(names).size !== names.length) return { ok: false, error: "Deux gestes ont le même nom : les familles ne pourraient pas les distinguer en envoyant leur vidéo." };
  if (names.includes(CHALLENGE_GESTURE.toLowerCase())) return { ok: false, error: `« ${CHALLENGE_GESTURE} » est réservé au défi : renommez ce geste.` };
  const challenge = clean(input.challenge);
  const challengeVideoUrl = clean(input.challengeVideoUrl);
  const cErr = badLink(challengeVideoUrl, "Défi du mois");
  if (cErr) return { ok: false, error: cErr };
  const games: LabGame[] = [];
  for (const [i, g] of input.weeklyGames.entries()) {
    const t = clean(g.title);
    const how = clean(g.how);
    const videoUrl = clean(g.videoUrl);
    if (!t && !how && !videoUrl) continue;
    if (!t) return { ok: false, error: `Jeu de la semaine ${i + 1} : écrivez le nom du jeu.` };
    const err = badLink(videoUrl, t);
    if (err) return { ok: false, error: err };
    games.push({ title: t, how, videoUrl });
  }
  return { ok: true, value: { month: input.month, title, instructions: clean(input.instructions), exercises, challenge, challenge_video_url: challengeVideoUrl, weekly_games: games } };
}

/** Ce qui manque pour publier : au moins un geste ou un défi, à montrer aux familles. */
export function publishProblems(r: Pick<CleanRoutine, "exercises" | "challenge">): string[] {
  const out: string[] = [];
  if (!r.exercises.length && !r.challenge) out.push("Ajoutez au moins un geste ou le défi du mois.");
  return out;
}

/** Gestes que la famille peut choisir en envoyant sa vidéo : les gestes de la routine, puis le défi du mois. */
export function gestureOptions(r: Pick<LabRoutine, "exercises" | "challenge"> | null): string[] {
  if (!r) return [];
  const out = r.exercises.map((e) => e.name);
  if (r.challenge) out.push(CHALLENGE_GESTURE);
  return out;
}

/** Routine à montrer aux familles : celle du mois si elle est publiée, sinon la plus récente publiée avant. */
export function pickRoutine<T extends Pick<LabRoutine, "month" | "status">>(routines: T[], month: string): { routine: T; current: boolean } | null {
  const published = routines.filter((r) => r.status === "publie" && r.month <= month).sort((a, b) => b.month.localeCompare(a.month));
  if (!published.length) return null;
  return { routine: published[0], current: published[0].month === month };
}

// ─────────────────────────── Noms de fichiers (Prénom-Nom_geste_AAAA-MM-JJ_maison) ───────────────────────────

/** Lettres sans accents, chiffres et tirets seulement (clés de stockage Supabase). */
export function asciiSlug(s: string): string {
  return s
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "Oe")
    .replace(/æ/g, "ae")
    .replace(/Æ/g, "Ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const playerSlug = (fullName: string) => asciiSlug(fullName).slice(0, 60).replace(/-+$/, "") || "Joueuse";
export const gestureSlug = (gesture: string) => asciiSlug(gesture).toLowerCase().slice(0, 40).replace(/-+$/, "") || "geste";

export const VIDEO_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  webm: "video/webm",
  "3gp": "video/3gpp",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska"
};
const EXT_BY_TYPE: Record<string, string> = Object.fromEntries(Object.entries(VIDEO_TYPES).map(([e, t]) => [t, e]));

/** Extension de la vidéo (d'après le nom, sinon le type) ; null si ce n'est pas une vidéo reconnue. */
export function videoExtension(fileName: string, mime: string | null | undefined): string | null {
  const ext = (fileName.match(/\.([A-Za-z0-9]{2,4})$/)?.[1] ?? "").toLowerCase();
  if (VIDEO_TYPES[ext]) return ext;
  const t = (mime ?? "").toLowerCase();
  if (EXT_BY_TYPE[t]) return EXT_BY_TYPE[t];
  if (t.startsWith("video/")) return "mp4";
  return null;
}

export const sizeLabel = (bytes: number) => (bytes >= 1024 * 1024 ? `${Math.round(bytes / (1024 * 1024)).toLocaleString("fr-CA")} Mo` : `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("fr-CA")} Ko`);

/** Vérifie le fichier choisi par la famille : une vidéo, pas vide, sous la limite. */
export function checkVideoFile(f: { name: string; type?: string | null; size: number }, maxBytes: number): { ok: true; ext: string; contentType: string } | { ok: false; error: string } {
  const type = (f.type ?? "").toLowerCase();
  const isVideoType = type.startsWith("video/");
  const ext = isVideoType ? videoExtension(f.name, type) : videoExtension(f.name, null);
  // Certains téléphones ne donnent pas le type : on se fie alors à l'extension (.mp4, .mov…).
  if (!ext || (type && !isVideoType && type !== "application/octet-stream")) return { ok: false, error: "Ce fichier n'est pas une vidéo. Choisissez une vidéo (MP4, MOV…)." };
  if (!(f.size > 0)) return { ok: false, error: "Ce fichier est vide." };
  if (f.size > maxBytes) return { ok: false, error: `Vidéo trop lourde (${sizeLabel(f.size)}) : ${sizeLabel(maxBytes)} maximum. Coupez-la pour garder seulement le geste, ou filmez en 1080p plutôt qu'en 4K.` };
  return { ok: true, ext, contentType: isVideoType ? type : VIDEO_TYPES[ext] };
}

/** « Lea-Tremblay_semelle_2026-11-02_maison » */
export const videoBaseName = (player: string, gesture: string, date: string) => `${playerSlug(player)}_${gestureSlug(gesture)}_${date}_maison`;

/** Nom libre dans le dossier de la joueuse : …_maison.mp4, puis …_maison-2.mp4, …_maison-3.mp4. */
export function nextVideoFileName(existing: string[], player: string, gesture: string, date: string, ext: string): string {
  const base = videoBaseName(player, gesture, date);
  const taken = new Set(existing.map((n) => n.replace(/\.[A-Za-z0-9]+$/, "")));
  if (!taken.has(base)) return `${base}.${ext}`;
  for (let n = 2; n < 100; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}.${ext}`;
  return `${base}-${Date.now()}.${ext}`;
}

/** Dossier privé de la joueuse : <famille>/<Prénom-Nom>. */
export const playerFolder = (accessId: string, player: string) => `${accessId}/${playerSlug(player)}`;

/** Vérifie qu'un chemin envoyé par le navigateur est bien celui préparé pour cette famille, cette joueuse et ce geste ; renvoie la date du nom. */
export function parseVideoPath(path: string, accessId: string, player: string, gesture: string): { date: string; fileName: string } | null {
  const folder = playerFolder(accessId, player);
  if (!path.startsWith(`${folder}/`)) return null;
  const fileName = path.slice(folder.length + 1);
  const exts = Object.keys(VIDEO_TYPES).join("|");
  const m = fileName.match(new RegExp(`^${playerSlug(player)}_${gestureSlug(gesture)}_(\\d{4}-\\d{2}-\\d{2})_maison(?:-\\d{1,13})?\\.(?:${exts})$`));
  return m ? { date: m[1], fileName } : null;
}

// ─────────────────────────── Familles ───────────────────────────

const titleCase = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (m) => m.toUpperCase());
export const playerFullName = (p: LabPlayer) => `${p.firstName} ${p.lastName}`.trim();

/** « Léa », « Léa et Emma », « Léa, Emma et Zoé » */
export function firstNames(players: LabPlayer[]): string {
  const names = players.map((p) => p.firstName).filter(Boolean);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}

export interface RegistrationLite {
  parent_email: string | null;
  parent_name: string | null;
  player_first_name: string | null;
  player_last_name: string | null;
  status: string | null;
  is_trial?: boolean | null;
  is_half_season?: boolean | null;
  half_season_ends_on?: string | null;
}

export interface LabFamily {
  email: string;
  parentName: string | null;
  players: LabPlayer[];
}

/** Familles actives : inscriptions payées (pas les essais, pas les demi-saisons terminées), regroupées par courriel du parent. */
export function familiesFromRegistrations(regs: RegistrationLite[], today: string): LabFamily[] {
  const map = new Map<string, LabFamily>();
  for (const r of regs) {
    if (r.status !== "paid" || r.is_trial) continue;
    if (r.is_half_season && r.half_season_ends_on && r.half_season_ends_on < today) continue;
    const email = String(r.parent_email ?? "").trim().toLowerCase();
    if (!email.includes("@")) continue;
    const fam = map.get(email) ?? { email, parentName: null, players: [] };
    if (!fam.parentName && r.parent_name?.trim()) fam.parentName = titleCase(r.parent_name);
    const firstName = titleCase(r.player_first_name ?? "");
    const lastName = titleCase(r.player_last_name ?? "");
    const key = asciiSlug(`${firstName} ${lastName}`).toLowerCase();
    if (firstName && !fam.players.some((p) => asciiSlug(playerFullName(p)).toLowerCase() === key)) fam.players.push({ firstName, lastName });
    map.set(email, fam);
  }
  return [...map.values()].filter((f) => f.players.length).sort((a, b) => (a.parentName ?? a.email).localeCompare(b.parentName ?? b.email, "fr"));
}

// ─────────────────────────── Mesure (familles_video_lab) ───────────────────────────

/** Familles actives qui ont envoyé au moins une vidéo dans le mois ÷ familles actives. */
export function familyRate(activeEmails: string[], sends: { email: string | null; created_at: string }[], month: string): { active: number; sent: number; rate: number | null } {
  const active = new Set(activeEmails.map((e) => e.toLowerCase()));
  const sent = new Set<string>();
  for (const s of sends) {
    const e = (s.email ?? "").toLowerCase();
    if (active.has(e) && monthOf(localDay(s.created_at)) === month) sent.add(e);
  }
  return { active: active.size, sent: sent.size, rate: active.size ? sent.size / active.size : null };
}

/** Les derniers mois (du plus récent au plus ancien) : familles, vidéos et taux. */
export function monthlyHistory(activeEmails: string[], sends: { email: string | null; created_at: string }[], month: string, count: number) {
  const out: { month: string; families: number; videos: number; rate: number | null }[] = [];
  for (let i = 0; i < count; i++) {
    const m = addMonths(month, -i);
    const r = familyRate(activeEmails, sends, m);
    out.push({ month: m, families: r.sent, videos: sends.filter((s) => monthOf(localDay(s.created_at)) === m).length, rate: r.rate });
  }
  return out;
}

export const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)} %`);

// ─────────────────────────── Accès aux données ───────────────────────────

const routineFrom = (r: any): LabRoutine => ({
  ...r,
  exercises: Array.isArray(r.exercises) ? r.exercises : [],
  weekly_games: Array.isArray(r.weekly_games) ? r.weekly_games : []
});
const accessFrom = (a: any): LabAccess => ({ ...a, players: Array.isArray(a.players) ? a.players : [] });

export async function listRoutines(): Promise<LabRoutine[]> {
  const { data, error } = await db().from("lab_routines").select("*").eq("club_id", CLUB_ID).order("month", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(routineFrom);
}

/** Enregistre la routine d'un mois (une seule par mois) ; publish = la montrer aux familles. */
export async function saveRoutine(input: RoutineInput, publish: boolean | null): Promise<LabRoutine> {
  const n = normalizeRoutine(input);
  if (!n.ok) throw new Error(n.error);
  if (publish) {
    const problems = publishProblems(n.value);
    if (problems.length) throw new Error(problems.join(" "));
  }
  const { data: existing } = await db().from("lab_routines").select("id, status, published_at").eq("club_id", CLUB_ID).eq("month", n.value.month).maybeSingle();
  const now = new Date().toISOString();
  const status: RoutineStatus = publish === null ? (existing?.status ?? "brouillon") : publish ? "publie" : "brouillon";
  const row = { ...n.value, club_id: CLUB_ID, status, published_at: status === "publie" ? (existing?.published_at ?? now) : null, updated_at: now };
  const { data, error } = existing
    ? await db().from("lab_routines").update(row).eq("id", existing.id).select("*").single()
    : await db().from("lab_routines").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return routineFrom(data);
}

export async function setRoutineStatus(id: string, status: RoutineStatus): Promise<void> {
  const { data: r } = await db().from("lab_routines").select("*").eq("id", id).eq("club_id", CLUB_ID).maybeSingle();
  if (!r) throw new Error("Routine introuvable");
  if (status === "publie") {
    const problems = publishProblems(routineFrom(r));
    if (problems.length) throw new Error(problems.join(" "));
  }
  const now = new Date().toISOString();
  const { error } = await db()
    .from("lab_routines")
    .update({ status, published_at: status === "publie" ? (r.published_at ?? now) : null, updated_at: now })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Supprime un brouillon (une routine publiée doit d'abord être retirée). */
export async function deleteRoutine(id: string): Promise<void> {
  const { data: r } = await db().from("lab_routines").select("status").eq("id", id).eq("club_id", CLUB_ID).maybeSingle();
  if (!r) return;
  if (r.status === "publie") throw new Error("Retirez d'abord la routine de la page des familles.");
  const { error } = await db().from("lab_routines").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Familles actives de la saison en cours (toutes les saisons actives), d'après les inscriptions payées. */
export async function getActiveFamilies(today = todayIso()): Promise<{ seasonId: string; families: LabFamily[] }> {
  const { data: seasons } = await db().from("seasons").select("id").eq("is_active", true).order("id", { ascending: true });
  const ids: string[] = (seasons ?? []).map((s: any) => String(s.id));
  if (!ids.length) ids.push("automne-hiver-2026");
  const seasonId = ids[0];
  const { data, error } = await db()
    .from("registrations")
    .select("parent_email, parent_name, player_first_name, player_last_name, status, is_trial, is_half_season, half_season_ends_on")
    .in("season_id", ids)
    .eq("status", "paid");
  if (error) throw new Error(error.message);
  return { seasonId, families: familiesFromRegistrations(data ?? [], today) };
}

export async function listAccess(): Promise<LabAccess[]> {
  const { data, error } = await db().from("lab_access").select("*").eq("club_id", CLUB_ID).order("parent_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(accessFrom);
}

/** « Créer les liens des familles » : un lien par famille active ; met à jour les joueuses des familles existantes
 *  et désactive le lien des familles qui ne sont plus inscrites (réactivé si elles reviennent). */
export async function syncFamilies(today = todayIso()): Promise<{ created: number; updated: number; deactivated: number; total: number }> {
  const [{ seasonId, families }, existing] = await Promise.all([getActiveFamilies(today), listAccess()]);
  const byEmail = new Map(existing.map((a) => [a.parent_email.toLowerCase(), a]));
  const now = new Date().toISOString();
  const toInsert: any[] = [];
  let updated = 0;
  for (const f of families) {
    const a = byEmail.get(f.email);
    if (!a) {
      toInsert.push({ club_id: CLUB_ID, token: randomBytes(12).toString("base64url"), parent_email: f.email, parent_name: f.parentName, players: f.players, season_id: seasonId, active: true });
      continue;
    }
    const same = a.active && a.season_id === seasonId && (a.parent_name ?? null) === (f.parentName ?? a.parent_name ?? null) && JSON.stringify(a.players) === JSON.stringify(f.players);
    if (same) continue;
    const { error } = await db()
      .from("lab_access")
      .update({ parent_name: f.parentName ?? a.parent_name, players: f.players, season_id: seasonId, active: true, updated_at: now })
      .eq("id", a.id);
    if (error) throw new Error(error.message);
    updated++;
  }
  if (toInsert.length) {
    const { error } = await db().from("lab_access").insert(toInsert);
    if (error) throw new Error(error.message);
  }
  const current = new Set(families.map((f) => f.email));
  const stale = existing.filter((a) => a.active && !current.has(a.parent_email.toLowerCase()));
  if (stale.length) {
    const { error } = await db().from("lab_access").update({ active: false, updated_at: now }).in("id", stale.map((a) => a.id));
    if (error) throw new Error(error.message);
  }
  return { created: toInsert.length, updated, deactivated: stale.length, total: families.length };
}

export async function setAccessActive(id: string, active: boolean): Promise<void> {
  const { error } = await db().from("lab_access").update({ active, updated_at: new Date().toISOString() }).eq("id", id).eq("club_id", CLUB_ID);
  if (error) throw new Error(error.message);
}

export const labLink = (token: string) => `${env.publicSiteUrl}/lab/${token}`;

export interface FamilyLinkRow {
  access: LabAccess;
  link: string;
  /** Famille encore inscrite (inscription payée de la saison en cours). */
  enrolled: boolean;
  videosThisMonth: number;
  lastVideoAt: string | null;
}

/** Écran « Liens des familles » : un lien par famille, ce qui a été envoyé et ouvert, les vidéos du mois,
 *  et les familles inscrites qui n'ont pas encore de lien. */
export async function getFamilyLinks(today = todayIso()): Promise<{
  month: string;
  rows: FamilyLinkRow[];
  missing: LabFamily[];
  routine: { month: string; title: string; current: boolean } | null;
  counts: { active: number; unsent: number; sent: number; opened: number; withVideo: number };
}> {
  const month = monthOf(today);
  const [{ families }, access, routines, subs] = await Promise.all([
    getActiveFamilies(today),
    listAccess(),
    listRoutines(),
    db().from("lab_submissions").select("access_id, created_at").eq("club_id", CLUB_ID).gte("created_at", `${addMonths(month, -1)}-01`).order("created_at", { ascending: false })
  ]);
  const enrolled = new Set(families.map((f) => f.email));
  const active = access.filter((a) => a.active);
  const withLink = new Set(active.map((a) => a.parent_email.toLowerCase()));
  const sendsByAccess = new Map<string, string[]>();
  for (const s of (subs.data ?? []) as { access_id: string; created_at: string }[]) sendsByAccess.set(s.access_id, [...(sendsByAccess.get(s.access_id) ?? []), s.created_at]);
  const rows: FamilyLinkRow[] = access.map((a) => {
    const sends = sendsByAccess.get(a.id) ?? [];
    return {
      access: a,
      link: labLink(a.token),
      enrolled: enrolled.has(a.parent_email.toLowerCase()),
      videosThisMonth: sends.filter((t) => monthOf(localDay(t)) === month).length,
      lastVideoAt: sends[0] ?? null
    };
  });
  const sortKey = (r: FamilyLinkRow) => (r.access.parent_name ?? r.access.parent_email).toLocaleLowerCase("fr");
  rows.sort((x, y) => Number(y.access.active) - Number(x.access.active) || sortKey(x).localeCompare(sortKey(y), "fr"));
  const picked = pickRoutine(routines, month);
  return {
    month,
    rows,
    missing: families.filter((f) => !withLink.has(f.email)),
    routine: picked ? { month: picked.routine.month, title: picked.routine.title, current: picked.current } : null,
    counts: {
      active: active.length,
      unsent: active.filter((a) => !a.sent_at).length,
      sent: active.filter((a) => a.sent_at).length,
      opened: active.filter((a) => a.opened_at).length,
      withVideo: rows.filter((r) => r.access.active && r.videosThisMonth > 0).length
    }
  };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const button = (href: string, label: string) =>
  `<p style="margin:28px 0"><a href="${href}" style="background:#5b2a86;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:bold;display:inline-block">${esc(label)}</a></p>`;
const wrap = (inner: string) => `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#161419;max-width:600px">${inner}</div>`;
const firstWord = (s: string | null) => (s ?? "").trim().split(/\s+/)[0] ?? "";

/** Courriel du lien personnel (premier envoi ou nouvelle routine du mois). */
export function linkEmail(access: Pick<LabAccess, "token" | "parent_name" | "players">, routine: Pick<LabRoutine, "month" | "title" | "challenge"> | null) {
  const first = firstWord(access.parent_name);
  const kids = firstNames(access.players);
  const subject = routine ? `Valkyria Lab : la routine maison ${ofMonth(routine.month)}` : "Valkyria Lab : votre lien personnel";
  const html = wrap(`
    <p>Bonjour${first ? ` ${esc(first)}` : ""},</p>
    <p>${routine ? `La routine maison ${ofMonth(routine.month)} est en ligne : <strong>${esc(routine.title)}</strong>.` : "Le Valkyria Lab est ouvert."} Chaque mois, ${kids ? esc(kids) : "votre fille"} y trouve des gestes à pratiquer à la maison avec une courte vidéo de démonstration, le défi du mois et le jeu de la semaine.</p>
    ${routine?.challenge ? `<p><strong>Le défi ${ofMonth(routine.month)} :</strong> ${esc(routine.challenge)}</p>` : ""}
    <p>Quand elle est prête, filmez-la et touchez <strong>« Envoyer ma vidéo »</strong> : son coach la regarde et vous laisse un commentaire.</p>
    ${button(labLink(access.token), kids ? `Ouvrir le Valkyria Lab de ${kids}` : "Ouvrir le Valkyria Lab")}
    <p style="color:#555;font-size:14px">Ce lien est personnel à votre famille et reste le même tous les mois : gardez-le dans vos favoris. Les vidéos sont privées : seuls les coachs de New Valkyria les voient.</p>`);
  return { subject, html };
}

/** Envoie le lien aux familles : celles qui ne l'ont jamais reçu, toutes les familles actives, ou une liste précise. */
export async function sendLabLinks(opts: { scope: "unsent" | "all" | "ids"; ids?: string[] }, today = todayIso()): Promise<{ sent: number; failed: number }> {
  const routines = await listRoutines();
  const picked = pickRoutine(routines, monthOf(today));
  if (!picked) throw new Error("Publiez d'abord une routine : le lien montrerait une page vide.");
  let targets = (await listAccess()).filter((a) => a.active);
  if (opts.scope === "unsent") targets = targets.filter((a) => !a.sent_at);
  if (opts.scope === "ids") targets = targets.filter((a) => (opts.ids ?? []).includes(a.id));
  const resend = getResendClient();
  let sent = 0;
  let failed = 0;
  for (const a of targets) {
    const { subject, html } = linkEmail(a, picked.routine);
    try {
      const { error } = await resend.emails.send({ from: env.resendFrom, to: a.parent_email, subject, html });
      if (error) throw new Error(error.message);
      await db().from("lab_access").update({ sent_at: new Date().toISOString(), send_count: (a.send_count ?? 0) + 1 }).eq("id", a.id);
      sent++;
    } catch (err) {
      console.error("Valkyria Lab : envoi du lien échoué", a.parent_email, err);
      failed++;
    }
  }
  return { sent, failed };
}

// ── Page famille ──

export interface FamilyView {
  access: LabAccess;
  routine: LabRoutine | null;
  routineIsCurrent: boolean;
  gestures: string[];
  submissions: LabSubmission[];
  month: string;
}

async function getAccessByToken(token: string): Promise<LabAccess | null> {
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(token)) return null;
  const { data } = await db().from("lab_access").select("*").eq("token", token).eq("club_id", CLUB_ID).maybeSingle();
  return data ? accessFrom(data) : null;
}

/** Tout ce que la famille voit sur sa page ; note la visite (première ouverture, dernière visite). */
export async function getFamilyView(token: string, today = todayIso(), opts: { track?: boolean } = {}): Promise<FamilyView | { inactive: true } | null> {
  const access = await getAccessByToken(token);
  if (!access) return null;
  if (!access.active) return { inactive: true };
  const month = monthOf(today);
  const [routines, subs] = await Promise.all([
    listRoutines(),
    db().from("lab_submissions").select("*").eq("access_id", access.id).order("created_at", { ascending: false }).limit(40)
  ]);
  const picked = pickRoutine(routines, month);
  if (opts.track !== false) {
    const now = new Date().toISOString();
    await db().from("lab_access").update(access.opened_at ? { last_seen_at: now } : { opened_at: now, last_seen_at: now }).eq("id", access.id);
  }
  return {
    access,
    routine: picked?.routine ?? null,
    routineIsCurrent: picked?.current ?? false,
    gestures: gestureOptions(picked?.routine ?? null),
    submissions: subs.data ?? [],
    month
  };
}

async function resolveUpload(token: string, player: string, gesture: string, today: string) {
  const access = await getAccessByToken(token);
  if (!access || !access.active) throw new Error("Ce lien n'est plus actif. Écrivez-nous à info@newvalkyria.com.");
  const p = access.players.find((x) => playerFullName(x) === player);
  if (!p) throw new Error("Choisissez la joueuse.");
  const routines = await listRoutines();
  const picked = pickRoutine(routines, monthOf(today));
  if (!picked) throw new Error("La routine du mois n'est pas encore en ligne.");
  if (!gestureOptions(picked.routine).includes(gesture)) throw new Error("Choisissez le geste filmé.");
  return { access, player: playerFullName(p), routine: picked.routine };
}

/** Étape 1 de « Envoyer ma vidéo » : vérifie la demande et prépare un lien de téléversement signé vers le dossier privé de la joueuse. */
export async function startUpload(
  token: string,
  input: { player: string; gesture: string; fileName: string; size: number; type: string | null },
  today = todayIso()
): Promise<{ path: string; signedUrl: string; contentType: string }> {
  const { access, player } = await resolveUpload(token, input.player, input.gesture, today);
  const check = checkVideoFile({ name: input.fileName, type: input.type, size: input.size }, labMaxVideoBytes());
  if (!check.ok) throw new Error(check.error);
  const { count } = await db().from("lab_submissions").select("id", { count: "exact", head: true }).eq("access_id", access.id).eq("recorded_on", today);
  if ((count ?? 0) >= DAILY_UPLOAD_LIMIT) throw new Error(`Vous avez déjà envoyé ${DAILY_UPLOAD_LIMIT} vidéos aujourd'hui. Merci ! Réessayez demain.`);
  const folder = playerFolder(access.id, player);
  const { data: files } = await db().storage.from(LAB_BUCKET).list(folder, { limit: 1000 });
  const fileName = nextVideoFileName((files ?? []).map((f: any) => String(f.name)), player, input.gesture, today, check.ext);
  const path = `${folder}/${fileName}`;
  const { data, error } = await db().storage.from(LAB_BUCKET).createSignedUploadUrl(path);
  if (error || !data?.signedUrl) throw new Error("Le téléversement n'a pas pu être préparé. Réessayez dans un instant.");
  return { path, signedUrl: data.signedUrl, contentType: check.contentType };
}

/** Étape 2 : la vidéo est arrivée dans le stockage ; on l'enregistre et on avise JP. */
export async function completeUpload(token: string, input: { path: string; player: string; gesture: string }, today = todayIso()): Promise<{ id: string }> {
  const { access, player, routine } = await resolveUpload(token, input.player, input.gesture, today);
  const parsed = parseVideoPath(input.path, access.id, player, input.gesture);
  if (!parsed) throw new Error("Envoi invalide. Recommencez.");
  const { data: dup } = await db().from("lab_submissions").select("id").eq("storage_path", input.path).maybeSingle();
  if (dup) return { id: dup.id };
  const folder = playerFolder(access.id, player);
  const { data: files } = await db().storage.from(LAB_BUCKET).list(folder, { limit: 100, search: parsed.fileName });
  const file = (files ?? []).find((f: any) => f.name === parsed.fileName);
  if (!file) throw new Error("La vidéo n'est pas arrivée. Vérifiez votre connexion et réessayez.");
  const { data: row, error } = await db()
    .from("lab_submissions")
    .insert({
      club_id: CLUB_ID,
      access_id: access.id,
      routine_id: routine.id,
      player_name: player,
      gesture: input.gesture,
      storage_path: input.path,
      content_type: file.metadata?.mimetype ?? null,
      size_bytes: file.metadata?.size ?? null,
      recorded_on: parsed.date
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      const { data: again } = await db().from("lab_submissions").select("id").eq("storage_path", input.path).maybeSingle();
      if (again) return { id: again.id };
    }
    throw new Error(error.message);
  }
  try {
    await notifyOwner(access, player, input.gesture, parsed.date);
  } catch (err) {
    console.error("Valkyria Lab : avis à JP échoué", err);
  }
  return { id: row.id };
}

async function notifyOwner(access: LabAccess, player: string, gesture: string, date: string) {
  const { count } = await db().from("lab_submissions").select("id", { count: "exact", head: true }).eq("club_id", CLUB_ID).eq("status", "a_voir");
  const html = wrap(`
    <p><strong>${esc(player)}</strong> a envoyé une vidéo « ${esc(gesture)} » le ${esc(shortDate(date))}${access.parent_name ? ` (famille ${esc(access.parent_name)})` : ""}.</p>
    <p>${count ?? 1} vidéo${(count ?? 1) > 1 ? "s" : ""} à regarder dans le Valkyria Lab.</p>
    ${button(`${env.publicSiteUrl}/admin/valkyria-lab`, "Regarder les vidéos")}`);
  const { error } = await getResendClient().emails.send({ from: env.resendFrom, to: OWNER_NOTIFY_EMAIL, subject: `Valkyria Lab : nouvelle vidéo de ${player} (${gesture})`, html });
  if (error) throw new Error(error.message);
}

// ── Admin : vidéos reçues ──

export async function listSubmissions(opts: { status?: SubmissionStatus; limit?: number } = {}): Promise<LabSubmissionWithFamily[]> {
  let q = db().from("lab_submissions").select("*, access:lab_access(parent_name, parent_email)").eq("club_id", CLUB_ID);
  if (opts.status) q = q.eq("status", opts.status);
  q = q.order("created_at", { ascending: opts.status === "a_voir" }).limit(opts.limit ?? 500);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(({ access, ...s }: any) => ({ ...s, parentName: access?.parent_name ?? null, parentEmail: access?.parent_email ?? null }));
}

/** Lien de lecture signé (10 minutes) ; download = lien qui télécharge le fichier sous son nom. */
export async function watchUrl(id: string, download = false): Promise<string> {
  const { data: s } = await db().from("lab_submissions").select("storage_path").eq("id", id).eq("club_id", CLUB_ID).maybeSingle();
  if (!s) throw new Error("Vidéo introuvable");
  const name = String(s.storage_path).split("/").pop();
  const { data, error } = await db().storage.from(LAB_BUCKET).createSignedUrl(s.storage_path, WATCH_SECONDS, download ? { download: name } : undefined);
  if (error || !data?.signedUrl) throw new Error("La vidéo est introuvable dans le stockage.");
  return data.signedUrl;
}

/** Courriel à la famille quand le coach a vu la vidéo et laissé un commentaire. */
export function commentEmail(access: Pick<LabAccess, "token" | "parent_name">, s: Pick<LabSubmission, "player_name" | "gesture" | "coach_comment">) {
  const first = firstWord(access.parent_name);
  const kid = firstWord(s.player_name);
  const subject = `Valkyria Lab : le coach a vu la vidéo de ${kid}`;
  const html = wrap(`
    <p>Bonjour${first ? ` ${esc(first)}` : ""},</p>
    <p>Le coach a regardé la vidéo « ${esc(s.gesture)} » de ${esc(kid)} :</p>
    <blockquote style="margin:16px 0;padding:12px 16px;border-left:4px solid #5b2a86;background:#f5f1fa;border-radius:6px">${esc(s.coach_comment ?? "")}</blockquote>
    <p>Bravo pour le travail à la maison !</p>
    ${button(labLink(access.token), "Voir le Valkyria Lab")}`);
  return { subject, html };
}

/** Marque la vidéo « vue » avec un commentaire court ; notify = l'envoyer aussi à la famille par courriel. */
export async function markSeen(id: string, comment: string | null, notify: boolean): Promise<{ notified: boolean }> {
  const text = clean(comment);
  if (text && text.length > COMMENT_MAX) throw new Error(`Commentaire trop long (${COMMENT_MAX} caractères maximum).`);
  const { data: s } = await db().from("lab_submissions").select("*, access:lab_access(token, parent_name, parent_email)").eq("id", id).eq("club_id", CLUB_ID).maybeSingle();
  if (!s) throw new Error("Vidéo introuvable");
  const now = new Date().toISOString();
  const { error } = await db().from("lab_submissions").update({ status: "vu", coach_comment: text, seen_at: now }).eq("id", id);
  if (error) throw new Error(error.message);
  if (!notify || !text || !s.access?.parent_email) return { notified: false };
  const { subject, html } = commentEmail(s.access, { ...s, coach_comment: text });
  const { error: mailErr } = await getResendClient().emails.send({ from: env.resendFrom, to: s.access.parent_email, subject, html });
  if (mailErr) throw new Error(`Vidéo marquée vue, mais le courriel n'est pas parti : ${mailErr.message}`);
  await db().from("lab_submissions").update({ family_notified_at: now }).eq("id", id);
  return { notified: true };
}

export async function markUnseen(id: string): Promise<void> {
  const { error } = await db().from("lab_submissions").update({ status: "a_voir", seen_at: null }).eq("id", id).eq("club_id", CLUB_ID);
  if (error) throw new Error(error.message);
}

/** Supprime la vidéo (fichier et ligne), par exemple à la demande de la famille (Loi 25) ou si elle a été envoyée par erreur. */
export async function deleteSubmission(id: string): Promise<void> {
  const { data: s } = await db().from("lab_submissions").select("storage_path").eq("id", id).eq("club_id", CLUB_ID).maybeSingle();
  if (!s) return;
  const { error: rmErr } = await db().storage.from(LAB_BUCKET).remove([s.storage_path]);
  if (rmErr) throw new Error(rmErr.message);
  const { error } = await db().from("lab_submissions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Vue d'ensemble, indicateur et « Aujourd'hui » ──

export interface LabOverview {
  today: string;
  month: string;
  activeFamilies: number;
  familiesWithVideo: number;
  rate: number | null;
  videosThisMonth: number;
  toWatch: LabSubmissionWithFamily[];
  recentlySeen: LabSubmissionWithFamily[];
  history: { month: string; families: number; videos: number; rate: number | null }[];
  routine: LabRoutine | null;
  nextRoutine: LabRoutine | null;
  /** La routine que les familles voient en ce moment (celle du mois, sinon la plus récente publiée). */
  shownRoutine: { month: string; title: string; current: boolean } | null;
  links: { total: number; sent: number; opened: number; missing: number };
}

/** Familles actives (courriels) et envois (courriel de la famille + date) : la base de la mesure. */
async function measureBase(today: string) {
  const [{ families }, subs] = await Promise.all([
    getActiveFamilies(today),
    db().from("lab_submissions").select("created_at, access:lab_access(parent_email)").eq("club_id", CLUB_ID).gte("created_at", `${addMonths(monthOf(today), -6)}-01`)
  ]);
  const sends = (subs.data ?? []).map((s: any) => ({ email: s.access?.parent_email ?? null, created_at: s.created_at as string }));
  return { families, sends };
}

export async function getLabOverview(today = todayIso()): Promise<LabOverview> {
  const month = monthOf(today);
  const [{ families, sends }, routines, toWatch, seen, access] = await Promise.all([
    measureBase(today),
    listRoutines(),
    listSubmissions({ status: "a_voir" }),
    listSubmissions({ status: "vu", limit: 30 }),
    listAccess()
  ]);
  const emails = families.map((f) => f.email);
  const r = familyRate(emails, sends, month);
  const shown = pickRoutine(routines, month);
  const activeAccess = access.filter((a) => a.active);
  const withLink = new Set(activeAccess.map((a) => a.parent_email.toLowerCase()));
  return {
    today,
    month,
    activeFamilies: r.active,
    familiesWithVideo: r.sent,
    rate: r.rate,
    videosThisMonth: sends.filter((s: { created_at: string }) => monthOf(localDay(s.created_at)) === month).length,
    toWatch,
    recentlySeen: seen,
    history: monthlyHistory(emails, sends, month, 6),
    routine: routines.find((x) => x.month === month) ?? null,
    nextRoutine: routines.find((x) => x.month === addMonths(month, 1)) ?? null,
    shownRoutine: shown ? { month: shown.routine.month, title: shown.routine.title, current: shown.current } : null,
    links: {
      total: activeAccess.length,
      sent: activeAccess.filter((a) => a.sent_at).length,
      opened: activeAccess.filter((a) => a.opened_at).length,
      missing: emails.filter((e) => !withLink.has(e)).length
    }
  };
}

/** Indicateur Mandalart familles_video_lab (en %) : familles actives qui ont envoyé au moins une vidéo ce mois-ci. */
export async function getLabKpi(today = todayIso()): Promise<{ value: number | null; note: string }> {
  const month = monthOf(today);
  const { families, sends } = await measureBase(today);
  const r = familyRate(families.map((f) => f.email), sends, month);
  const prev = familyRate(families.map((f) => f.email), sends, addMonths(month, -1));
  return {
    value: r.rate === null ? null : Math.round(r.rate * 1000) / 10,
    note: `${r.sent} famille${r.sent > 1 ? "s" : ""} sur ${r.active} ${r.sent > 1 ? "ont" : "a"} envoyé au moins une vidéo en ${monthTitle(month)}${prev.sent ? ` (${monthName(addMonths(month, -1))} : ${prev.sent})` : ""} · objectif 50 % (/admin/valkyria-lab).`
  };
}

export interface LabTodayItem {
  title: string;
  detail?: string | null;
  meta?: string | null;
  href?: string | null;
}

/** Lignes pour « Aujourd'hui » : vidéos à regarder, routine du mois à publier, routine du mois prochain à préparer
 *  (règle d'anticipation : à partir du 20), familles qui n'ont pas reçu leur lien. */
export async function getLabTodayItems(today = todayIso()): Promise<{ level: "orange" | "info"; items: LabTodayItem[] }> {
  const month = monthOf(today);
  const next = addMonths(month, 1);
  const [routines, toWatch, access] = await Promise.all([listRoutines(), listSubmissions({ status: "a_voir", limit: 50 }), listAccess()]);
  const items: LabTodayItem[] = toWatch.map((s) => ({
    title: `Regarder la vidéo de ${s.player_name}`,
    detail: `${s.gesture}${s.parentName ? ` · famille ${s.parentName}` : ""}`,
    meta: `Reçue le ${shortDate(localDay(s.created_at))}`,
    href: `/admin/valkyria-lab#v-${s.id}`
  }));
  const cur = routines.find((r) => r.month === month);
  if (cur?.status !== "publie") {
    items.push({ title: `Publier la routine maison ${ofMonth(month)}`, detail: cur ? "Elle est encore en brouillon : les familles ne la voient pas." : "Pas encore écrite : les familles voient la routine du mois passé.", href: `/admin/valkyria-lab/routine?mois=${month}` });
  }
  if (Number(today.slice(8, 10)) >= 20 && routines.find((r) => r.month === next)?.status !== "publie") {
    items.push({ title: `Préparer la routine ${ofMonth(next)}`, detail: `À publier avant le 1er ${monthName(next)}.`, href: `/admin/valkyria-lab/routine?mois=${next}` });
  }
  if (pickRoutine(routines, month)) {
    const unsent = access.filter((a) => a.active && !a.sent_at).length;
    const withLink = new Set(access.filter((a) => a.active).map((a) => a.parent_email.toLowerCase()));
    const missing = (await getActiveFamilies(today).catch(() => ({ families: [] as LabFamily[] }))).families.filter((f) => !withLink.has(f.email)).length;
    if (missing) items.push({ title: `Créer le lien du Lab de ${missing} famille${missing > 1 ? "s" : ""} inscrite${missing > 1 ? "s" : ""}`, detail: "Nouvelles inscriptions payées sans lien personnel.", href: "/admin/valkyria-lab/familles" });
    if (unsent) items.push({ title: `Envoyer le lien du Lab à ${unsent} famille${unsent > 1 ? "s" : ""}`, detail: "Elles n'ont pas encore reçu leur lien personnel.", href: "/admin/valkyria-lab/familles" });
  }
  return { level: items.length ? "orange" : "info", items };
}
