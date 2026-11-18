/** Ce que les éducateurs voient de la méthode (JP, 17 nov. 2026) : la méthode Valkyria est la propriété
 *  intellectuelle de l'académie, alors le plan des pratiques (diapos, exercices, guide) ne s'ouvre que pour la
 *  semaine en cours. Dès le samedi, la semaine suivante s'ouvre aussi pour préparer la pratique du lundi.
 *  Les pratiques passées restent ouvertes 14 jours (rapport, évaluations, retour). Les matchs ne sont pas visés.
 *  Règles pures, testées (coach-access-core.test.ts). */

export const PAST_OPEN_DAYS = 14;
const METHOD_TYPES = ["Pratique", "Camp"];

const shift = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Fenêtre ouverte : du jour − 14 jusqu'au dimanche de la semaine (le dimanche suivant à partir du samedi). */
export function methodWindow(today: string): { from: string; to: string } {
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 dimanche … 6 samedi
  const sunday = shift(today, (7 - dow) % 7); // le dimanche de cette semaine (aujourd'hui si on est dimanche)
  return { from: shift(today, -PAST_OPEN_DAYS), to: dow === 6 || dow === 0 ? shift(sunday, 7) : sunday };
}

/** Le plan de cette activité est-il ouvert à l'éducateur aujourd'hui ? (les matchs et les autres activités, toujours) */
export function isMethodOpen(a: { activity_date: string; activity_type: string }, today: string): boolean {
  if (!METHOD_TYPES.includes(a.activity_type)) return true;
  const d = String(a.activity_date).slice(0, 10);
  const w = methodWindow(today);
  return d >= w.from && d <= w.to;
}

/** Le jour où le plan s'ouvrira (le samedi qui précède sa semaine), pour l'afficher à l'éducateur. */
export function opensOn(activityDate: string): string {
  const d = String(activityDate).slice(0, 10);
  const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
  const monday = shift(d, -((dow + 6) % 7));
  return shift(monday, -2);
}
