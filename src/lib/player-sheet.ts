/** Fiche joueuse (Mandalart P4.1.03, JP 19 nov. 2026) : le parent dit en quelques mots qui est sa fille, l'éducatrice
 *  le lit dans le briefing de 5 minutes avant la pratique. Règles pures, testées (player-sheet.test.ts).
 *  Données d'enfant (Loi 25) : rangées dans player_family_sheets, lues seulement par le serveur. */

export const SHEET_FIELDS = [
  { key: "likes", label: "Ce qu'elle aime", hint: "Au soccer ou ailleurs : son poste, ses exercices préférés, ce qui la fait sourire.", briefing: "aime" },
  { key: "stress", label: "Ce qui la stresse", hint: "Être nommée devant le groupe, l'erreur, les nouveaux visages, les tirs au but…", briefing: "stressée par" },
  { key: "experience", label: "Son expérience", hint: "Depuis quand elle joue, dans quels clubs, à quel niveau.", briefing: "expérience" },
  { key: "health", label: "Santé et allergies à savoir", hint: "Allergie, asthme, blessure récente, médicament à avoir sur place. Laissez vide s'il n'y a rien.", briefing: "santé" },
  { key: "season_goal", label: "Son objectif de la saison", hint: "Ce qu'elle veut réussir cette année, dit avec ses mots.", briefing: "objectif" },
  { key: "encouragement", label: "Comment l'encourager", hint: "Un mot, un geste, une façon de lui parler qui marche bien avec elle.", briefing: "l'encourager" }
] as const;

export type SheetKey = (typeof SHEET_FIELDS)[number]["key"];
export type SheetAnswers = Record<SheetKey, string | null>;

export const SHEET_FIELD_MAX = 500;

/** Nettoie les réponses du parent : texte seulement, espaces réduits, longueur bornée, vide = null. */
export function cleanSheet(input: Record<string, unknown>): SheetAnswers {
  const out = {} as SheetAnswers;
  for (const f of SHEET_FIELDS) {
    const v = input[f.key];
    const t = typeof v === "string" ? v.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, SHEET_FIELD_MAX) : "";
    out[f.key] = t || null;
  }
  return out;
}

/** Au moins une réponse, sinon rien à enregistrer. Renvoie le problème, ou null. */
export function checkSheet(answers: SheetAnswers): string | null {
  return SHEET_FIELDS.some((f) => answers[f.key]) ? null : "Répondez à au moins une question.";
}

export function filledCount(answers: Partial<SheetAnswers> | null | undefined): number {
  return answers ? SHEET_FIELDS.filter((f) => answers[f.key]).length : 0;
}

const short = (s: string, max: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

/** Les lignes du briefing : la santé à part (à ne pas manquer), puis « Fiche joueuse : aime … · stressée par … ». */
export function briefingLines(answers: Partial<SheetAnswers> | null | undefined, max = 110): { health: string | null; sheet: string | null } {
  if (!answers) return { health: null, sheet: null };
  const parts = SHEET_FIELDS.filter((f) => f.key !== "health" && answers[f.key]).map((f) => `${f.briefing} : ${short(String(answers[f.key]), max)}`);
  return { health: answers.health ? short(answers.health, 200) : null, sheet: parts.length ? parts.join(" · ") : null };
}
