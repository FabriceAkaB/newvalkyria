import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { SessionProgramContent } from "@/components/session-program-content";
import { countActiveRegistrations, getProgram, getProgramDates } from "@/lib/session-programs-repo";

export const metadata: Metadata = {
  title: "Privilège Valkyria — Semi-privé du samedi | New Valkyria",
  description: "Semi-privé du samedi en très petit groupe pour joueuses nées en 2013-2012 — 15 séances techniques, encadrement personnalisé.",
  alternates: { canonical: "/programmes/privilege-valkyria" }
};

export const dynamic = "force-dynamic";

export default async function PrivilegeValkyriaPage() {
  const slug = "privilege-valkyria" as const;
  const program = await getProgram(slug);
  if (!program) notFound();

  const [dates, taken] = await Promise.all([getProgramDates(slug), countActiveRegistrations(slug)]);
  const remaining = Math.max(0, program.max_capacity - taken);

  return (
    <SessionProgramContent
      slug={slug}
      title={program.name}
      tagline="Filles nées 2013-2012"
      intro="Un encadrement technique personnalisé en très petit groupe (5 places), le samedi, pour progresser à un rythme individualisé."
      priceCents={program.price_cents}
      allowInstallments={false}
      installmentSurchargeCents={0}
      dates={dates}
      remaining={remaining}
      isFull={remaining <= 0}
    />
  );
}
