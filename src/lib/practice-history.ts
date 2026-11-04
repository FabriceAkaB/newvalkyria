/** Historique exact de chaque pratique (demande de JP, 3 nov. 2026) : règles pures. Une pratique passée est complète
 *  quand elle est déposée (diapos ou plan de séance), que les présences et le sondage de fin sont faits et que l'analyse
 *  d'après pratique est écrite. Une pratique passée sans dépôt est « en retard ». */

export interface PracticeRecord {
  date: string;
  planned: boolean;
  deck: boolean;
  present: number;
  answered: number;
  analysis: boolean;
}

export const CHECKS = [
  { key: "depot", label: "Déposée (diapos ou plan)" },
  { key: "presences", label: "Présences" },
  { key: "sondage", label: "Sondage de fin" },
  { key: "analyse", label: "Analyse d'après pratique" }
] as const;
export type CheckKey = (typeof CHECKS)[number]["key"];

export function checksOf(r: PracticeRecord): Record<CheckKey, boolean> {
  return { depot: r.planned || r.deck, presences: r.present > 0, sondage: r.present > 0 && r.answered >= r.present, analyse: r.analysis };
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
