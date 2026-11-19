/** Fiche de blessure (JP, 18 nov. 2026) : règles pures. L'éducateur décrit ce qui s'est passé, les premiers soins et
 *  si le parent est avisé ; un choc à la tête arrête toujours la joueuse et demande un appel au parent. */

export const INCIDENT_KINDS = [
  { value: "blessure", label: "Blessure" },
  { value: "choc-tete", label: "Choc à la tête" },
  { value: "malaise", label: "Malaise" },
  { value: "autre", label: "Autre" }
] as const;
export type IncidentKind = (typeof INCIDENT_KINDS)[number]["value"];

export const INCIDENT_STATUS = [
  { value: "ouverte", label: "À appeler" },
  { value: "suivi", label: "En suivi" },
  { value: "fermee", label: "De retour au jeu" }
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUS)[number]["value"];

export const kindLabel = (k: string) => INCIDENT_KINDS.find((x) => x.value === k)?.label ?? "Autre";
export const statusLabel = (s: string) => INCIDENT_STATUS.find((x) => x.value === s)?.label ?? s;

/** Choc à la tête : protocole commotion (Parachute / Soccer Québec), la joueuse ne revient pas au jeu ce jour-là. */
export const HEAD_KNOCK_RULE = "Choc à la tête : elle arrête de jouer pour aujourd'hui, même si elle dit que ça va. Le parent est appelé tout de suite ; pas de retour au jeu sans l'avis d'un professionnel de la santé.";

export interface IncidentInput {
  registrationId: string;
  kind: string;
  bodyPart?: string | null;
  description: string;
  firstAid?: string | null;
  stoppedPlaying?: boolean;
  parentNotified?: boolean;
}

const clean = (v: unknown, max = 1000) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Vérifie une fiche avant de l'enregistrer ; renvoie la fiche nettoyée ou le message pour l'éducateur. */
export function checkIncident(body: Record<string, unknown> | null | undefined): { ok: true; value: IncidentInput } | { ok: false; error: string } {
  const registrationId = clean(body?.registrationId, 64);
  if (!registrationId) return { ok: false, error: "Choisis la joueuse." };
  const kind = INCIDENT_KINDS.some((k) => k.value === body?.kind) ? (body!.kind as IncidentKind) : null;
  if (!kind) return { ok: false, error: "Choisis le type : blessure, choc à la tête, malaise ou autre." };
  const description = clean(body?.description, 2000);
  if (!description || description.split(/\s+/).length < 5) return { ok: false, error: "Décris ce qui s'est passé en une phrase (5 mots ou plus) : où, comment, ce qu'elle ressent." };
  return {
    ok: true,
    value: {
      registrationId,
      kind,
      bodyPart: clean(body?.bodyPart, 120),
      description,
      firstAid: clean(body?.firstAid, 1000),
      // Un choc à la tête arrête toujours la joueuse pour la journée.
      stoppedPlaying: kind === "choc-tete" ? true : body?.stoppedPlaying === true,
      parentNotified: body?.parentNotified === true
    }
  };
}

/** Titre de la tâche de JP pour une fiche ouverte. */
export function incidentTaskTitle(i: { kind: string; playerName: string; parentNotified: boolean }): string {
  const what = kindLabel(i.kind).toLowerCase();
  return i.parentNotified ? `Prendre des nouvelles de ${i.playerName} (${what} à la pratique)` : `Appeler la famille de ${i.playerName} (${what} à la pratique, parent pas encore avisé)`;
}
