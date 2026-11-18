/** Valkyria Lab en plateforme de formation (JP, 17 nov. 2026) : le défi du jour (un exercice de la routine du mois,
 *  à tour de rôle) et la progression de chaque joueuse (jours de routine faits, série en cours). Règles pures. */

/** L'exercice du jour : les exercices de la routine du mois, chacun son jour, à tour de rôle. */
export function dailyChallenge<T>(exercises: T[], iso: string): { item: T; index: number } | null {
  if (!exercises.length) return null;
  const index = (Number(iso.slice(8, 10)) - 1) % exercises.length;
  return { item: exercises[index], index };
}

const shift = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Série : jours d'affilée jusqu'à aujourd'hui (ou hier, si aujourd'hui n'est pas encore coché). */
export function streakOf(days: string[], today: string): number {
  const set = new Set(days.map((d) => d.slice(0, 10)));
  let cur = set.has(today) ? today : shift(today, -1);
  let n = 0;
  while (set.has(cur)) {
    n++;
    cur = shift(cur, -1);
  }
  return n;
}

/** Le mois en cours jour par jour : fait, manqué (passé), aujourd'hui, à venir. */
export function monthTrack(days: string[], today: string): { day: string; state: "fait" | "manque" | "aujourdhui" | "avenir" }[] {
  const set = new Set(days.map((d) => d.slice(0, 10)));
  const first = `${today.slice(0, 7)}-01`;
  const out: { day: string; state: "fait" | "manque" | "aujourdhui" | "avenir" }[] = [];
  for (let d = first; d.slice(0, 7) === first.slice(0, 7); d = shift(d, 1)) {
    out.push({ day: d, state: set.has(d) ? "fait" : d === today ? "aujourdhui" : d < today ? "manque" : "avenir" });
  }
  return out;
}

/** Progression du mois : jours faits sur les jours passés (aujourd'hui compris). */
export function monthRate(days: string[], today: string): { done: number; elapsed: number; pct: number } {
  const month = today.slice(0, 7);
  const done = new Set(days.filter((d) => d.slice(0, 7) === month && d.slice(0, 10) <= today).map((d) => d.slice(0, 10))).size;
  const elapsed = Number(today.slice(8, 10));
  return { done, elapsed, pct: elapsed ? Math.round((done / elapsed) * 100) : 0 };
}
