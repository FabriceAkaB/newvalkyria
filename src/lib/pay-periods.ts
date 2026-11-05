/** Calendrier de paie des éducateurs (par club) : une paie toutes les `everyDays` jours à partir de `firstPayDate` ;
 *  chaque paie couvre les `everyDays` jours qui finissent `periodEndsDaysBefore` jours avant (ex. paie du vendredi
 *  13 novembre = du dimanche 25 octobre au samedi 7 novembre). Règles pures, testées. */

export interface PaySchedule {
  firstPayDate: string;
  everyDays: number;
  periodEndsDaysBefore: number;
}

/** New Valkyria : aux 2 semaines, première paie le vendredi 13 novembre 2026 (contrats : périodes du dimanche au samedi). */
export const DEFAULT_PAY_SCHEDULE: PaySchedule = { firstPayDate: "2026-11-13", everyDays: 14, periodEndsDaysBefore: 6 };

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const diffDays = (a: string, b: string) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000);

export interface PayPeriod {
  payDate: string;
  from: string;
  to: string;
}

export function periodFor(payDate: string, s: PaySchedule = DEFAULT_PAY_SCHEDULE): PayPeriod {
  const to = addDays(payDate, -s.periodEndsDaysBefore);
  return { payDate, from: addDays(to, -(s.everyDays - 1)), to };
}

/** La prochaine paie (aujourd'hui compris) et la période qu'elle couvre. */
export function nextPayPeriod(today: string, s: PaySchedule = DEFAULT_PAY_SCHEDULE): PayPeriod {
  const d = diffDays(today, s.firstPayDate);
  const n = d <= 0 ? 0 : Math.ceil(d / s.everyDays);
  return periodFor(addDays(s.firstPayDate, n * s.everyDays), s);
}

/** La paie qui couvre un jour d'activité. */
export function payPeriodOf(activityDate: string, s: PaySchedule = DEFAULT_PAY_SCHEDULE): PayPeriod {
  const first = periodFor(s.firstPayDate, s);
  const n = Math.floor(diffDays(activityDate, first.from) / s.everyDays);
  return periodFor(addDays(s.firstPayDate, n * s.everyDays), s);
}
