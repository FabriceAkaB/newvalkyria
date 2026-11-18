/** Signes de départ (Mandalart P4.7.01, JP 18 nov. 2026 : « quelle famille risque de partir, avant qu'elle parte ? ») :
 *  une joueuse qui manque 2 pratiques de suite, ou qui passe de 2 séances à 1 par semaine, fait apparaître un appel
 *  à faire dans « Aujourd'hui ». Règles pures ; les données viennent de activity_player_attendance (departure-signals-repo.ts). */

export interface AttendanceMark {
  date: string;
  present: boolean;
}

export type SignalKind = "absences-de-suite" | "frequence-en-baisse";

export interface DepartureSignal {
  kind: SignalKind;
  /** Phrase courte pour l'appel, ex. « 2 pratiques manquées de suite (12 et 16 nov.) ». */
  reason: string;
  /** Dernière présence connue (AAAA-MM-JJ) ou null. */
  lastPresent: string | null;
}

const short = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { day: "numeric", month: "short", timeZone: "UTC" });
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/** Le signal d'une joueuse, ou null si tout va bien. `marks` : ses pratiques passées (présente ou absente), toutes dates confondues. */
export function departureSignal(marks: AttendanceMark[], today: string): DepartureSignal | null {
  const past = marks.filter((m) => m.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  if (!past.length) return null;
  const lastPresent = [...past].reverse().find((m) => m.present)?.date ?? null;
  // 1. Deux pratiques (ou plus) manquées de suite, les plus récentes.
  let streak = 0;
  for (let i = past.length - 1; i >= 0 && !past[i].present; i--) streak++;
  if (streak >= 2) {
    const missed = past.slice(-streak).map((m) => short(m.date));
    return { kind: "absences-de-suite", reason: `${streak} pratiques manquées de suite (${missed.length > 3 ? `depuis le ${missed[0]}` : missed.join(", ").replace(/, ([^,]*)$/, " et $1")})`, lastPresent };
  }
  // 2. Fréquence en baisse : au moins 2 présences par semaine sur les 14 jours d'avant, au plus 1 par semaine sur les 14 derniers jours.
  const recent = past.filter((m) => m.present && daysBetween(m.date, today) < 14).length;
  const before = past.filter((m) => m.present && daysBetween(m.date, today) >= 14 && daysBetween(m.date, today) < 28).length;
  if (before >= 4 && recent <= 2) {
    return { kind: "frequence-en-baisse", reason: `${recent === 0 ? "pas venue" : `venue ${recent} fois`} en 2 semaines, contre ${before} fois les 2 semaines d'avant`, lastPresent };
  }
  return null;
}
