/** Formation des éducateurs (JP, 17 nov. 2026 ; plan des deux espaces, phase 4) : le parcours pour coacher à la place
 *  de JP avec la même qualité. Chaque module renvoie à ce qui est déjà écrit dans le site (méthode, gestes, grille
 *  d'observation, rapport du portail) : aucun contenu de méthode n'est inventé ici. L'éducateur lit et confirme ;
 *  JP valide après l'avoir observé. Tous les modules validés = prêt à diriger un groupe (certification interne
 *  P1.4.02, que JP complète). Règles pures, testées. */

export interface TrainingModule {
  key: string;
  title: string;
  why: string;
  href: string;
  /** Comment JP valide le module. */
  check: string;
}

export const TRAINING_MODULES: TrainingModule[] = [
  { key: "obligatoire", title: "L'obligatoire de chaque entraînement", why: "Ce qui doit se retrouver dans chaque séance, sans exception.", href: "/entraineur/methode#obligatoire", check: "JP le voit dans une séance observée." },
  { key: "seance", title: "Une séance Valkyria, bloc par bloc", why: "Le déroulement et le temps de chaque bloc, pour que chaque séance se ressemble d'un éducateur à l'autre.", href: "/entraineur/methode#seance", check: "Une séance tenue dans les temps, minuteur en main." },
  { key: "principes", title: "Nos principes", why: "Ce que l'académie défend sur le terrain.", href: "/entraineur/methode#principes", check: "L'éducateur explique chaque principe avec un exemple de sa pratique." },
  { key: "gestes", title: "Les gestes du passeport", why: "Chaque geste par niveau, avec sa vidéo : ce qu'on enseigne et comment on le reconnaît.", href: "/entraineur/methode#gestes", check: "L'éducateur démontre et corrige 3 gestes devant JP." },
  { key: "regle", title: "La règle du coach", why: "Parler moins de 20 % du temps, poser des questions, un compliment précis à chaque fille, toutes actives, plan respecté : la grille de l'observation mensuelle.", href: "/entraineur/dossier", check: "Au moins 8/10 à une observation filmée de JP." },
  { key: "portail", title: "Le portail : avant, pendant, après", why: "Lire la pratique et cocher le guide la veille, présences, équipes et capitaines, évaluation de chaque fille, sondage de fin, championnes, retour sur la pratique.", href: "/entraineur/dashboard", check: "Trois rapports complets d'affilée, sans relance." },
  { key: "laboratoire", title: "Améliorer la méthode", why: "Tester une idée à une pratique dans le laboratoire, noter si la séance s'est améliorée.", href: "/entraineur/laboratoire", check: "Un essai noté dans le laboratoire." }
];

export interface TrainingRow {
  module: string;
  read_at: string | null;
  validated_at: string | null;
}

export type ModuleState = "a_lire" | "a_valider" | "valide";

export function moduleState(row: TrainingRow | undefined): ModuleState {
  if (row?.validated_at) return "valide";
  if (row?.read_at) return "a_valider";
  return "a_lire";
}

/** Où en est l'éducateur : modules lus, validés, le prochain à faire, prêt à diriger un groupe. */
export function trainingProgress(rows: TrainingRow[]) {
  const by = new Map(rows.map((r) => [r.module, r]));
  const states = TRAINING_MODULES.map((m) => ({ module: m, state: moduleState(by.get(m.key)) }));
  const validated = states.filter((s) => s.state === "valide").length;
  const read = states.filter((s) => s.state !== "a_lire").length;
  return {
    states,
    read,
    validated,
    total: TRAINING_MODULES.length,
    next: states.find((s) => s.state === "a_lire")?.module ?? null,
    certified: validated === TRAINING_MODULES.length
  };
}
