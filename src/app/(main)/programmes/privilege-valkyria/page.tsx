import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { PrivilegeValkyriaContent } from "@/components/privilege-valkyria-content";
import { SEASON_DB_ID } from "@/lib/season-2027-db-map";
import { countActiveRegistrations, getSeasonProgramCategories } from "@/lib/season-admin-repo";
import { getProgram, getProgramDates } from "@/lib/session-programs-repo";

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

  const [dates, taken, categoryCapacities] = await Promise.all([
    getProgramDates(slug),
    countActiveRegistrations(SEASON_DB_ID, { programId: "PV", categoryId: "2013-2012" }),
    getSeasonProgramCategories(SEASON_DB_ID)
  ]);
  const maxPlaces = categoryCapacities.find((c) => c.program_id === "PV" && c.category_id === "2013-2012")?.max_places ?? program.max_capacity;
  const remaining = Math.max(0, maxPlaces - taken);

  return (
    <PrivilegeValkyriaContent
      title={program.name}
      tagline="Filles nées 2013-2012"
      intro="Un encadrement technique personnalisé en très petit groupe (5 places), le samedi, pour progresser à un rythme individualisé."
      priceCents={program.price_cents}
      dates={dates}
      remaining={remaining}
      isFull={remaining <= 0}
    />
  );
}
