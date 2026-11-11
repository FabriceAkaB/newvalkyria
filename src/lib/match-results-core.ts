/** Section Matchs (Mandalart P1.8.05 à P1.8.07) : règles pures, sans base de données.
 *  Utilisées par le serveur (src/lib/match-results.ts), les pages /admin/matchs/resultats
 *  et les composants client (pastilles, lien vidéo), et testées dans match-results-core.test.ts. */

export type MatchStatus = "scheduled" | "live" | "completed" | "cancelled";
export type MatchPhase = "a_venir" | "aujourdhui" | "joue" | "annule";
export type Outcome = "V" | "N" | "D";

export interface MatchAnalysis {
  /** Ce qui a bien marché (comment on a gagné, ce qui a fonctionné). */
  strengths: string;
  /** Ce qu'il faut corriger. */
  fixes: string;
  /** Actions pour les prochaines pratiques. */
  actions: string;
}

/** Un match tel qu'affiché dans « Nos matchs » : activité Match/Tournoi d'Entraînements,
 *  plage vendue de Vente de matchs, ou les deux reliées (même match). */
export interface MatchCard {
  /** Identifiant dans l'adresse : l'activité si elle existe, sinon la plage vendue. */
  id: string;
  activityId: string | null;
  slotId: string | null;
  kind: "Match" | "Tournoi";
  date: string;
  start: string | null;
  end: string | null;
  /** Notre équipe (catégorie). */
  category: string | null;
  location: string | null;
  field: string | null;
  opponent: string | null;
  opponentLogo: string | null;
  homeAway: "home" | "away";
  status: MatchStatus;
  scoreUs: number | null;
  scoreThem: number | null;
  summary: string | null;
  analysis: MatchAnalysis;
  /** Lien vidéo de la fiche du match (YouTube non répertorié, Veo, Drive…). */
  videoUrl: string | null;
  /** Fichier déposé dans le compartiment privé « match-videos ». */
  videoPath: string | null;
  /** Lien vidéo noté dans l'activité d'Entraînements (coach_activities.video_url), en lecture seule. */
  activityVideoUrl: string | null;
  /** Joueuses notées dans l'alignement, le temps de jeu ou les évaluations. */
  playerCount: number;
  /** Notre équipe telle qu'affichée : « New Valkyria », ou l'équipe que JP dirige hors Académie (« Saint-Gabriel »). */
  ourName: string;
  /** Organisation d'un match hors Académie (coach_activities.organization), sinon null. */
  organization: string | null;
}

export const OUR_NAME = "New Valkyria";
export const EMPTY_ANALYSIS: MatchAnalysis = { strengths: "", fixes: "", actions: "" };

/* ── Texte ───────────────────────────────────────────────────────── */

const strip = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const ACRONYMS = new Set(["fc", "cs", "ac", "as", "sc", "fs", "cf", "us", "aaa", "ssc", "csl", "ars"]);

