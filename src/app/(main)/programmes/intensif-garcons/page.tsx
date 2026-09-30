import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { SessionProgramContent } from "@/components/session-program-content";
import { countActiveRegistrations, getProgram, getProgramDates } from "@/lib/session-programs-repo";

export const metadata: Metadata = {
  title: "Programme Intensif — Garçons 2015-2014 | New Valkyria",
  description: "Préparation technique intensive pour garçons nés en 2015-2014 — 12 séances réparties entre deux lieux d'entraînement, incluant 3 matchs amicaux.",
  alternates: { canonical: "/programmes/intensif-garcons" }
};

export const dynamic = "force-dynamic";

export default async function ProgrammeIntensifPage() {
  const slug = "intensif-garcons" as const;
  const program = await getProgram(slug);
  if (!program) notFound();

  const [dates, taken] = await Promise.all([getProgramDates(slug), countActiveRegistrations(slug)]);
  const remaining = Math.max(0, program.max_capacity - taken);

  return (
    <SessionProgramContent
      slug={slug}
      title={program.name}
      tagline="Garçons nés 2015-2014"
      intro="Une préparation technique intensive de 12 séances, réparties entre l'École de la Voltige (Sainte-Thérèse) et l'École Chambéry (Blainville), incluant 3 matchs amicaux (dates à déterminer)."
      priceCents={program.price_cents}
      allowInstallments
      dates={dates}
      remaining={remaining}
      isFull={remaining <= 0}
    />
  );
}
