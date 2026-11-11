import { isOpen, type LiveTask } from "@/lib/mandalart-core";

/** « À développer en 2027 » : les grands chantiers de la prochaine année, vus d'un coup d'œil par JP (Mon plan)
 *  et par la gérante (Aujourd'hui). Chaque chantier regroupe des tâches du Mandalart (codes) : l'avancement et
 *  la prochaine étape viennent donc de l'état réel des tâches, jamais d'une liste tenue à part. Aucun montant ici. */

export type VisionWho = "jp" | "gerante" | "ensemble";

export interface VisionProject {
  key: string;
  emoji: string;
  title: string;
  /** Pourquoi on le fait, en une phrase. */
  why: string;
  who: VisionWho;
  codes: string[];
}

export const WHO_LABEL: Record<VisionWho, string> = { jp: "JP", gerante: "Gérante", ensemble: "JP + gérante" };

export const VISION_2027: VisionProject[] = [
  {
    key: "videos",
    emoji: "🎬",
    title: "Vidéos explicatives : comprendre New Valkyria avant de poser une question",
    why: "Ne pas vendre des séances, faire comprendre toute l'expérience : qui nous sommes, nos programmes, nos projets, les preuves, et ce qui se passe après l'inscription.",
    who: "ensemble",
    codes: ["P3.2.12", "P3.2.13", "P3.2.14", "P3.2.15", "P3.2.16", "P3.2.17", "P4.1.06"]
  },
  {
    key: "proof",
    emoji: "📈",
    title: "Valkyria Proof : montrer les progrès",
    why: "Les entrevues avant/après, les témoignages des parents et les filles entrées en sport-études prouvent ce que l'académie change.",
    who: "ensemble",
    codes: ["P8.1.02", "P3.2.07", "P3.2.08", "P3.2.09", "P8.1.03"]
  },
  {
    key: "family",
    emoji: "💜",
    title: "Valkyria Family : l'appartenance",
    why: "Les familles qui se sentent chez elles reviennent et amènent leurs amies.",
    who: "ensemble",
    codes: ["P4.5.01", "P4.5.03", "P4.6.01", "P4.6.02", "P4.6.03"]
  },
  {
    key: "coaching-os",
    emoji: "🧠",
    title: "Coaching OS : la méthode Valkyria partout pareille",
    why: "Banque d'exercices approuvés, pratique du jour, certification interne : la même qualité dans chaque groupe, peu importe l'éducateur.",
    who: "jp",
    codes: ["P1.3.07", "P1.3.08", "P1.4.02", "P1.4.03", "P1.4.04", "P1.3.10"]
  },
  {
    key: "materiel",
    emoji: "⚽",
    title: "Matériel New Val à notre image",
    why: "Ballons, maillots, pastilles, buts rétractables et imperméables New Val : commander les échantillons, tester, puis choisir les modèles.",
    who: "jp",
    codes: ["P1.6.05", "P1.6.06", "P2.6.04", "P2.6.05"]
  },
  {
    key: "boutique",
    emoji: "🛍️",
    title: "Une boutique qui vend plus",
    why: "Rabais après un nombre d'achats, ensembles, et le prix de consolation : une fille qui n'a rien gagné peut aller chercher quelque chose à la boutique.",
    who: "ensemble",
    codes: ["P2.6.01", "P2.6.06", "P2.6.07"]
  },
  {
    key: "ligue",
    emoji: "🏆",
    title: "Ligue d'hiver : l'analyse avant de décider",
    why: "Équipes, vrais coûts, revenus, avis des familles et ce que font les autres ligues, puis prix plancher et go/no-go.",
    who: "jp",
    codes: ["P7.2.04", "P3.7.01"]
  }
];

export interface VisionStep {
  code: string;
  title: string;
  owner: string | null;
  due: string | null;
  done: boolean;
  late: boolean;
}

export interface VisionView extends VisionProject {
  steps: VisionStep[];
  done: number;
  total: number;
  next: VisionStep | null;
}

/** Relie chaque chantier à l'état réel de ses tâches (les tâches abandonnées ne comptent pas). */
export function buildVision(tasks: LiveTask[], projects: VisionProject[] = VISION_2027): VisionView[] {
  const byCode = new Map(tasks.map((t) => [t.code, t]));
  return projects.map((p) => {
    const steps: VisionStep[] = p.codes
      .map((c) => byCode.get(c))
      .filter((t): t is LiveTask => !!t && t.status !== "abandonne")
      .map((t) => ({ code: t.code, title: t.title, owner: t.owner, due: t.due, done: !isOpen(t), late: t.overdue }))
      .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999") || a.code.localeCompare(b.code));
    const done = steps.filter((s) => s.done).length;
    return { ...p, steps, done, total: steps.length, next: steps.find((s) => !s.done) ?? null };
  });
}
