import type { PrivateProgramView } from "@/components/private-program-content";
import { env } from "@/lib/env";
import { countHeldPlaces, type PrivateProgram } from "@/lib/private-programs-repo";
import { getProgramDates } from "@/lib/session-programs-repo";

/** Marque affichée sur la page : New Valkyria (par défaut) ou FC Atlantic (programme garçons 2014,
 *  présenté sans mention de New Valkyria). Réglée dans presentation.brand. */
export type ProgramBrand = "nv" | "atlantic";

export function programBrand(program: Pick<PrivateProgram, "presentation">): ProgramBrand {
  return (program.presentation as { brand?: string } | null)?.brand === "atlantic" ? "atlantic" : "nv";
}

/** Programme « en attente » : seulement une inscription à la liste d'attente (aucune date ni prix). */
export function isWaitlistOnly(program: Pick<PrivateProgram, "presentation">): boolean {
  return Boolean((program.presentation as { waitlistOnly?: boolean } | null)?.waitlistOnly);
}

/** Programme « essai gratuit seulement » : la page n'offre que la réservation d'un essai (ex. 2018). */
export function isTrialOnly(program: Pick<PrivateProgram, "presentation">): boolean {
  return Boolean((program.presentation as { trialOnly?: boolean } | null)?.trialOnly);
}

export async function buildPrivateProgramView(program: PrivateProgram, live: boolean): Promise<PrivateProgramView> {
  const [dates, held] = await Promise.all([getProgramDates(program.slug as never), countHeldPlaces(program.slug)]);
  const remaining = Math.max(0, program.max_capacity - held);
  const presentation = (program.presentation ?? {}) as PrivateProgramView["presentation"];
  const waitlistOnly = isWaitlistOnly(program);

  return {
    slug: program.slug,
    name: program.name,
    shortName: `${program.gender === "filles" ? "Filles" : program.gender === "mixte" ? "Joueurs" : "Garçons"} ${program.birth_years.replace("-", "–")}`,
    birthYearsLabel: program.birth_years.replace("-", " et "),
    genderLabel: program.gender === "filles" ? "Filles nées" : program.gender === "mixte" ? "Joueurs nés" : "Garçons nés",
    draft: !live,
    eligibleBirthYears: program.eligible_birth_years ?? [],
    priceCents: program.price_cents,
    saturdayPackageCents: waitlistOnly ? null : (program.saturday_package_price_cents ?? null),
    capacity: program.max_capacity,
    minCapacity: program.min_capacity,
    remaining,
    isFull: waitlistOnly || remaining <= 0,
    practices: program.practices_count ?? 16,
    matches: program.matches_count ?? 3,
    installmentFeeCents: program.installment_fee_cents,
    referralDiscountCents: program.referral_discount_cents,
    secondInstallmentDate: program.second_installment_date,
    dates: waitlistOnly ? [] : dates,
    presentation,
    origin: env.publicSiteUrl,
    brand: programBrand(program),
    waitlistOnly,
    trialOnly: isTrialOnly(program)
  };
}
