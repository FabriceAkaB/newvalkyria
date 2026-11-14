/** Boîte à idées de l'académie (règles pures, testées). Une idée vient du site public ou de l'espace parent ;
 *  l'académie répond et la fait avancer. Les idées réalisées peuvent être montrées sur le site (« grâce à vous »). */

export const IDEA_CATEGORIES = [
  { id: "pratiques", label: "Pratiques et entraînements" },
  { id: "matchs", label: "Matchs et tournois" },
  { id: "activites", label: "Activités et événements" },
  { id: "boutique", label: "Boutique et uniformes" },
  { id: "communication", label: "Communication et horaire" },
  { id: "nouveau-programme", label: "Nouveau programme ou camp" },
  { id: "autre", label: "Autre" }
] as const;
export type IdeaCategory = (typeof IDEA_CATEGORIES)[number]["id"];
export const categoryLabel = (c: string) => IDEA_CATEGORIES.find((x) => x.id === c)?.label ?? "Autre";

export type IdeaStatus = "nouvelle" | "a_l_etude" | "retenue" | "realisee" | "non_retenue";
export const IDEA_STATUS: { id: IdeaStatus; label: string; family: string; tone: "info" | "warn" | "good" | "bad" }[] = [
  { id: "nouvelle", label: "Nouvelle", family: "Reçue", tone: "info" },
  { id: "a_l_etude", label: "À l'étude", family: "On y réfléchit", tone: "warn" },
  { id: "retenue", label: "Retenue", family: "Retenue : on la prépare", tone: "good" },
  { id: "realisee", label: "Réalisée", family: "Réalisée grâce à vous !", tone: "good" },
  { id: "non_retenue", label: "Non retenue", family: "Pas pour l'instant", tone: "bad" }
];
export const statusOf = (s: string) => IDEA_STATUS.find((x) => x.id === s) ?? IDEA_STATUS[0];

export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 1500;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface IdeaInput {
  category: IdeaCategory;
  message: string;
  authorName: string | null;
  authorEmail: string | null;
  playerName: string | null;
}

/** Nettoie une idée envoyée par le formulaire ; retourne un message d'erreur si elle est invalide.
 *  Le champ « site » caché sert de piège à robots : rempli = refusé sans le dire. */
export function parseIdea(body: Record<string, unknown>): IdeaInput | string {
  const clean = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max) || null;
  if (String(body.site ?? "").trim()) return "robot";
  const message = String(body.message ?? "").trim().slice(0, MESSAGE_MAX);
  if (message.length < MESSAGE_MIN) return `Décrivez votre idée en au moins ${MESSAGE_MIN} caractères.`;
  const category = IDEA_CATEGORIES.some((c) => c.id === body.category) ? (body.category as IdeaCategory) : "autre";
  const authorEmail = clean(body.authorEmail, 200)?.toLowerCase() ?? null;
  if (authorEmail && !EMAIL.test(authorEmail)) return "Le courriel n'est pas valide.";
  return { category, message, authorName: clean(body.authorName, 120), authorEmail, playerName: clean(body.playerName, 120) };
}

/** Les idées à traiter d'abord : nouvelles, puis à l'étude, puis les plus récentes. */
export function sortIdeas<T extends { status: string; created_at: string }>(ideas: T[]): T[] {
  const order: Record<string, number> = { nouvelle: 0, a_l_etude: 1, retenue: 2, realisee: 3, non_retenue: 4 };
  return [...ideas].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || b.created_at.localeCompare(a.created_at));
}
