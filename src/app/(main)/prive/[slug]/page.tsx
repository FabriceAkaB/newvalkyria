import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrivateProgramContent, type PrivateProgramView } from "@/components/private-program-content";
import { env } from "@/lib/env";
import { countHeldPlaces, getPrivateProgram } from "@/lib/private-programs-repo";
import { getProgramDates } from "@/lib/session-programs-repo";

export const dynamic = "force-dynamic";

/** Page de vente non répertoriée : jamais indexée, absente des menus, du
 *  catalogue et du sitemap. Accessible uniquement par le lien direct. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const program = await getPrivateProgram(slug);
  return {
    title: program ? `${program.name} | New Valkyria` : "New Valkyria",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } }
  };
}

export default async function PrivateProgramPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ref?: string; cancelled?: string }>;
}) {
  const { slug } = await params;
  const { ref } = await searchParams;

  const program = await getPrivateProgram(slug);
  if (!program || !program.active) notFound();

  const [dates, held] = await Promise.all([getProgramDates(slug as never), countHeldPlaces(slug)]);
  const remaining = Math.max(0, program.max_capacity - held);
  const presentation = (program.presentation ?? {}) as PrivateProgramView["presentation"];

  const view: PrivateProgramView = {
    slug: program.slug,
    name: program.name,
    shortName: program.birth_years.includes("-") ? `Garçons ${program.birth_years.replace("-", "–")}` : `Garçons ${program.birth_years}`,
    birthYearsLabel: program.birth_years.replace("-", " et "),
    eligibleBirthYears: program.eligible_birth_years ?? [],
    priceCents: program.price_cents,
    capacity: program.max_capacity,
    remaining,
    isFull: remaining <= 0,
    practices: program.practices_count ?? 16,
    matches: program.matches_count ?? 3,
    installmentFeeCents: program.installment_fee_cents,
    referralDiscountCents: program.referral_discount_cents,
    secondInstallmentDate: program.second_installment_date,
    dates,
    presentation,
    origin: env.siteUrl
  };

  return <PrivateProgramContent program={view} initialRef={ref?.trim() || null} />;
}
