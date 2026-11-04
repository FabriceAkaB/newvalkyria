/** Historique exact de chaque pratique (demande de JP, 3 nov. 2026) : règles pures. Une pratique passée est complète
 *  quand elle est déposée (diapos ou plan de séance), que les présences et le sondage de fin sont faits et que l'analyse
 *  d'après pratique est écrite. Une pratique passée sans dépôt est « en retard ». */

/** L'historique exact commence au 1er novembre 2026 (décision de JP). */
export const HISTORY_START = "2026-11-01";
/** À cette note de pertinence au thème (sur 10) ou plus, la pratique entre dans la galerie des pratiques modèles. */
export const GALLERY_MIN_SCORE = 8;

export interface PracticeRecord {
  date: string;
  planned: boolean;
  deck: boolean;
  present: number;
  answered: number;
  analysis: boolean;
  /** Note de JP sur la pertinence au thème de la semaine (sur 10), null tant qu'elle n'est pas évaluée. */
  themeScore: number | null;
}

export const CHECKS = [
  { key: "depot", label: "Déposée (diapos ou plan)" },
  { key: "presences", label: "Présences" },
  { key: "sondage", label: "Sondage de fin" },
  { key: "analyse", label: "Analyse d'après pratique" },
  { key: "note", label: "Note de pertinence au thème" }
] as const;
export type CheckKey = (typeof CHECKS)[number]["key"];

export function checksOf(r: PracticeRecord): Record<CheckKey, boolean> {
  return { depot: r.planned || r.deck, presences: r.present > 0, sondage: r.present > 0 && r.answered >= r.present, analyse: r.analysis, note: r.themeScore !== null };
}

export function missingOf(r: PracticeRecord): string[] {
  const c = checksOf(r);
  return CHECKS.filter((k) => !c[k.key]).map((k) => k.label);
}

/** Passée et pas encore déposée : la priorité pour garder un historique exact. */
export const isLate = (r: PracticeRecord, today: string) => r.date < today && !checksOf(r).depot;
export const isComplete = (r: PracticeRecord) => Object.values(checksOf(r)).every(Boolean);

/** Nettoie un lien de diapos (claude.ai, Google Slides, PowerPoint en ligne…) : https seulement. */
export function cleanDeckUrl(raw: unknown): string | null | undefined {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

export const inGallery = (r: Pick<PracticeRecord, "themeScore">) => r.themeScore !== null && r.themeScore >= GALLERY_MIN_SCORE;

/** Une note sur 10 envoyée par le formulaire : entier de 0 à 10, vide = pas encore évaluée, sinon invalide. */
export function cleanScore(raw: unknown): number | null | undefined {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 10 ? n : undefined;
}
