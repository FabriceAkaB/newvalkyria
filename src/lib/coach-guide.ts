/** Guide de l'éducateur (JP, 17 nov. 2026) : ce qu'on coche avant chaque pratique pour être organisé, même sans
 *  expérience, et les heures exactes des alarmes (début et fin de chaque exercice) pour respecter le temps prévu.
 *  Règles pures, testées (coach-guide.test.ts). */

export const GUIDE_ITEMS = [
  { key: "lecture", label: "J'ai lu la pratique et chaque exercice", detail: "Diapos ouvertes, chaque fiche lue : je sais expliquer chaque exercice en moins de 2 minutes." },
  { key: "alarmes", label: "Alarmes réglées : début et fin de chaque exercice", detail: "Les heures sont juste en dessous. Ou je lance le minuteur du portail à l'étape « Pendant » : il sonne à chaque changement." },
  { key: "montage", label: "Terrain monté avant l'arrivée des filles", detail: "Le montage de la 1re activité est prêt ; je sais ce que je change entre chaque bloc." },
  { key: "materiel", label: "Matériel prêt", detail: "Ballons (1 par fille + réserve), coupelles, dossards, mini-buts, brassards de capitaine, chrono, sifflet." },
  { key: "roles", label: "Rôles décidés entre éducateurs", detail: "Qui explique, qui filme, qui corrige, qui s'occupe de la psychomotricité." },
  { key: "capitaines", label: "Équipes et capitaines prêts", detail: "Un brassard par équipe. La capitaine connaît sa tâche de communication et son pouvoir : 1 temps mort pour ajuster son équipe." },
  { key: "evolution", label: "Pour chaque exercice : 1 variante et 1 progression", detail: "L'exercice doit évoluer pendant qu'on le joue : c'est ce qui rend les filles intelligentes." },
  { key: "theme", label: "Je connais le thème et je ne corrige que lui", detail: "En ball mastery, chaque éducateur a ses joueuses, les plus faibles d'abord : on les repère avec les séquences plus difficiles et on les encadre de près. Pas de discussion entre coachs pendant le bloc." },
  { key: "interventions", label: "3 interventions au plus par exercice, ensuite on laisse jouer", detail: "Courtes et sur le thème. Le reste du temps, les filles répètent : petits jeux à 2 contre 2 ou 3 contre 3, un maximum de touches." },
  { key: "tenue", label: "Tenue Valkyria complète", detail: "Tout le monde habillé pareil, jamais en noir." },
  { key: "borne", label: "Borne du sondage ouverte sur l'iPad", detail: "Onglet « Sondage des jeunes » : l'ouvrir avant d'arriver au gymnase (elle marche ensuite sans réseau)." }
] as const;
export type GuideKey = (typeof GUIDE_ITEMS)[number]["key"];

export const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
export const toHhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export interface Alarm {
  time: string;
  label: string;
  kind: "debut" | "fin";
}

/** Les alarmes de la pratique : le début de chaque bloc, et la fin du dernier (les blocs se suivent). */
export function alarmPlan(start: string, blocks: { title: string; minutes: number }[]): Alarm[] {
  const out: Alarm[] = [];
  let t = toMinutes(start);
  for (const b of blocks) {
    out.push({ time: toHhmm(t), label: `Début : ${b.title}`, kind: "debut" });
    t += Math.max(0, b.minutes);
  }
  if (blocks.length) out.push({ time: toHhmm(t), label: "Fin : bilan, sondage et rangement", kind: "fin" });
  return out;
}

/** Où en est le minuteur : le bloc en cours, le temps qui reste (secondes) et le suivant. */
export function timerState(startedAtMs: number, nowMs: number, blocks: { title: string; minutes: number }[]): { index: number; remaining: number; done: boolean } {
  let elapsed = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
  for (let i = 0; i < blocks.length; i++) {
    const len = Math.max(0, blocks[i].minutes) * 60;
    if (elapsed < len) return { index: i, remaining: len - elapsed, done: false };
    elapsed -= len;
  }
  return { index: blocks.length, remaining: 0, done: true };
}
