/** Relances automatiques des sondages (JP, 18 nov. 2026) : une famille qui n'a pas répondu reçoit un rappel par courriel
 *  2, 5 et 7 jours après l'envoi de son invitation, jamais plus de 3, et seulement le jour (9 h à 20 h). Règles pures. */

export const REMINDER_DAYS = [2, 5, 7] as const;

export function reminderDue(sentAt: string | null, reminderCount: number, now: Date): boolean {
  if (!sentAt || reminderCount >= REMINDER_DAYS.length) return false;
  const days = (now.getTime() - Date.parse(sentAt)) / 86_400_000;
  return days >= REMINDER_DAYS[reminderCount];
}

/** Heure de Montréal : on n'écrit pas aux familles la nuit. */
export function isDaytime(now: Date): boolean {
  const h = Number(now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Toronto" }));
  return h >= 9 && h < 20;
}
