import type { LaunchInputs, LaunchResults } from "@/lib/launch-calculator";
import type { ProjectEvaluation } from "@/lib/project-pipeline";

/** Le responsable financier (JP, 17 nov. 2026 ; agent A04) : il lit les projets et l'argent, et dit quoi faire.
 *  Règles pures : les conditions à remplir avant de lancer un projet, le seuil de la TPS/TVQ, la taxe à remettre.
 *  La page /admin/revenus/responsable les applique aux vraies données (finance-officer-repo.ts). */

export interface Requirement {
  key: string;
  label: string;
  /** Vérifié par le site (calculateur, sondage) ; sinon coché à la main. */
  auto: boolean;
  done: boolean;
  hint?: string;
}

/** Ce qu'on coche à la main : ce que le site ne peut pas savoir seul. */
export const MANUAL_REQUIREMENTS: { key: string; label: string; hint: string }[] = [
  { key: "lieu", label: "Lieu et heures réservés", hint: "Contrat ou confirmation écrite du gymnase ou du terrain." },
  { key: "educateurs", label: "Éducateurs confirmés (au moins 2 par groupe)", hint: "Règle de deux : jamais un adulte seul avec une mineure." },
  { key: "assurance", label: "Assurance qui couvre l'activité", hint: "Demander à l'assureur si le camp, le voyage ou le tournoi est couvert." },
  { key: "taxes", label: "Taxes validées avec le comptable", hint: "TPS/TVQ facturée ou exonérée pour ce projet." },
  { key: "subvention", label: "Subvention demandée (ou aucune possible)", hint: "Emplois d'été Canada, subvention salariale, Bon départ pour les familles." },
  { key: "page", label: "Page d'inscription et paiement prêts", hint: "Programme créé dans l'admin, prix et places, lien de paiement testé." }
];

export function projectRequirements(
  scenario: { inputs: LaunchInputs; results: LaunchResults; checks: Record<string, boolean> } | null,
  evaluation: ProjectEvaluation
): Requirement[] {
  const ready = !!scenario?.results.ready;
  const auto: Requirement[] = [
    { key: "chiffre", label: "Prix, places et coûts chiffrés", auto: true, done: ready, hint: ready ? undefined : "Calculateur : prix, places, terrain, éducateurs." },
    { key: "rentable", label: "Rentable : 50 % de marge à 70 % de remplissage", auto: true, done: scenario?.results.verdict === "go", hint: ready && scenario?.results.goPriceCents ? `Prix minimum : ${Math.ceil(scenario.results.goPriceCents / 100)} $` : undefined },
    { key: "interet", label: "Assez de familles intéressées", auto: true, done: evaluation.breakEven !== null && evaluation.probable >= evaluation.breakEven, hint: evaluation.breakEven !== null ? `${evaluation.probable} probables pour ${evaluation.breakEven} nécessaires` : undefined },
    { key: "date", label: "Date de début fixée", auto: true, done: !!scenario?.inputs.startDate },
    { key: "heures", label: "Tes heures comptées", auto: true, done: (scenario?.inputs.jpHours ?? 0) > 0, hint: "Pour savoir ce que rapporte une heure de ton temps." }
  ];
  const manual = MANUAL_REQUIREMENTS.map((m) => ({ key: m.key, label: m.label, auto: false, done: !!scenario?.checks?.[m.key], hint: m.hint }));
  return [...auto, ...manual];
}

export const requirementsDone = (items: Requirement[]) => items.filter((i) => i.done).length;

/** Seuil du petit fournisseur (TPS/TVQ) : 30 000 $ de ventes taxables dans un trimestre civil ou sur les 4 derniers trimestres. */
export const SMALL_SUPPLIER_CENTS = 3_000_000;

const quarterOf = (month: string) => `${month.slice(0, 4)}-T${Math.floor((Number(month.slice(5, 7)) - 1) / 3) + 1}`;

export interface TaxThreshold {
  /** Ventes des 4 derniers trimestres civils terminés et du trimestre en cours. */
  last4QuartersCents: number;
  overThreshold: boolean;
  /** Le premier trimestre où le seuil a été dépassé (seul ou sur 4 trimestres), ex. « 2026-T3 ». */
  firstOver: string | null;
}

export function taxThreshold(months: { month: string; revenueCents: number }[], today: string): TaxThreshold {
  const byQuarter = new Map<string, number>();
  for (const m of months) if (m.month <= today.slice(0, 7)) byQuarter.set(quarterOf(m.month), (byQuarter.get(quarterOf(m.month)) ?? 0) + m.revenueCents);
  const quarters = [...byQuarter.keys()].sort();
  let firstOver: string | null = null;
  for (let i = 0; i < quarters.length && !firstOver; i++) {
    const window = quarters.slice(Math.max(0, i - 3), i + 1).reduce((s, q) => s + (byQuarter.get(q) ?? 0), 0);
    if ((byQuarter.get(quarters[i]) ?? 0) > SMALL_SUPPLIER_CENTS || window > SMALL_SUPPLIER_CENTS) firstOver = quarters[i];
  }
  const last4QuartersCents = quarters.slice(-4).reduce((s, q) => s + (byQuarter.get(q) ?? 0), 0);
  return { last4QuartersCents, overThreshold: firstOver !== null, firstOver };
}

/** TPS/TVQ perçue (incluse dans les revenus) depuis l'inscription : l'argent à remettre à l'État. */
export function taxCollected(months: { month: string; revenueCents: number; revenueExTaxCents: number }[]): number {
  return months.reduce((s, m) => s + (m.revenueCents - m.revenueExTaxCents), 0);
}
