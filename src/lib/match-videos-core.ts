/** Matchs filmés dans l'espace client (demande de JP, 7 nov. 2026) : règles pures, sans base de données.
 *  Une famille voit un match si sa fille est dans l'équipe filmée ou si elle était présente à ce match (joueuse invitée).
 *  Une vidéo n'est publiée qu'après le contrôle de l'accord photo et vidéo des joueuses concernées. */

import type { ConsentState } from "@/lib/players-repo";

export interface VideoAccessRow {
  team_id: string | null;
  participant_keys: string[] | null;
  published: boolean;
  status: string;
}

/** La famille (ses joueuses : clés de nom et équipes) a-t-elle le droit de regarder cette vidéo ? */
export function canWatch(video: VideoAccessRow, family: { keys: string[]; teamIds: string[] }): boolean {
  if (!video.published || video.status !== "pret") return false;
  if (video.team_id && family.teamIds.includes(video.team_id)) return true;
  return (video.participant_keys ?? []).some((k) => family.keys.includes(k));
}

export interface ConsentSummary {
  oui: string[];
  non: string[];
  sansReponse: string[];
}

export function summarizeConsent(players: { name: string; state: ConsentState }[]): ConsentSummary {
  const s: ConsentSummary = { oui: [], non: [], sansReponse: [] };
  for (const p of players) (p.state === "oui" ? s.oui : p.state === "non" ? s.non : s.sansReponse).push(p.name);
  for (const list of [s.oui, s.non, s.sansReponse]) list.sort((a, b) => a.localeCompare(b, "fr"));
  return s;
}

/** Publier : permis d'emblée quand toutes les joueuses ont dit oui ; sinon JP doit confirmer (case cochée) que les
 *  joueuses sans accord ne sont pas reconnaissables ou que les familles ont été jointes. */
export function canPublish(c: ConsentSummary, confirmed: boolean): { ok: boolean; reason?: string } {
  if (!c.non.length && !c.sansReponse.length) return { ok: true };
  if (confirmed) return { ok: true };
  const parts = [c.non.length ? `${c.non.length} refus (${c.non.join(", ")})` : "", c.sansReponse.length ? `${c.sansReponse.length} sans réponse` : ""].filter(Boolean);
  return { ok: false, reason: `Accord photo et vidéo : ${parts.join(", ")}. Coche la confirmation pour publier quand même.` };
}

/** Une heure de vidéo en texte (« 1 h 32 »). */
export function durationLabel(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`;
}

/** L'hôte du lecteur Cloudflare (« customer-xxxx.cloudflarestream.com ») tiré d'une adresse de lecture. */
export function streamHostOf(url: string | null | undefined): string | null {
  const m = String(url ?? "").match(/^https:\/\/(customer-[a-z0-9]+\.cloudflarestream\.com)\//);
  return m ? m[1] : null;
}

/* ── Enregistrements Veo : seuls ceux dont le titre commence par « Newval » sont rangés ─────────────── */

/** Un enregistrement Veo à ranger dans le site (titre « Newval … » seulement). */
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
  if (scored.length > 1 && scored[0].score === scored[1].score) return { candidate: null, reason: `À départager : ${scored.slice(0, 3).map((x) => `${x.c.teamName} (${x.c.kind})`).join(", ")}. Ajoute l'équipe dans le titre Veo (ex. « Newval 2015 AV match »).` };
  return { candidate: scored[0].c, reason: "" };
}

/** Heure de Montréal (date AAAA-MM-JJ et minutes depuis minuit) d'un instant ISO. */
export function montrealParts(iso: string): { date: string; startMin: number } {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const [h, m] = d.toLocaleTimeString("en-GB", { timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit", hour12: false }).split(":").map(Number);
  return { date, startMin: (h % 24) * 60 + m };
}
