/** Borne de sondage hors ligne (JP, 17 nov. 2026) : une fois la page ouverte, les filles peuvent répondre même sans
 *  réseau. Chaque réponse est gardée sur l'iPad (file d'attente par pratique) et envoyée dès que le réseau revient.
 *  Règles pures, testées (kiosk-queue.test.ts) ; le stockage (localStorage) est dans survey-kiosk.tsx. */

export interface QueuedAnswer {
  registrationId: string;
  answers: Record<string, number>;
  /** Moment de la réponse (ms) : la plus récente gagne si la fille change ses réponses. */
  at: number;
}

export const queueKey = (activityId: string) => `nv-borne-${activityId}`;

/** Présence touchée sur la borne (JP, 18 nov. 2026) : « Absente » en un clic, ou remise si c'était une erreur. */
export interface QueuedPresence {
  registrationId: string;
  status: "absent" | "present";
  at: number;
}

export const presenceKey = (activityId: string) => `nv-borne-presence-${activityId}`;

/** Ajoute ou remplace l'élément d'une joueuse (une seule entrée par fille : la dernière). */
export function enqueue<T extends { registrationId: string; at: number }>(queue: T[], item: T): T[] {
  return [...queue.filter((q) => q.registrationId !== item.registrationId), item];
}

/** Enlève une réponse envoyée, sauf si la fille a répondu de nouveau pendant l'envoi (réponse plus récente). */
export function dequeue<T extends { registrationId: string; at: number }>(queue: T[], sent: T): T[] {
  return queue.filter((q) => q.registrationId !== sent.registrationId || q.at > sent.at);
}

/** Lecture prudente du stockage (vide, abîmé ou d'une autre version : file vide). */
export function parseQueue(raw: string | null): QueuedAnswer[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v)
      ? v.filter((q) => q && typeof q.registrationId === "string" && q.answers && typeof q.answers === "object" && typeof q.at === "number")
      : [];
  } catch {
    return [];
  }
}

export function parsePresenceQueue(raw: string | null): QueuedPresence[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((q) => q && typeof q.registrationId === "string" && (q.status === "absent" || q.status === "present") && typeof q.at === "number") : [];
  } catch {
    return [];
  }
}

/** Résultat d'un envoi : « sent » (enregistré), « retry » (pas de réseau ou serveur indisponible : on garde la
 *  réponse et on réessaie), « rejected » (le serveur refuse cette réponse : inutile de réessayer). */
export function sendOutcome(status: number | null): "sent" | "retry" | "rejected" {
  if (status === null || status === 0 || status >= 500 || status === 408 || status === 429) return "retry";
  return status >= 200 && status < 300 ? "sent" : "rejected";
}
