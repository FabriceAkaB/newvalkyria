/** Avis et témoignages des familles (JP, 19 nov. 2026). Règles pures.
 *  Google et Facebook ne permettent pas qu'un site publie un avis à la place de quelqu'un : le parent écrit son avis
 *  une fois chez nous, le texte est copié, et un bouton ouvre la page d'avis Google ou Facebook où il le colle.
 *  Aucune récompense n'est liée aux avis Google ou Facebook (interdit par leurs règles : fiche suspendue) ;
 *  le crédit récompense seulement le témoignage vidéo, validé par l'académie, pour ses propres réseaux. */

export const REVIEW_MIN_CHARS = 20;
export const DEFAULT_VIDEO_CREDIT_CENTS = 2500;

export function checkReview(body: unknown): { ok: true; stars: number; text: string } | { ok: false; error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const stars = Number(b.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { ok: false, error: "Choisissez de 1 à 5 étoiles." };
  const text = typeof b.text === "string" ? b.text.trim().slice(0, 3000) : "";
  if (text.length < REVIEW_MIN_CHARS) return { ok: false, error: "Écrivez au moins une phrase : ce que votre fille vit à l'académie, ce que vous aimez." };
  return { ok: true, stars, text };
}

/** Le texte à coller sur Google ou Facebook : l'avis tel quel (les étoiles se cliquent là-bas). */
export const reviewClipboard = (text: string) => text.trim();

export const VIDEO_STATUS_LABEL: Record<string, string> = {
  aucune: "Pas encore de vidéo",
  "a-valider": "Reçue : l'équipe la regarde",
  approuvee: "Merci ! Votre témoignage est validé",
  refusee: "À refaire (voir le mot de l'équipe)"
};
