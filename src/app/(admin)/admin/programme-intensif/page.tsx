import { notFound } from "next/navigation";

import { AdminSessionProgram } from "@/components/admin-session-program";
import { requireAdmin } from "@/lib/admin-auth";
import { getAllBoysRegistrations } from "@/lib/boys-registrations";
import { getAllRegistrations, getProgram, getProgramDates } from "@/lib/session-programs-repo";

export const metadata = { title: "Programme Intensif — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminProgrammeIntensifPage() {
  await requireAdmin();
  const slug = "intensif-garcons" as const;
  const program = await getProgram(slug);
  if (!program) notFound();

  const [dates, registrations, boysRegistrations] = await Promise.all([getProgramDates(slug), getAllRegistrations(slug), getAllBoysRegistrations()]);

  return <AdminSessionProgram slug={slug} program={program} initialDates={dates} initialRegistrations={registrations} boysRegistrations={boysRegistrations} />;
}
