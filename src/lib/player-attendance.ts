/** La présence d'une joueuse, MonClubSportif faisant foi (JP, 26 nov. 2026). Règles pures, testées
 *  (player-attendance.test.ts) ; la lecture de MCS est dans `syncMcsAttendance` (mcs-robot-runner.ts).
 *
 *  - L'état d'une pratique = celui de MCS quand MCS a une réponse (présente, en retard, absente), sinon la marque de
 *    l'éducateur ou de la borne (déjà réglé dans la base par la lecture de MCS).
 *  - Une pratique annulée dans MCS ne compte pas.
 *  - Le pourcentage = présences ÷ pratiques où elle était attendue selon MCS (membre assignée à l'activité MCS,
 *    remplaçantes et invitées comprises), pas seulement les lignes de présence qui existent : une pratique attendue
 *    sans réponse nulle part compte comme « pas de réponse » (dans le total, pas dans les présences).
 *  - Une activité que MCS n'a pas encore lue (ancienne, ou hors MCS) garde ses lignes telles quelles. */

export const ATTENDED = ["present", "late", "left_early"];
/** Attendue dans MonClubSportif, sans réponse ni marque de l'éducateur. */
export const NO_ANSWER = "unknown";

export interface AlignActivity {
  id: string;
  date: string;
  /** Inscriptions assignées dans MCS ; null = activité pas lue dans MCS. */
  mcsExpected: string[] | null;
  mcsCancelled: boolean;
}

/** Quelles lignes garder et quelles pratiques attendues ajouter (« pas de réponse »). `today` exclu : la pratique du soir
 *  n'est pas encore « sans réponse ». */
export function alignAttendance(
  registrationId: string,
  rows: { activityId: string; status: string; activity: AlignActivity | null }[],
  expected: AlignActivity[],
  today: string
): { keep: number[]; missing: AlignActivity[] } {
  const keep: number[] = [];
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    seen.add(r.activityId);
    const a = r.activity;
    if (a?.mcsCancelled) return;
    // MCS a lu cette activité et elle n'y était pas assignée : une absence notée ne compte pas (pas attendue) ;
    // si elle est venue quand même, sa présence compte.
    if (a && Array.isArray(a.mcsExpected) && !a.mcsExpected.includes(registrationId) && !ATTENDED.includes(r.status)) return;
    keep.push(i);
  });
  const missing = expected.filter((a) => !seen.has(a.id) && !a.mcsCancelled && a.date < today && (a.mcsExpected ?? []).includes(registrationId));
  return { keep, missing };
}

/** Présences ÷ pratiques attendues (null sans pratique). */
export function attendanceRate(statuses: string[]): { present: number; total: number; rate: number | null } {
  const present = statuses.filter((s) => ATTENDED.includes(s)).length;
  return { present, total: statuses.length, rate: statuses.length ? Math.round((present / statuses.length) * 100) : null };
}
