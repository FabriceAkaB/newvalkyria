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

/** Ajoute ou remplace la réponse d'une joueuse (une seule réponse par fille : la dernière). */
export function enqueue(queue: QueuedAnswer[], item: QueuedAnswer): QueuedAnswer[] {
  return [...queue.filter((q) => q.registrationId !== item.registrationId), item];
}

/** Enlève une réponse envoyée, sauf si la fille a répondu de nouveau pendant l'envoi (réponse plus récente). */
export function dequeue(queue: QueuedAnswer[], sent: QueuedAnswer): QueuedAnswer[] {
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

/** Résultat d'un envoi : « sent » (enregistré), « retry » (pas de réseau ou serveur indisponible : on garde la
 *  réponse et on réessaie), « rejected » (le serveur refuse cette réponse : inutile de réessayer). */
export function sendOutcome(status: number | null): "sent" | "retry" | "rejected" {
  if (status === null || status === 0 || status >= 500 || status === 408 || status === 429) return "retry";
  return status >= 200 && status < 300 ? "sent" : "rejected";
}
