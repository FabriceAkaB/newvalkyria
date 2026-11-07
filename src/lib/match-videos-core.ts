/** Matchs et pratiques filmés avec la caméra Veo (demande de JP, 7 nov. 2026) : règles pures, sans base de données.
 *  Les vidéos restent chez Veo : le site garde le lien du fichier 1080p, l'aperçu, les périodes et les temps forts.
 *  Une famille voit un match si sa fille est dans l'équipe filmée ou si elle était présente à ce match (joueuse invitée).
 *  Une pratique n'est vue que par les éducateurs de l'activité (et les administrateurs). */

export interface VideoAccessRow {
  kind?: string;
  team_id: string | null;
  participant_keys: string[] | null;
  published: boolean;
  status: string;
}

/** La famille (ses joueuses : clés de nom et équipes) a-t-elle le droit de regarder cette vidéo ? */
export function canWatch(video: VideoAccessRow, family: { keys: string[]; teamIds: string[] }): boolean {
  if ((video.kind ?? "match") !== "match" || !video.published || video.status !== "pret") return false;
  if (video.team_id && family.teamIds.includes(video.team_id)) return true;
  return (video.participant_keys ?? []).some((k) => family.keys.includes(k));
}

/** Une durée en texte (« 1 h 32 », « 25 min »). */
export function durationLabel(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`;
}

/** Un instant de la vidéo (« 1:05:12 », « 12:04 »). */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/* ── Ce que Veo nous donne pour le lecteur ─────────────────────────────────── */

export interface VideoPeriod {
  from: number;
  to: number;
  label: string;
}

export interface VideoHighlight {
  /** Début du moment, en secondes depuis le début de la vidéo. */
  t: number;
  /** Durée du moment (Veo : environ 25 s). */
  d: number;
  type: string;
  label: string;
  ai: boolean;
}

/** Périodes de jeu Veo (« timeframe » [début, fin]) en ordre, nommées « 1re période », « 2e période »… */
export function periodsFromVeo(raw: unknown): VideoPeriod[] {
  const list = (Array.isArray(raw) ? raw : [])
    .map((p: any) => ({ from: Number(p?.timeframe?.[0]), to: Number(p?.timeframe?.[1]), name: String(p?.name ?? "").trim() }))
    .filter((p) => Number.isFinite(p.from) && Number.isFinite(p.to) && p.to > p.from)
    .sort((a, b) => a.from - b.from);
  return list.map((p, i) => ({ from: p.from, to: p.to, label: p.name || `${i === 0 ? "1re" : `${i + 1}e`} période` }));
}

/** Les types de moments que les familles comprennent, dans l'ordre d'affichage (le reste garde le nom donné par Veo). */
export const HIGHLIGHT_ORDER = ["goal", "shot_on_goal", "shot", "save", "penalty", "free_kick", "corner"];
const HIGHLIGHT_LABEL: Record<string, string> = { goal: "But", shot_on_goal: "Tir cadré", shot: "Tir", save: "Arrêt", penalty: "Penalty", free_kick: "Coup franc", corner: "Corner" };

/** Temps forts Veo (IA ou ajoutés à la main) triés dans le temps ; deux moments du même type à moins de 10 s l'un de
 *  l'autre n'en font qu'un. */
export function highlightsFromVeo(raw: unknown): VideoHighlight[] {
  const list = (Array.isArray(raw) ? raw : (raw as any)?.results ?? [])
    .map((h: any) => {
      const type = String(h?.type ?? h?.tags?.[0]?.slug ?? "moment").replace(/-/g, "_");
      return { t: Number(h?.start), d: Number(h?.duration) || 20, type, label: HIGHLIGHT_LABEL[type] ?? String(h?.tags?.[0]?.name ?? "Moment"), ai: Boolean(h?.is_ai_generated) };
    })
    .filter((h: VideoHighlight) => Number.isFinite(h.t) && h.t >= 0)
    .sort((a: VideoHighlight, b: VideoHighlight) => a.t - b.t);
  const out: VideoHighlight[] = [];
  for (const h of list) if (!out.some((o) => o.type === h.type && Math.abs(o.t - h.t) < 10)) out.push(h);
  return out;
}

/** Compte par type pour les filtres du lecteur (« 3 buts », « 12 tirs cadrés »), types connus d'abord. */
export function highlightCounts(list: VideoHighlight[]): { type: string; label: string; n: number }[] {
  const m = new Map<string, { type: string; label: string; n: number }>();
  for (const h of list) {
    const x = m.get(h.type) ?? { type: h.type, label: h.label, n: 0 };
    x.n++;
    m.set(h.type, x);
  }
  const rank = (t: string) => (HIGHLIGHT_ORDER.includes(t) ? HIGHLIGHT_ORDER.indexOf(t) : 99);
  return [...m.values()].sort((a, b) => rank(a.type) - rank(b.type) || b.n - a.n);
}

/* ── Enregistrements Veo : seuls ceux dont le titre commence par « Newval » sont rangés ─────────────── */

/** Un enregistrement Veo à ranger dans le site (titre « Newval … » ou « New Valkyria … »). */
export const isNewvalRecording = (title: string | null | undefined) => /^\s*new\s*val/i.test(String(title ?? ""));

export interface VideoCandidate {
  /** match (familles) ou pratique (éducateurs). */
  kind: "match" | "pratique";
  teamId: string | null;
  teamName: string;
  mcsEventId: number | null;
  activityId: string | null;
  title: string;
  /** Minutes depuis minuit (heure de Montréal), si connue. */
  startMin: number | null;
}

const tokens = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/new\s*val[a-z]*/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !["vs", "de", "du", "la", "le", "les", "et", "fc"].includes(t));

/** Le bon endroit pour un enregistrement : l'activité du même jour la plus proche de l'heure de début, départagée par
 *  le titre (« match », « pratique », année, AV / INT, jour). Null si rien ne colle ou si deux activités sont à égalité
 *  (JP choisit alors lui-même dans l'admin). */
export function classifyRecording(rec: { title: string; startMin: number | null }, candidates: VideoCandidate[]): { candidate: VideoCandidate | null; reason: string } {
  const words = tokens(rec.title);
  const wantsMatch = words.some((w) => /^(match|partie|game|tournoi)$/.test(w));
  const wantsPractice = words.some((w) => /^(pratique|practice|entrainement|seance)$/.test(w));
  let list = candidates;
  if (wantsMatch) list = list.filter((c) => c.kind === "match");
  if (wantsPractice) list = list.filter((c) => c.kind === "pratique");
  if (!list.length) return { candidate: null, reason: "Aucune activité ce jour-là dans le site ou MonClubSportif." };
  const scored = list
    .map((c) => {
      let score = 0;
      if (rec.startMin !== null && c.startMin !== null) {
        const d = Math.abs(rec.startMin - c.startMin);
        if (d > 90) return { c, score: -1 };
        score += d <= 20 ? 4 : d <= 45 ? 3 : 1;
      }
      const name = tokens(`${c.teamName} ${c.title}`);
      score += words.filter((w) => name.includes(w)).length * 2;
      return { c, score };
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return { candidate: null, reason: "L'heure de l'enregistrement ne correspond à aucune activité de ce jour-là." };
  if (scored.length > 1 && scored[0].score === scored[1].score) return { candidate: null, reason: `À départager : ${scored.slice(0, 3).map((x) => `${x.c.teamName} (${x.c.kind})`).join(", ")}. Choisis ci-dessous, ou mets l'équipe dans le titre Veo (ex. « Newval 2015 AV match »).` };
  return { candidate: scored[0].c, reason: "" };
}

/** Heure de Montréal (date AAAA-MM-JJ et minutes depuis minuit) d'un instant ISO. */
export function montrealParts(iso: string): { date: string; startMin: number } {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const [h, m] = d.toLocaleTimeString("en-GB", { timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit", hour12: false }).split(":").map(Number);
  return { date, startMin: (h % 24) * 60 + m };
}
