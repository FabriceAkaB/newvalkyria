/** Planification de l'année (périodisation) : règles pures. Une ligne par semaine (lundi), blocs de 4 à 6 semaines,
 *  une semaine de tests par mois (test du mois du passeport, P1.2.05), semaines fermées (Fêtes). */

export interface PlanWeek {
  weekStart: string;
  month: string;
  /** Aucune séance de la saison cette semaine (avant le début, après la fin ou pendant les Fêtes). */
  closed: boolean;
}

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const mondayOf = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return addDays(iso, -((d.getUTCDay() + 6) % 7));
};

export function seasonWeeks(season: { start: string; end: string; breaks: [string, string][] }): PlanWeek[] {
  const out: PlanWeek[] = [];
  for (let w = mondayOf(season.start); w <= season.end; w = addDays(w, 7)) {
    // Fermée si aucun jour de la semaine (lundi à samedi) n'est dans la saison hors congés.
    const open = [0, 1, 2, 3, 4, 5].some((i) => {
      const d = addDays(w, i);
      return d >= season.start && d <= season.end && !season.breaks.some(([a, b]) => d >= a && d <= b);
    });
    out.push({ weekStart: w, month: w.slice(0, 7), closed: !open });
  }
  return out;
}

export interface BlockRun {
  label: string;
  start: string;
  weeks: number;
  /** Un bloc fait 4 à 6 semaines d'école (les semaines fermées ne comptent pas). */
  ok: boolean;
}

/** Les blocs tels qu'ils se suivent dans le plan (semaines ouvertes consécutives portant le même nom de bloc). */
export function blockRuns(weeks: PlanWeek[], blockOf: (weekStart: string) => string | null | undefined): BlockRun[] {
  const runs: BlockRun[] = [];
  for (const w of weeks) {
    if (w.closed) continue;
    const label = blockOf(w.weekStart)?.trim();
    if (!label) continue;
    const last = runs[runs.length - 1];
    if (last && last.label === label) last.weeks += 1;
    else runs.push({ label, start: w.weekStart, weeks: 1, ok: false });
  }
  return runs.map((r) => ({ ...r, ok: r.weeks >= 4 && r.weeks <= 6 }));
}

/** Mois de la saison (avec au moins une semaine ouverte) qui n'ont pas encore de semaine de tests. */
export function monthsWithoutTest(weeks: PlanWeek[], isTestWeek: (weekStart: string) => boolean): string[] {
  const months = [...new Set(weeks.filter((w) => !w.closed).map((w) => w.month))];
  return months.filter((m) => !weeks.some((w) => w.month === m && !w.closed && isTestWeek(w.weekStart)));
}