/** « Fc laval » → « FC Laval » : nom de club propre quand il vient d'un formulaire en minuscules. */
export function tidyClubName(name: string | null | undefined): string {
  const s = String(name ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s
    .split(" ")
    .map((w) => {
      const lower = w.toLowerCase();
      if (ACRONYMS.has(lower)) return lower.toUpperCase();
      if (w === lower && /^\p{L}/u.test(w)) return w.charAt(0).toUpperCase() + w.slice(1);
      return w;
    })
    .join(" ");
}

/** Adversaire d'une plage vendue : club et équipe de la réservation. */
export function opponentFromBooking(org: string | null | undefined, team: string | null | undefined): string | null {
  const parts = [tidyClubName(org), String(team ?? "").trim()].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** « Fc laval · U11 féminin D1 » → « FC Laval · U11 féminin D1 ». */
export function tidyOpponent(label: string | null | undefined): string | null {
  const s = String(label ?? "").trim();
  if (!s) return null;
  const [org, ...rest] = s.split(/\s+·\s+/);
  return [tidyClubName(org), ...rest.map((r) => r.trim())].filter(Boolean).join(" · ") || null;
}

/** Lieu court : « Complexe sportif Terrebonne, Centre de soccer…, Terrebonne J6X 4J9 » → « Complexe sportif Terrebonne ». */
export function shortPlace(location: string | null | undefined): string | null {
  const s = String(location ?? "").trim();
  if (!s) return null;
  return s.split(/\s*[,–—]\s*/)[0]?.trim() || s;
}

/** « New Valkyria — Équipe 2015 avancé (filles) » → « Équipe 2015 avancé (filles) ». */
export function ourTeamLabel(slotTeam: string | null | undefined): string | null {
  const s = String(slotTeam ?? "").trim();
  if (!s) return null;
  return s.replace(/^new\s+valkyria\s*[—–-]\s*/i, "").trim() || null;
}

/** Nom court d'une organisation hors Académie : « Saint-Gabriel (futsal cadet D4) » → « Saint-Gabriel ». */
export function ourNameFor(organization: string | null | undefined): string {
  const s = String(organization ?? "").replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  return s || OUR_NAME;
}

const teamKey = (s: string) =>
  strip(s)
    .replace(/\bste?\b-?/g, (m) => (m.startsWith("ste") ? "sainte-" : "saint-"))
    .replace(/[^a-z0-9]+/g, "");

/** Lit l'affiche d'un match dans le titre de l'activité : « Match Cadet D4 : Curé-Mercure c. Saint-Gabriel ».
 *  La première équipe nommée reçoit (domicile). Retourne l'adversaire et si on joue à domicile. */
export function parseFixture(title: string | null | undefined, ourName: string): { opponent: string; homeAway: "home" | "away" } | null {
  const raw = String(title ?? "");
  const text = (raw.includes(":") ? raw.slice(raw.lastIndexOf(":") + 1) : raw).trim();
  const parts = text.split(/\s+(?:c\.|vs\.?|v\.|contre)\s+/i).map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 2) return null;
  const ours = teamKey(ourName);
  const isOurs = (p: string) => {
    const k = teamKey(p);
    return !!ours && !!k && (k.includes(ours) || ours.includes(k));
  };
  if (isOurs(parts[0]) && !isOurs(parts[1])) return { opponent: parts[1], homeAway: "home" };
  if (isOurs(parts[1]) && !isOurs(parts[0])) return { opponent: parts[0], homeAway: "away" };
  return null;
}

/** Catégorie d'une activité : « 2015 » → « Équipe 2015 ». */
export function categoryLabel(c: string | null | undefined): string | null {
  const s = String(c ?? "").trim();
  if (!s) return null;
  if (/^\d{4}(\s*-\s*\d{4})?$/.test(s)) return `Équipe ${s.replace(/\s+/g, "")}`;
  if (strip(s) === "melange") return "Groupe mélangé";
  return s;
}

/* ── Pastilles (logo, emoji ou initiales sur une couleur tirée du nom) ── */

const STOP_WORDS = new Set(["de", "du", "des", "la", "le", "les", "d", "l", "et", "the", "of"]);

/** Initiales d'un club : « FC Laval · U11 féminin D1 » → « FL » ; « Laval » → « LA ». */
export function clubInitials(name: string | null | undefined): string {
  const org = String(name ?? "").split(/\s+[·|]\s+/)[0] ?? "";
  const words = org
    .split(/[\s\-–—_/.,'’()]+/)
    .filter(Boolean)
    .filter((w) => !STOP_WORDS.has(strip(w)));
  if (!words.length) return "?";
  if (words.length === 1) return Array.from(words[0]).slice(0, 2).join("").toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => Array.from(w)[0])
    .join("")
    .toUpperCase();
}

/** Empreinte stable d'un nom (FNV-1a), pour que la couleur d'un club ne change jamais. */
export function nameHash(name: string): number {
  let h = 0x811c9dc5;
  for (const ch of strip(String(name).split(/\s+[·|]\s+/)[0] ?? "")) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const toHex = ([r, g, b]: [number, number, number]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

/** Couleur de la pastille d'un adversaire et couleur du texte qui reste lisible (contraste ≥ 4,5:1). */
export function crestColors(name: string): { bg: string; fg: string } {
  const h = nameHash(name || "?");
  const hue = h % 360;
  const sat = 0.45 + ((h >>> 9) % 20) / 100;
  let light = 0.34;
  let rgb = hslToRgb(hue, sat, light);
  // Les teintes très claires (jaune, cyan) sont assombries jusqu'à rester lisibles avec du blanc.
  while (contrastRatio(rgb, [255, 255, 255]) < 4.5 && light > 0.18) {
    light -= 0.02;
    rgb = hslToRgb(hue, sat, light);
  }
  return { bg: toHex(rgb), fg: "#ffffff" };
}

export type LogoValue = { kind: "image"; url: string } | { kind: "emoji"; text: string } | null;

/** Le champ « logo » accepte l'adresse https d'une image ou un emoji (ex. 🦁). */
export function parseLogo(value: string | null | undefined): LogoValue {
  const s = String(value ?? "").trim();
  if (!s) return null;
  if (/^https:\/\/\S+$/i.test(s)) return { kind: "image", url: s };
  if (/^[a-z]+:/i.test(s)) return null;
  if (Array.from(s).length <= 4 && !/[<>"']/.test(s)) return { kind: "emoji", text: s };
  return null;
}

export function isValidLogoInput(value: string | null | undefined): boolean {
  const s = String(value ?? "").trim();
  return !s || parseLogo(s) !== null;
}

/* ── Vidéo ───────────────────────────────────────────────────────── */

export interface VideoLink {
  kind: "youtube" | "drive" | "vimeo" | "veo" | "autre";
  label: string;
  href: string;
  /** Adresse à mettre dans un lecteur intégré, si le service le permet. */
  embed: string | null;
}

const YT_ID = /^[A-Za-z0-9_-]{6,20}$/;

/** Reconnaît un lien YouTube (non répertorié), Google Drive, Vimeo ou Veo, et prépare le lecteur. */
export function parseVideoLink(raw: string | null | undefined): VideoLink | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, "");
  const parts = u.pathname.split("/").filter(Boolean);
  const href = u.toString();

  if (host === "youtu.be" || host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
    let id: string | null = null;
    if (host === "youtu.be") id = parts[0] ?? null;
    else if (parts[0] === "watch") id = u.searchParams.get("v");
    else if (["embed", "shorts", "live", "v"].includes(parts[0] ?? "")) id = parts[1] ?? null;
    return { kind: "youtube", label: "YouTube", href, embed: id && YT_ID.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null };
  }
  if (host === "drive.google.com") {
    const id = parts[0] === "file" && parts[1] === "d" ? parts[2] : u.searchParams.get("id");
    return { kind: "drive", label: "Google Drive", href, embed: id && /^[A-Za-z0-9_-]{10,}$/.test(id) ? `https://drive.google.com/file/d/${id}/preview` : null };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = parts.find((p) => /^\d{6,}$/.test(p));
    return { kind: "vimeo", label: "Vimeo", href, embed: id ? `https://player.vimeo.com/video/${id}` : null };
  }
  if (host === "veo.co" || host.endsWith(".veo.co") || host === "veo.app" || host.endsWith(".veo.app")) {
    return { kind: "veo", label: "Veo", href, embed: null };
  }
  return { kind: "autre", label: host, href, embed: null };
}

/** Nom de fichier sûr pour le stockage : sans accents ni espaces, extension gardée. */
export function safeVideoFileName(name: string): string {
  const s = String(name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  const dot = s.lastIndexOf(".");
  const ext = dot > 0 ? s.slice(dot + 1).toLowerCase().slice(0, 8) : "";
  const base = (dot > 0 ? s.slice(0, dot) : s).slice(0, 60).replace(/[-.]+$/g, "") || "video";
  return ext ? `${base}.${ext}` : `${base}.mp4`;
}

/* ── Phase, résultat, saison ─────────────────────────────────────── */

export const hasScore = (m: { scoreUs: number | null; scoreThem: number | null }) => m.scoreUs !== null && m.scoreThem !== null;

export function outcomeOf(us: number | null, them: number | null): Outcome | null {
  if (us === null || them === null) return null;
  return us > them ? "V" : us < them ? "D" : "N";
}

export const OUTCOME_LABEL: Record<Outcome, string> = { V: "Victoire", N: "Nul", D: "Défaite" };
export const OUTCOME_TONE: Record<Outcome, "good" | "bad" | undefined> = { V: "good", N: undefined, D: "bad" };

/** Joué (ou à compléter), aujourd'hui, à venir ou annulé. */
export function phaseOf(m: Pick<MatchCard, "date" | "status" | "scoreUs" | "scoreThem">, today: string): MatchPhase {
  if (m.status === "cancelled") return "annule";
  if (hasScore(m) || m.status === "completed") return "joue";
  if (m.date < today) return "joue";
  if (m.date === today) return "aujourdhui";
  return "a_venir";
}

/** Saison sportive : du 1er août au 31 juillet. « 2026-11-15 » → 2026 (saison 2026-2027). */
export function seasonStartYear(date: string): number {
  const [y, m] = date.slice(0, 10).split("-").map(Number);
  return m >= 8 ? y : y - 1;
}

export const seasonLabel = (y: number) => `Saison ${y}-${y + 1}`;
export const seasonRange = (y: number) => ({ from: `${y}-08-01`, to: `${y + 1}-07-31` });

export interface SeasonRecord {
  /** Matchs joués (score entré ou date passée), sans les annulés. */
  played: number;
  /** Matchs joués avec un score. */
  scored: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  /** Matchs joués sans score. */
  missingScore: number;
  upcoming: number;
  cancelled: number;
}

export function seasonRecord(matches: Pick<MatchCard, "date" | "status" | "scoreUs" | "scoreThem">[], today: string): SeasonRecord {
  const r: SeasonRecord = { played: 0, scored: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, missingScore: 0, upcoming: 0, cancelled: 0 };
  for (const m of matches) {
    const phase = phaseOf(m, today);
    if (phase === "annule") {
      r.cancelled++;
      continue;
    }
    if (phase === "a_venir" || phase === "aujourdhui") {
      r.upcoming++;
      continue;
    }
    r.played++;
    const o = outcomeOf(m.scoreUs, m.scoreThem);
    if (!o) {
      r.missingScore++;
      continue;
    }
    r.scored++;
    r.goalsFor += m.scoreUs ?? 0;
    r.goalsAgainst += m.scoreThem ?? 0;
    if (o === "V") r.wins++;
    else if (o === "N") r.draws++;
    else r.losses++;
  }
  return r;
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/** Titre de « Nos matchs » : la réponse la plus utile en une ligne. */
export function recordHeadline(r: SeasonRecord): string {
  if (r.scored === 0) {
    if (r.played > 0) return `${plural(r.played, "match joué", "matchs joués")} : score à entrer`;
    if (r.upcoming > 0) return "Aucun match joué encore cette saison";
    return "Aucun match cette saison";
  }
  return `${plural(r.wins, "victoire", "victoires")}, ${plural(r.draws, "nul", "nuls")}, ${plural(r.losses, "défaite", "défaites")}`;
}

/** Ce qui manque à la fiche d'un match joué. */
export function missingFor(m: Pick<MatchCard, "date" | "status" | "scoreUs" | "scoreThem" | "summary" | "videoUrl" | "videoPath" | "activityVideoUrl">, today: string): ("score" | "résumé" | "vidéo")[] {
  if (phaseOf(m, today) !== "joue") return [];
  const out: ("score" | "résumé" | "vidéo")[] = [];
  if (!hasScore(m)) out.push("score");
  if (!m.summary?.trim()) out.push("résumé");
  if (!m.videoUrl && !m.videoPath && !m.activityVideoUrl) out.push("vidéo");
  return out;
}

/** Statut à enregistrer : annulé si coché, terminé dès qu'il y a un score, sinon on garde « en direct ». */
export function nextStatus(current: MatchStatus, input: { cancelled: boolean; scoreUs: number | null; scoreThem: number | null }): MatchStatus {
  if (input.cancelled) return "cancelled";
  if (input.scoreUs !== null && input.scoreThem !== null) return "completed";
  if (current === "live") return "live";
  return "scheduled";
}

export function normalizeAnalysis(raw: unknown): MatchAnalysis {
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const t = (v: unknown) => (typeof v === "string" ? v : "");
    return { strengths: t(o.strengths), fixes: t(o.fixes), actions: t(o.actions) };
  }
  if (typeof raw === "string" && raw.trim()) return { strengths: raw, fixes: "", actions: "" };
  return { ...EMPTY_ANALYSIS };
}

export const analysisIsEmpty = (a: MatchAnalysis) => !a.strengths.trim() && !a.fixes.trim() && !a.actions.trim();

/* ── Relier une plage vendue à l'activité du même match ──────────── */

const hhmm = (t: string | null | undefined) => (t ? String(t).slice(0, 5) : null);

/** Une activité Match/Tournoi et une plage vendue désignent le même match quand l'activité
 *  est reliée à la plage (match_details.match_slot_id) ou, à défaut, quand elles sont seules
 *  à partager la même date et la même heure de début. Retourne activité → plage. */
export function pairSlotsWithActivities(
  activities: { id: string; date: string; start: string | null; linkedSlotId: string | null }[],
  slots: { id: string; date: string; start: string | null }[]
): Map<string, string> {
  const pairs = new Map<string, string>();
  const used = new Set<string>();
  const slotIds = new Set(slots.map((s) => s.id));
  for (const a of activities) {
    if (a.linkedSlotId && slotIds.has(a.linkedSlotId) && !used.has(a.linkedSlotId)) {
      pairs.set(a.id, a.linkedSlotId);
      used.add(a.linkedSlotId);
    }
  }
  for (const a of activities) {
    if (pairs.has(a.id) || a.linkedSlotId || !a.start) continue;
    const key = `${a.date}|${hhmm(a.start)}`;
    const sameActs = activities.filter((o) => !pairs.has(o.id) && !o.linkedSlotId && `${o.date}|${hhmm(o.start)}` === key);
    const cands = slots.filter((s) => !used.has(s.id) && `${s.date}|${hhmm(s.start)}` === key);
    if (sameActs.length === 1 && cands.length === 1) {
      pairs.set(a.id, cands[0].id);
      used.add(cands[0].id);
    }
  }
  return pairs;
}

/** Catégorie (birth_categories.id) la plus probable pour l'équipe d'une plage vendue :
 *  « Équipe 2015 avancé (filles) » → « 2015 » ; « Équipe 2016-2017 avancé » → « 2016 » (1re année nommée). */
export function guessCategoryId(ourTeam: string | null | undefined, categories: { id: string; label: string }[]): string | null {
  const years = String(ourTeam ?? "").match(/\b20\d{2}\b/g) ?? [];
  for (const y of years) {
    const hit = categories.find((c) => c.id === y) ?? categories.find((c) => c.id.split("-").includes(y) || c.label.split(/[–-]/).map((p) => p.trim()).includes(y));
    if (hit) return hit.id;
  }
  return null;
}

/** Titre de l'activité créée pour une plage vendue : « Match Équipe 2015 avancé (filles) : New Valkyria c. FC Laval ». */
export function slotActivityTitle(ourTeam: string | null | undefined, opponent: string | null | undefined): string {
  const team = ourTeamLabel(ourTeam);
  const club = String(opponent ?? "").split(/\s+·\s+/)[0]?.trim() || "adversaire";
  return `Match${team ? ` ${team}` : ""} : ${OUR_NAME} c. ${club}`.slice(0, 200);
}

/** Heure de fin d'une plage sans fin notée : 90 minutes après le début. */
export function endOrDefault(start: string, end: string | null | undefined, minutes = 90): string {
  if (end && /^\d{1,2}:\d{2}/.test(end)) return end.slice(0, 5);
  const m = String(start).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return "23:59";
  const total = Math.min(23 * 60 + 59, Number(m[1]) * 60 + Number(m[2]) + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/* ── Temps de jeu, présentes, évaluations ────────────────────────── */

export function matchLengthMinutes(start: string | null | undefined, end: string | null | undefined): number | null {
  const toMin = (t: string | null | undefined) => {
    const m = String(t ?? "").match(/^(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const s = toMin(start);
  const e = toMin(end);
  if (s === null || e === null || e <= s) return null;
  return e - s;
}

export interface LineupInput {
  registration_id: string;
  is_starter: boolean;
  position_code: string | null;
}
export interface SegmentInput {
  registration_id: string;
  minute_in: number;
  minute_out: number | null;
}
export interface EvaluationInput {
  registration_id: string;
  scale: number;
  score: number | null;
  comment: string | null;
}
export interface MatchParticipation {
  lineup: LineupInput[];
  segments: SegmentInput[];
  evaluations: EvaluationInput[];
}

/** Dernière minute du match : sa durée prévue, sinon la dernière minute notée. */
export function matchEndMinute(length: number | null, segments: SegmentInput[]): number {
  if (length && length > 0) return length;
  return segments.reduce((mx, s) => Math.max(mx, s.minute_out ?? s.minute_in), 0);
}

/** Minutes jouées : somme des présences sur le terrain ; une entrée sans sortie compte jusqu'à la fin. */
export function playedMinutes(segments: SegmentInput[], endMinute: number): number {
  return segments.reduce((sum, s) => sum + Math.max(0, (s.minute_out ?? endMinute) - s.minute_in), 0);
}

/** Note sur 10, quelle que soit l'échelle de l'évaluation (10 ou 100). */
export function evalOn10(e: Pick<EvaluationInput, "scale" | "score">): number | null {
  if (e.score === null || e.score === undefined || !Number.isFinite(Number(e.score))) return null;
  const scale = e.scale === 100 ? 100 : 10;
  return Math.max(0, Math.min(10, (Number(e.score) / scale) * 10));
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export interface RosterRow {
  registrationId: string;
  name: string;
  /** Dans l'alignement : titulaire (true) ou remplaçante (false) ; null si pas dans l'alignement. */
  starter: boolean | null;
  position: string | null;
  /** null quand le temps de jeu n'a pas été noté pour ce match. */
  minutes: number | null;
  played: boolean;
  evalAvg: number | null;
  evalCount: number;
  comments: string[];
}

/** Joueuses d'un match : présentes (alignement, temps de jeu ou évaluation), minutes et note.
 *  Si le temps de jeu a été noté pour ce match, une remplaçante sans minute n'a pas joué. */
export function buildRoster(p: MatchParticipation, endMinute: number, names: Record<string, string> = {}): RosterRow[] {
  const ids = new Set<string>([...p.lineup.map((l) => l.registration_id), ...p.segments.map((s) => s.registration_id), ...p.evaluations.map((e) => e.registration_id)]);
  const timed = p.segments.length > 0;
  const rows: RosterRow[] = [];
  for (const id of ids) {
    const lu = p.lineup.find((l) => l.registration_id === id) ?? null;
    const segs = p.segments.filter((s) => s.registration_id === id);
    const evals = p.evaluations.filter((e) => e.registration_id === id);
    const notes = evals.map(evalOn10).filter((n): n is number => n !== null);
    const minutes = timed ? playedMinutes(segs, endMinute) : null;
    rows.push({
      registrationId: id,
      name: names[id] ?? "Joueuse",
      starter: lu ? lu.is_starter : null,
      position: lu?.position_code ?? null,
      minutes,
      played: (minutes ?? 0) > 0 || (!timed && lu !== null) || notes.length > 0,
      evalAvg: notes.length ? round1(notes.reduce((a, b) => a + b, 0) / notes.length) : null,
      evalCount: notes.length,
      comments: evals.map((e) => (e.comment ?? "").trim()).filter(Boolean)
    });
  }
  return rows.sort(
    (a, b) =>
      Number(b.played) - Number(a.played) ||
      Number(b.starter === true) - Number(a.starter === true) ||
      (b.minutes ?? -1) - (a.minutes ?? -1) ||
      a.name.localeCompare(b.name, "fr")
  );
}

/* ── Statistiques par joueuse (ex. combien de matchs Charlotte a joués) ── */

export interface StatsMatch {
  id: string;
  date: string;
  opponent: string | null;
  scoreUs: number | null;
  scoreThem: number | null;
  endMinute: number;
  cancelled: boolean;
}

export interface PlayerIdentity {
  /** Même joueuse d'une saison à l'autre (players.id), sinon l'inscription. */
  key: string;
  name: string;
  birthYear: number | null;
}

export interface PlayerGame {
  matchId: string;
  date: string;
  opponent: string | null;
  minutes: number | null;
  starter: boolean | null;
  evalAvg: number | null;
  outcome: Outcome | null;
}

export interface PlayerStat {
  key: string;
  name: string;
  birthYear: number | null;
  matches: number;
  starts: number;
  /** Total des minutes notées (seulement les matchs où le temps de jeu a été noté). */
  minutes: number;
  timedMatches: number;
  avgMinutes: number | null;
  evalAvg: number | null;
  evalCount: number;
  wins: number;
  draws: number;
  losses: number;
  lastDate: string | null;
  games: PlayerGame[];
}

export function buildPlayerStats(matches: StatsMatch[], participation: Record<string, MatchParticipation>, people: Record<string, PlayerIdentity>): PlayerStat[] {
  const byKey = new Map<string, PlayerStat & { evalSum: number }>();
  for (const m of [...matches].sort((a, b) => a.date.localeCompare(b.date))) {
    if (m.cancelled) continue;
    const p = participation[m.id];
    if (!p) continue;
    for (const row of buildRoster(p, m.endMinute)) {
      if (!row.played) continue;
      const who = people[row.registrationId] ?? { key: row.registrationId, name: "Joueuse", birthYear: null };
      let s = byKey.get(who.key);
      if (!s) {
        s = { key: who.key, name: who.name, birthYear: who.birthYear, matches: 0, starts: 0, minutes: 0, timedMatches: 0, avgMinutes: null, evalAvg: null, evalCount: 0, wins: 0, draws: 0, losses: 0, lastDate: null, games: [], evalSum: 0 };
        byKey.set(who.key, s);
      }
      // Une même joueuse inscrite deux fois au même match (deux inscriptions) ne compte qu'une fois.
      if (s.games.some((g) => g.matchId === m.id)) continue;
      const outcome = outcomeOf(m.scoreUs, m.scoreThem);
      s.matches++;
      if (row.starter) s.starts++;
      if (row.minutes !== null) {
        s.minutes += row.minutes;
        s.timedMatches++;
      }
      if (row.evalAvg !== null) {
        s.evalSum += row.evalAvg;
        s.evalCount++;
      }
      if (outcome === "V") s.wins++;
      else if (outcome === "N") s.draws++;
      else if (outcome === "D") s.losses++;
      s.lastDate = m.date;
      s.games.push({ matchId: m.id, date: m.date, opponent: m.opponent, minutes: row.minutes, starter: row.starter, evalAvg: row.evalAvg, outcome });
    }
  }
  return [...byKey.values()]
    .map(({ evalSum, ...s }) => ({
      ...s,
      avgMinutes: s.timedMatches ? Math.round(s.minutes / s.timedMatches) : null,
      evalAvg: s.evalCount ? round1(evalSum / s.evalCount) : null,
      games: [...s.games].sort((a, b) => b.date.localeCompare(a.date))
    }))
    .sort((a, b) => b.matches - a.matches || b.minutes - a.minutes || a.name.localeCompare(b.name, "fr"));
}

/** Recherche « Charlotte » : sans accents ni majuscules, prénom ou nom. */
export function matchesPlayerQuery(name: string, query: string): boolean {
  const q = strip(query);
  if (!q) return true;
  const n = strip(name);
  return q.split(" ").every((part) => n.includes(part));
}

/* ── Libellés ────────────────────────────────────────────────────── */

/** « 17:30 » → « 17 h 30 ». */
export function timeLabel(t: string | null | undefined): string {
  const m = String(t ?? "").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return "";
  return `${Number(m[1])} h ${m[2]}`;
}

const WEEKDAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** « 2026-11-15 » → « dim. 15 nov. » (avec l'année si demandée). */
export function matchDayLabel(date: string, withYear = false): string {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[wd]} ${d === 1 ? "1er" : d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ""}`;
}

export const monthShort = (date: string) => MONTHS[Number(date.slice(5, 7)) - 1];
export const dayNumber = (date: string) => Number(date.slice(8, 10));

export function minutesLabel(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n} min`;
}

export const evalLabel = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${n.toLocaleString("fr-CA", { maximumFractionDigits: 1 })}/10`);

/* ── Résumé d'après-match → à travailler en pratique (demande de JP, 6 nov. 2026) ──
 *  Les commentaires des joueuses et l'analyse du match sont regroupés par thème de soccer,
 *  séparés en forces et points à corriger (mots négatifs ou note basse), avec les joueuses
 *  à surveiller et 3 priorités pour les prochaines pratiques. Aucun appel externe : des mots-clés. */

export interface LessonTheme {
  key: string;
  label: string;
}

/** Lexique des thèmes (texte sans accents, en minuscules). L'ordre départage les égalités. */
export const LESSON_THEMES: (LessonTheme & { patterns: RegExp[] })[] = [
  { key: "passes", label: "Passes", patterns: [/(?<!\bse )(?<!\bs'est )(?<!\best )\bpass(e|es|er|ait|ent|ant|eus|euse|euses)?\b/, /\bremises?\b/, /\btransmission/, /\bjeu (court|long)\b/, /\bdeviation/] },
  { key: "controle", label: "Contrôle", patterns: [/\bcontrol(e|es|er|ee|ees)?\b/, /\bpremieres? touches?\b/, /\bprises? de (balle|ballon)/, /\bamorti/, /\breception/] },
  { key: "conduite", label: "Conduite", patterns: [/\bconduit(e|es)?\b/, /\bconduire\b/, /\bballe au pied\b/, /\bporter le ballon\b/] },
  { key: "ball-mastery", label: "Ball mastery", patterns: [/\bball mastery\b/, /\bmaitrise/, /\btouches? de balle/, /\baisance/, /\bjongl/] },
  { key: "un-contre-un", label: "1 contre 1", patterns: [/\b1 ?(c|v|vs|contre) ?1\b/, /\bun contre un\b/, /\bduels?\b/, /\bdribbl/, /\bdribl/, /\bfeintes?\b/, /\beliminer\b/, /\bdebord/] },
  { key: "finition", label: "Finition et tir", patterns: [/\btir(s|er|e|ent|ait)?\b/, /\bfrappes?\b/, /\bfinition/, /\bfinir\b/, /\bconclu/, /\bcadr(e|er|es|ee)\b/, /\bbuts?\b(?! (encaiss|accord|conced|contre)|\s+(de|du) (l'|la )?(exercice|jeu))/, /\boccasions?\b/, /\bfilet\b/] },
  { key: "defense", label: "Défense et repli", patterns: [/\bdefen[sd]/, /\brepli/, /\breplier\b/, /\brecuper/, /\btacl/, /\bmarquage/, /\bcouverture/, /\bintercept/, /\bbuts? (encaiss|accord|conced)/, /\bencaiss/] },
  { key: "placement", label: "Placement", patterns: [/\bplacement/, /\bplacee?s?\b/, /\bposition/, /\blargeur/, /\bprofondeur/, /\bespaces?\b/, /\bentre les lignes\b/, /\bcompact/, /\bappels?\b/, /\bdemarqu/, /\bappui/, /\bsoutien/, /\bsans ballon\b/] },
  { key: "transition", label: "Transition", patterns: [/\btransition/, /\bcontre-? ?attaque/, /\bpertes? (de|du) (balle|ballon)/, /\bperd(u|re|ons|ent|ait)? (le|la|du|des|son|ses) (ballon|balle)s?\b/, /\bapres la perte\b/, /\bchangement de statut\b/] },
  { key: "pressing", label: "Pressing", patterns: [/\bpressing/, /\bpress(er|e|ent|ion|ait)\b/, /\bharcel/] },
  { key: "vision", label: "Prise d'information et vision", patterns: [/\bvision\b/, /\bregard(e|er|ait|ent|ant)?\b/, /\btete haute\b/, /\bleve[rz]? la tete\b/, /\bprises? d'?info/, /\bscann/, /\blecture du jeu\b/, /\blire le jeu\b/, /\banticip/, /\bdecisions?\b/, /\bchoix\b/] },
  { key: "communication", label: "Communication", patterns: [/\bcommuni/, /\bparl(e|er|ait|ent)\b/, /\bvoix\b/, /\bcri(e|er|ait)\b/, /\bencourag/, /\bdemande[rz]? le ballon\b/] },
  { key: "gardienne", label: "Gardienne", patterns: [/\bgardien/, /\bgb\b/, /\barrets?\b/, /\bdegagements?\b/, /\brelances?\b/, /\bcages?\b/] },
  { key: "coups-arretes", label: "Jeu aérien et coups de pied arrêtés", patterns: [/\bcorners?\b/, /\bcoups? francs?\b/, /\bcoups? de pied (de coin|arretes?)\b/, /\bpenalt/, /\bremises? en jeu\b/, /\bjeu de tete\b/, /\bjeu aerien\b/] },
  { key: "physique", label: "Physique et endurance", patterns: [/\bendurance/, /\bphysique/, /\bfatigu/, /\bvitesse/, /\brapid/, /\blent(e|es|s|eur)?\b/, /\bsouffle/, /\bcardio/, /\bintensite/, /\bpuissan/, /\bsprint/, /\bexplosiv/, /\bcourir\b/] },
  { key: "attitude", label: "Confiance et attitude", patterns: [/\bconfian/, /\battitude/, /\beffort/, /\bcourag/, /\bmotiv/, /\bconcentr/, /\bleader/, /\bengag/, /\bmentalit/, /\bstress/, /\bnerv/, /\btimide/, /\babandonn/, /\bfrustr/, /\bcombativ/, /\bpeur\b/, /\bdiscipline/, /\becoute\b/, /\brespect/] }
];

const POSITIVE = [/\bpas mal\b/, /\bbien\b/, /\bbon(ne|nes|s)?\b/, /\bbel(le|les)?\b/, /\bbeaux?\b/, /\bexcellent/, /\bsuper\b/, /\bsolides?\b/, /\bfort(e|es|s)?\b/, /\bbravo\b/, /\breussi/, /\befficace/, /\bprecis(e|es)?\b/, /\bpropre/, /\bintelligent/, /\bgenereu/, /\bconstante?s?\b/, /\bdomin/, /\bcalme/, /\bmieux\b/, /\bprogres/, /\bamelior(e|ee|ees|ation)\b/, /\bparfait/, /\bconfiante?s?\b/, /\bimpeccable/, /\bgrosse? (match|partie)\b/, /\bfelicit/, /\bcombativ/, /\bcourageu/];
const NEGATIVE = [/\bpas\b(?! mal\b)/, /\bjamais\b/, /\bmanqu/, /\bdoi[tv]/, /\bdevrai/, /\bfaut\b/, /\b(re)?travailler\b/, /\brevoir\b/, /\binsuffisan/, /\bameliorer\b/, /\bcorriger\b/, /\btrop\b/, /\berreurs?\b/, /\bpertes?\b/, /\bperd/, /\brate/, /\bfaibles?\b/, /\bdifficil/, /\bdifficult/, /\bproblemes?\b/, /\bhesit/, /\bbrouillon/, /\bimprecis/, /\bmauvais/, /\boubli/, /\bnerveuse/, /\btimide/, /\bpeu\b/, /\bmoins\b/, /\ben retard\b/, /\bpassive?s?\b/, /\bpaniqu/, /\bpeur\b/, /\bfrustr/, /\babsente?\b/, /\bdecrochee?\b/, /\bmolle?\b/, /\blent(e|es|s)?\b/, /\btrain(e|ait)\b/];

/** Note sur 10 à partir de laquelle une joueuse est « à surveiller ». */
export const LOW_NOTE = 5;
/** Note sur 10 à partir de laquelle un commentaire sans mot clair compte comme une force. */
export const HIGH_NOTE = 8;

export type LessonSource = "joueuse" | "forces" | "corriger" | "actions" | "resume";

export interface LessonNote {
  /** Joueuse concernée ; null pour l'analyse ou le résumé du match. */
  player: string | null;
  /** Note sur 10 de l'évaluation, s'il y en a une. */
  note: number | null;
  text: string;
  source: LessonSource;
}

export interface LessonMatchInput {
  matchId: string;
  notes: LessonNote[];
}

export interface LessonThemeStat extends LessonTheme {
  mentions: number;
  positive: number;
  negative: number;
  /** Matchs où le thème revient. */
  matches: number;
  /** Joueuses nommées dans un point à corriger. */
  playersToFix: string[];
  /** Joueuses nommées dans une force. */
  playersStrong: string[];
  /** Extraits (points à corriger d'abord), 3 au plus. */
  examples: string[];
}

export interface WatchPlayer {
  name: string;
  /** Moyenne de ses notes sur 10 dans ces matchs. */
  note: number | null;
  negatives: number;
  /** Thèmes de ses points à corriger. */
  themes: string[];
}

export interface LessonPriority {
  key: string;
  label: string;
  kind: "corriger" | "consolider";
  /** Pourquoi : « 4 mentions à corriger · Charlotte, Léa ». */
  why: string;
}

export interface MatchLessons {
  matches: number;
  /** Textes lus (commentaires + champs de l'analyse). */
  notesRead: number;
  /** Joueuses avec au moins une note ou un commentaire. */
  evaluated: number;
  avgNote: number | null;
  themes: LessonThemeStat[];
  strengths: LessonThemeStat[];
  toFix: LessonThemeStat[];
  watch: WatchPlayer[];
  priorities: LessonPriority[];
  /** Points à corriger sans thème reconnu (pour ne rien perdre). */
  otherFixes: string[];
  empty: boolean;
}

const normText = (s: string) =>
  strip(s.replace(/[’‘`´]/g, "'"))
    .replace(/[«»"“”]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const CONTRAST = /\s*\b(?:mais|par contre|cependant|toutefois|sauf que|sauf|alors que|pourtant)\b\s*/i;

interface Clause {
  text: string;
  norm: string;
  /** Le morceau suit un mot de contraste (« mais ») : sans mot clair, il prend le ton inverse. */
  afterContrast: boolean;
}

/** Découpe un texte en morceaux : phrases (. ; ! ? retour, puces), puis virgules et mots de contraste. */
export function splitClauses(text: string): Clause[][] {
  const sentences = String(text ?? "")
    .split(/[.;!?\n\r•]+|\s[-–—]\s|^\s*[-–—*]\s*/m)
    .map((s) => s.trim())
    .filter(Boolean);
  return sentences.map((sentence) => {
    const out: Clause[] = [];
    const pieces = sentence.split(CONTRAST);
    pieces.forEach((piece, i) => {
      piece
        .split(/\s*,\s*/)
        .map((p) => p.trim())
        .filter(Boolean)
        .forEach((p, j) => out.push({ text: p, norm: normText(p), afterContrast: i > 0 && j === 0 }));
    });
    return out;
  });
}

/** Négations qui disent une force : « n'a pas eu peur », « sans peur », « n'hésite pas », « ne lâche rien ». */
const POSITIVE_NEGATION =
  /\b(?:n'?\s?(?:a|avait|ont|as|est|etait)\s+)?(?:pas|jamais)\s+(?:eu\s+)?(?:peur|hesite|lache|recule|abandonne)\b|\bsans (?:peur|hesiter|hesitation)\b|\bn'?\s?hesite (?:pas|jamais)\b|\bne lache (?:rien|jamais|pas)\b|\bpas de (?:souci|probleme)\b/g;

/** Ton d'un morceau : +1 force, −1 à corriger, 0 rien de clair. */
export function clauseTone(text: string): -1 | 0 | 1 {
  const norm = text.replace(POSITIVE_NEGATION, " solide ");
  const pos = POSITIVE.filter((r) => r.test(norm)).length;
  const neg = NEGATIVE.filter((r) => r.test(norm)).length;
  if (neg > pos) return -1;
  if (pos > neg) return 1;
  return neg > 0 ? -1 : 0;
}

/** Thèmes reconnus dans un morceau. */
export function themesIn(norm: string): string[] {
  return LESSON_THEMES.filter((t) => t.patterns.some((r) => r.test(norm))).map((t) => t.key);
}

const clip = (s: string, n = 110) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const listNames = (names: string[], max = 3) => (names.length > max ? `${names.slice(0, max).join(", ")} +${names.length - max}` : names.join(", "));

/** Regroupe les notes d'un ou de plusieurs matchs : forces, points à corriger, joueuses à surveiller, 3 priorités. */
export function summarizeLessons(matches: LessonMatchInput[]): MatchLessons {
  const stats = new Map<string, LessonThemeStat & { matchIds: Set<string>; negEx: string[]; posEx: string[]; neuEx: string[] }>();
  const players = new Map<string, { notes: number[]; negatives: number; themes: Set<string>; seen: boolean }>();
  const otherFixes: string[] = [];
  let notesRead = 0;

  const statFor = (key: string) => {
    let s = stats.get(key);
    if (!s) {
      const t = LESSON_THEMES.find((x) => x.key === key)!;
      s = { key, label: t.label, mentions: 0, positive: 0, negative: 0, matches: 0, playersToFix: [], playersStrong: [], examples: [], matchIds: new Set(), negEx: [], posEx: [], neuEx: [] };
      stats.set(key, s);
    }
    return s;
  };
  const playerFor = (name: string) => {
    let p = players.get(name);
    if (!p) {
      p = { notes: [], negatives: 0, themes: new Set(), seen: true };
      players.set(name, p);
    }
    return p;
  };

  for (const m of matches) {
    for (const n of m.notes) {
      const who = n.player?.trim() || null;
      if (who) {
        const p = playerFor(who);
        if (n.note !== null && Number.isFinite(n.note)) p.notes.push(n.note);
      }
      if (!n.text?.trim()) continue;
      notesRead++;
      // « À corriger » et « Actions » : toujours à travailler. « Forces » : une force, sauf un morceau clairement négatif.
      const fixed: -1 | 1 | null = n.source === "forces" ? 1 : n.source === "corriger" || n.source === "actions" ? -1 : null;
      for (const sentence of splitClauses(n.text)) {
        let carry: -1 | 0 | 1 = 0;
        for (const c of sentence) {
          let tone: -1 | 0 | 1 = fixed === -1 ? -1 : fixed === 1 ? (clauseTone(c.norm) === -1 ? -1 : 1) : clauseTone(c.norm);
          if (fixed === null && tone === 0) {
            if (c.afterContrast && carry !== 0) tone = carry === 1 ? -1 : 1;
            else if (carry !== 0) tone = carry;
            else if (n.note !== null && n.note <= LOW_NOTE) tone = -1;
            else if (n.note !== null && n.note >= HIGH_NOTE) tone = 1;
          }
          carry = tone;
          const keys = themesIn(c.norm);
          const excerpt = clip(who ? `${who.split(" ")[0]} : ${c.text}` : c.text);
          if (!keys.length) {
            if (tone === -1 && c.norm.length >= 8 && otherFixes.length < 6 && !otherFixes.includes(excerpt)) otherFixes.push(excerpt);
            if (tone === -1 && who) playerFor(who).negatives++;
            continue;
          }
          if (tone === -1 && who) playerFor(who).negatives++;
          for (const k of keys) {
            const s = statFor(k);
            s.mentions++;
            s.matchIds.add(m.matchId);
            if (tone === 1) {
              s.positive++;
              if (who && !s.playersStrong.includes(who)) s.playersStrong.push(who);
              if (s.posEx.length < 3) s.posEx.push(excerpt);
            } else if (tone === -1) {
              s.negative++;
              if (who && !s.playersToFix.includes(who)) s.playersToFix.push(who);
              if (who) playerFor(who).themes.add(s.label);
              if (s.negEx.length < 3) s.negEx.push(excerpt);
            } else if (s.neuEx.length < 3) s.neuEx.push(excerpt);
          }
        }
      }
    }
  }

  const order = (k: string) => LESSON_THEMES.findIndex((t) => t.key === k);
  const themes: LessonThemeStat[] = [...stats.values()]
    .map(({ matchIds, negEx, posEx, neuEx, ...s }) => ({ ...s, matches: matchIds.size, examples: [...negEx, ...posEx, ...neuEx].slice(0, 3) }))
    .sort((a, b) => b.mentions - a.mentions || b.negative - a.negative || order(a.key) - order(b.key));
  const toFix = themes
    .filter((t) => t.negative > 0 && t.negative >= t.positive)
    .sort((a, b) => b.negative - a.negative || b.matches - a.matches || b.playersToFix.length - a.playersToFix.length || order(a.key) - order(b.key));
  const strengths = themes
    .filter((t) => t.positive > 0 && t.positive > t.negative)
    .sort((a, b) => b.positive - a.positive || b.matches - a.matches || order(a.key) - order(b.key));

  const multi = matches.length > 1;
  const plural2 = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
  const priorities: LessonPriority[] = toFix.slice(0, 3).map((t) => ({
    key: t.key,
    label: t.label,
    kind: "corriger",
    why: [plural2(t.negative, "mention à corriger", "mentions à corriger"), multi && t.matches > 1 ? `dans ${t.matches} matchs` : null, t.playersToFix.length ? listNames(t.playersToFix.map((n) => n.split(" ")[0])) : null]
      .filter(Boolean)
      .join(" · ")
  }));
  // Moins de 3 points à corriger : on consolide les thèmes les plus nommés (sans les forces déjà acquises en premier).
  for (const t of [...themes].sort((a, b) => a.positive - a.negative - (b.positive - b.negative) || b.mentions - a.mentions)) {
    if (priorities.length >= 3) break;
    if (priorities.some((p) => p.key === t.key)) continue;
    priorities.push({ key: t.key, label: t.label, kind: "consolider", why: `${plural2(t.mentions, "mention", "mentions")}${t.positive ? `, dont ${t.positive} positive${t.positive > 1 ? "s" : ""}` : ""} : à consolider` });
  }

  const round1 = (n: number) => Math.round(n * 10) / 10;
  const allNotes = [...players.values()].flatMap((p) => p.notes);
  const watch: WatchPlayer[] = [...players.entries()]
    .map(([name, p]) => ({ name, note: p.notes.length ? round1(p.notes.reduce((a, b) => a + b, 0) / p.notes.length) : null, negatives: p.negatives, themes: [...p.themes] }))
    .filter((p) => (p.note !== null && p.note <= LOW_NOTE) || p.negatives >= 2)
    .sort((a, b) => (a.note ?? 11) - (b.note ?? 11) || b.negatives - a.negatives || a.name.localeCompare(b.name, "fr"));

  return {
    matches: matches.length,
    notesRead,
    evaluated: players.size,
    avgNote: allNotes.length ? round1(allNotes.reduce((a, b) => a + b, 0) / allNotes.length) : null,
    themes,
    strengths,
    toFix,
    watch,
    priorities,
    otherFixes,
    empty: notesRead === 0 && allNotes.length === 0
  };
}

/** Notes d'un match à partir des évaluations (note sur 10 calculée) et de l'analyse écrite. */
export function lessonNotesFrom(
  evaluations: { player: string; scale: number; score: number | null; comment: string | null }[],
  analysis: MatchAnalysis | null,
  summary?: string | null
): LessonNote[] {
  const notes: LessonNote[] = evaluations.map((e) => ({ player: e.player, note: evalOn10(e), text: (e.comment ?? "").trim(), source: "joueuse" as const }));
  if (analysis) {
    if (analysis.strengths.trim()) notes.push({ player: null, note: null, text: analysis.strengths, source: "forces" });
    if (analysis.fixes.trim()) notes.push({ player: null, note: null, text: analysis.fixes, source: "corriger" });
    if (analysis.actions.trim()) notes.push({ player: null, note: null, text: analysis.actions, source: "actions" });
  }
  if (summary?.trim()) notes.push({ player: null, note: null, text: summary, source: "resume" });
  return notes;
}

/* ── « Ajouter au thème de la semaine prochaine » (season_themes.notes) ── */

const addDaysIso = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Lundi qui suit une date (le lundi d'après si c'est déjà un lundi). */
const mondayAfter = (iso: string) => addDaysIso(iso, 7 - ((new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7));

/** Semaine où ramener les leçons du match : celle qui suit le match. Noté le lundi d'après (avant les pratiques),
 *  c'est encore cette semaine-là ; une fois la semaine commencée, ce sera la semaine suivante. */
export function nextWeekStart(matchDate: string, today: string): string {
  const after = mondayAfter(matchDate);
  return after >= today ? after : mondayAfter(today);
}

/** Début de la ligne écrite dans les notes du thème : sert aussi à la retrouver (pas de doublon). */
export function lessonMarker(m: { date: string; opponent: string | null }): string {
  return `Après le match du ${matchDayLabel(m.date)} contre ${m.opponent?.trim() || "l'adversaire"}`;
}

/** « Après le match du sam. 7 nov. contre X (Équipe 2015) — à travailler : 1. Passes ; 2. … ». */
export function lessonLine(m: { date: string; opponent: string | null; category: string | null }, priorities: Pick<LessonPriority, "label" | "kind">[]): string {
  const items = priorities.slice(0, 3).map((p, i) => `${i + 1}. ${p.label}${p.kind === "consolider" ? " (à consolider)" : ""}`);
  return `${lessonMarker(m)}${m.category ? ` (${m.category})` : ""} — à travailler : ${items.join(" ; ")}.`;
}

/** Ajoute la ligne aux notes du thème, ou remplace celle du même match (jamais en double). */
export function mergeLessonIntoNotes(existing: string | null | undefined, line: string, marker: string): string {
  const lines = String(existing ?? "")
    .split("\n")
    .map((l) => l.trimEnd());
  const i = lines.findIndex((l) => l.trim().startsWith(marker));
  if (i >= 0) lines[i] = line;
  else {
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    lines.push(line);
  }
  return lines.join("\n").trim();
}

export const hasLessonIn = (notes: string | null | undefined, marker: string) => String(notes ?? "").split("\n").some((l) => l.trim().startsWith(marker));
