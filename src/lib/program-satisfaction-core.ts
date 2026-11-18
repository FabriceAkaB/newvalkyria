/** Satisfaction par programme (JP, 17 nov. 2026 ; plan des deux espaces, phase 4) : pour chaque programme, le plaisir
 *  des jeunes mois par mois (note de la pratique au sondage de fin, sur 10) et la satisfaction des parents (note de
 *  recommandation des sondages, sur 10), pour décider avec des données. Règles pures, testées. */

export interface Rating {
  date: string;
  value: number;
}

/** Les n derniers mois (AAAA-MM), du plus ancien au plus récent. */
export function lastMonths(today: string, n: number): string[] {
  const [y, m] = today.slice(0, 7).split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

const avg = (v: number[]) => (v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null);

/** Moyenne de chaque mois (null si aucune note ce mois-là) et nombre de notes. */
export function monthlyAverages(rows: Rating[], months: string[]): { month: string; value: number | null; count: number }[] {
  return months.map((month) => {
    const vals = rows.filter((r) => r.date.slice(0, 7) === month && r.value >= 1 && r.value <= 10).map((r) => r.value);
    return { month, value: avg(vals), count: vals.length };
  });
}

/** La tendance entre les deux derniers mois notés : en hausse, en baisse ou stable (écart de moins de 0,3). */
export function trendOf(series: { value: number | null }[]): "hausse" | "baisse" | "stable" | null {
  const known = series.map((s) => s.value).filter((v): v is number => v !== null);
  if (known.length < 2) return null;
  const diff = known[known.length - 1] - known[known.length - 2];
  return Math.abs(diff) < 0.3 ? "stable" : diff > 0 ? "hausse" : "baisse";
}

export const average = avg;
