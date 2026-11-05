/** Les tâches automatiques du site (une seule liste) : leur heure chez Vercel, la fenêtre pendant laquelle un passage
 *  de secours ne refait rien (Vercel a déjà roulé) et le délai après lequel « Aujourd'hui » alerte JP.
 *  Deux déclencheurs indépendants : Vercel Cron (vercel.json) et, 20 minutes plus tard, Supabase (pg_cron + pg_net,
 *  migration 20261135). Le 2e ne fait rien si le 1er a roulé. Pur, testé (cron-jobs.test.ts). */

export const CRON_JOBS = {
  "mcs-robot": { label: "Courriels programmés et robot MonClubSportif (chaque heure)", vercel: ["5 * * * *"], backup: ["25 * * * *"], windowMinutes: 50, maxGapHours: 2 },
  "charge-installments": { label: "Prélèvement des versements (chaque nuit)", vercel: ["0 4 * * *"], backup: ["20 4 * * *"], windowMinutes: 600, maxGapHours: 26 },
  "mandalart-lundi": { label: "Courriel Mandalart du lundi", vercel: ["0 11 * * 1"], backup: ["20 11 * * 1"], windowMinutes: 600, maxGapHours: 7 * 24 + 3 },
  pratiques: { label: "Rappel des pratiques à préparer (8 h et 16 h)", vercel: ["0 13 * * *", "0 21 * * *"], backup: ["20 13 * * *", "20 21 * * *"], windowMinutes: 180, maxGapHours: 15 },
  "presences-educateurs": { label: "Rappel des présences aux éducateurs", vercel: ["0 14 * * *", "0 23 * * *"], backup: ["20 14 * * *", "20 23 * * *"], windowMinutes: 180, maxGapHours: 17 },
  "mandalart-report": { label: "Report des tâches Mandalart (chaque matin)", vercel: ["0 9 * * *"], backup: ["20 9 * * *"], windowMinutes: 600, maxGapHours: 26 },
  "mcs-sync": { label: "Relecture des calendriers MonClubSportif (chaque matin)", vercel: ["0 10 * * *"], backup: ["20 10 * * *"], windowMinutes: 600, maxGapHours: 26 },
  arbitres: { label: "Invitation des arbitres (chaque jour)", vercel: ["0 15 * * *"], backup: ["20 15 * * *"], windowMinutes: 600, maxGapHours: 26 }
} as const;

export type CronName = keyof typeof CRON_JOBS;
export const CRON_NAMES = Object.keys(CRON_JOBS) as CronName[];
export const cronPath = (name: CronName) => `/api/cron/${name}`;

/** Le passage de secours ne refait rien si la tâche a déjà roulé dans sa fenêtre. */
export function backupShouldSkip(name: CronName, lastOkRunAt: string | null, now: Date): boolean {
  if (!lastOkRunAt) return false;
  return now.getTime() - Date.parse(lastOkRunAt) < CRON_JOBS[name].windowMinutes * 60_000;
}

export interface CronRunRow {
  name: string;
  source: string;
  ok: boolean;
  ran_at: string;
}

export interface CronAlert {
  name: CronName;
  label: string;
  detail: string;
}

/** Tâches en retard (aucun passage réussi depuis plus que leur délai) et refus du secret Vercel (CRON_SECRET absent ou différent). */
export function cronAlerts(runs: CronRunRow[], now: Date, watchingSince: string | null): CronAlert[] {
  const out: CronAlert[] = [];
  for (const name of CRON_NAMES) {
    const job = CRON_JOBS[name];
    const mine = runs.filter((r) => r.name === name);
    const lastOk = mine.filter((r) => r.ok).map((r) => r.ran_at).sort().at(-1) ?? null;
    const since = lastOk ?? watchingSince;
    if (since && now.getTime() - Date.parse(since) > job.maxGapHours * 3_600_000) {
      const hours = Math.round((now.getTime() - Date.parse(since)) / 3_600_000);
      out.push({ name, label: job.label, detail: lastOk ? `Aucun passage depuis ${hours} h.` : `Jamais roulé depuis la mise en place de la surveillance (${hours} h).` });
    }
    const lastVercel = mine.filter((r) => r.source === "vercel").sort((a, b) => a.ran_at.localeCompare(b.ran_at)).at(-1);
    if (lastVercel && !lastVercel.ok && now.getTime() - Date.parse(lastVercel.ran_at) < 26 * 3_600_000) {
      out.push({ name, label: job.label, detail: "Vercel appelle la tâche mais son secret est refusé : CRON_SECRET à vérifier dans Vercel (le secours Supabase prend le relais)." });
    }
  }
  return out;
}
