/** Règle de deux (Mandalart P8.3.01, JP 19 nov. 2026) : « jamais un adulte seul avec une mineure ». Le texte que
 *  chaque éducateur lit dans Mon dossier, puis signe (nom tapé + date + IP). Règles pures, testées (rule-of-two.test.ts).
 *  Changer le texte = changer RULE_OF_TWO_VERSION : tout le monde signe à nouveau. */

export const RULE_OF_TWO_VERSION = "2026-11-19";

export const RULE_OF_TWO_TITLE = "Règle de deux : jamais seul avec une joueuse";

export const RULE_OF_TWO_ITEMS: { title: string; text: string }[] = [
  { title: "Jamais seul", text: "Je ne suis jamais seul avec une joueuse, ni en personne ni par message privé (texto, réseaux sociaux, appel)." },
  { title: "Toujours un 2e adulte", text: "Un autre éducateur ou un parent est toujours présent et peut voir ce qui se passe : avant, pendant et après la pratique." },
  { title: "Communications", text: "J'écris aux joueuses seulement par leur parent ou dans le groupe de l'équipe, jamais en privé." },
  { title: "Trajets", text: "Je ne raccompagne jamais une joueuse seul dans ma voiture. Une fille qui attend son parent attend avec deux adultes." },
  { title: "Vestiaires", text: "Je n'entre pas dans un vestiaire occupé par des joueuses. S'il faut intervenir, j'y vais avec un 2e adulte." },
  { title: "Signaler", text: "Je signale à JP, le jour même, tout manquement à cette règle, que ce soit le mien ou celui d'un autre adulte." }
];

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();

/** La signature : le nom complet de l'éducateur, tapé tel quel (accents et majuscules ignorés). Renvoie le problème, ou null. */
export function checkSignerName(typed: string, coach: { first_name: string; last_name: string }): string | null {
  const t = norm(typed);
  if (t.length < 3) return "Écris ton prénom et ton nom pour signer.";
  const words = new Set(t.split(" "));
  const need = [...norm(coach.first_name).split(" "), ...norm(coach.last_name).split(" ")].filter(Boolean);
  if (!need.every((w) => words.has(w))) return `Écris ton nom complet tel qu'il est à ton dossier : ${coach.first_name} ${coach.last_name}.`;
  return null;
}
