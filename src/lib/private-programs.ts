/** Logique pure (sans dépendance serveur) des programmes privés garçons :
 *  prix, rabais de référencement, crédit, supplément 2 versements et
 *  admissibilité par année de naissance. Importable côté client (affichage
 *  en direct) comme côté serveur (source de vérité — jamais le client). */

export type PaymentOption = "full" | "two_installments";

export interface PriceInput {
  listCents: number;
  option: PaymentOption;
  /** Supplément TOTAL si paiement en 2 versements (ex. 4000 = 40 $). */
  installmentFeeCents: number;
  referralDiscountCents?: number;
  creditCents?: number;
}

export interface PriceBreakdown {
  listCents: number;
  referralDiscountCents: number;
  creditCents: number;
  /** Prix après rabais et crédit, avant supplément. */
  subtotalCents: number;
  installmentFeeCents: number;
  /** Total réellement dû (subtotal + supplément éventuel). */
  totalCents: number;
  /** Montants des versements — 1 seul pour le paiement complet. */
  paymentsCents: number[];
}

export function computePrice(input: PriceInput): PriceBreakdown {
  const referralDiscountCents = Math.max(0, Math.min(input.referralDiscountCents ?? 0, input.listCents));
  const afterReferral = input.listCents - referralDiscountCents;
  const creditCents = Math.max(0, Math.min(input.creditCents ?? 0, afterReferral));
  const subtotalCents = afterReferral - creditCents;
  const installmentFeeCents = input.option === "two_installments" ? Math.max(0, input.installmentFeeCents) : 0;
  const totalCents = subtotalCents + installmentFeeCents;

  let paymentsCents: number[];
  if (input.option === "two_installments") {
    const second = Math.floor(totalCents / 2);
    paymentsCents = [totalCents - second, second];
  } else {
    paymentsCents = [totalCents];
  }

  return { listCents: input.listCents, referralDiscountCents, creditCents, subtotalCents, installmentFeeCents, totalCents, paymentsCents };
}

/** « 12 à 14 » quand une capacité minimale est définie, sinon le maximum seul. */
export function capacityLabel(min: number | null | undefined, max: number): string {
  return min && min < max ? `${min} à ${max}` : String(max);
}

export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
}

/** Une année de naissance est admissible si elle figure dans la liste du programme. */
export function isBirthYearEligible(birthYear: number | null, eligible: string[] | null | undefined): boolean {
  if (!eligible || eligible.length === 0) return true;
  if (birthYear == null) return false;
  return eligible.includes(String(birthYear));
}

export function birthYearFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const year = Number(dob.slice(0, 4));
  return Number.isFinite(year) && year > 1900 ? year : null;
}

export const PRIVATE_PROGRAM_PATH = "/prive";

export function privateProgramUrl(origin: string, slug: string, refCode?: string | null): string {
  const base = `${origin.replace(/\/$/, "")}${PRIVATE_PROGRAM_PATH}/${slug}`;
  return refCode ? `${base}?ref=${encodeURIComponent(refCode)}` : base;
}

export interface ShareProgramInfo {
  slug: string;
  shortName: string;
  priceCents: number;
}

/** Message promotionnel partageable (blocs 10.2 / 10.3) — généré à partir des
 *  vraies données du programme pour ne jamais pointer vers le mauvais lien ni
 *  le mauvais prix. */
export function buildShareMessage(input: {
  program: ShareProgramInfo;
  link: string;
  practices: number;
  matches: number;
  capacity: number;
  minCapacity?: number | null;
  feeCents: number;
  referralDiscountCents: number;
  withReferralMention: boolean;
}): string {
  const { program, link, practices, matches, capacity, minCapacity, feeCents, referralDiscountCents, withReferralMention } = input;
  const lines = [
    "Bonjour !",
    "Je voulais te partager un programme de développement de soccer proposé par New Valkyria.",
    "",
    "Le programme comprend :",
    `• ${practices} pratiques d'entraînement`,
    `• ${matches} matchs inclus`,
    "• Un environnement axé sur le développement technique et la progression individuelle",
    `• Un nombre limité de ${capacityLabel(minCapacity, capacity)} joueurs`,
    "",
    `Groupe : ${program.shortName} — ${formatMoney(program.priceCents)}.`,
    feeCents > 0 ? `Possibilité de payer en deux versements avec un supplément total de ${formatMoney(feeCents)}.` : ""
  ];
  if (withReferralMention && referralDiscountCents > 0) {
    lines.push(`Si tu t'inscris avec mon lien de référencement et que tu es admissible, tu peux bénéficier d'un rabais de ${formatMoney(referralDiscountCents)}.`);
  }
  lines.push("", "Voici le lien pour consulter le programme et t'inscrire :", link);
  return lines.filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("\n");
}

export function shareLinks(message: string, link: string, subject: string) {
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(message)}`,
    email: `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`,
    sms: `sms:?&body=${encodeURIComponent(message)}`,
    link
  };
}
