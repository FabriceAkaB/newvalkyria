/** Le type de salle de chaque pratique de l'Académie (règle de JP, 15 nov. 2026), règles pures :
 *  lundi et mercredi = gymnase double (Sainte-Thérèse), jeudi = 2 tiers du gymnase double (Prévost),
 *  pratiques d'équipe (dimanche, parfois samedi) = synthétique, terrain à 7. Sert à monter la bonne pratique
 *  pour le bon espace et à compter ce qu'il reste à monter pour l'hiver. */

export type Venue = "gym-double" | "gym-deux-tiers" | "synthetique" | "autre";

export const VENUES: { id: Venue; label: string; short: string; icon: string }[] = [
  { id: "gym-double", label: "Gymnase double", short: "Gym double", icon: "🏀" },
  { id: "gym-deux-tiers", label: "Deux tiers du gymnase double", short: "Gym 2/3", icon: "🏐" },
  { id: "synthetique", label: "Synthétique, terrain à 7", short: "Synthétique à 7", icon: "🌱" },
  { id: "autre", label: "Autre", short: "Autre", icon: "📍" }
];
export const venueLabel = (v: Venue) => VENUES.find((x) => x.id === v) ?? VENUES[3];

const SYNTHETIC = /synth|terrain\s*(#|à|a)\s*\d|soccer multifonctionnel|multisports de rosem|\bCMR\b/i;

export function venueOf(p: { date: string; location: string | null; group: string; source: string }): Venue {
  const dow = new Date(`${p.date}T12:00:00Z`).getUTCDay();
  if (/^É?quipe\b|^Equipe\b/i.test(p.group) || SYNTHETIC.test(p.location ?? "")) return "synthetique";
  if (p.source !== "saison") return "autre";
  if (dow === 1 || dow === 3) return "gym-double";
  if (dow === 4) return "gym-deux-tiers";
  return "autre";
}
