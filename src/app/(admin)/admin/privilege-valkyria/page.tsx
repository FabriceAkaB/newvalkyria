import { notFound } from "next/navigation";

import { AdminSessionProgram } from "@/components/admin-session-program";
import { requireAdmin } from "@/lib/admin-auth";
import { getAllRegistrations, getProgram, getProgramDates } from "@/lib/session-programs-repo";

export const metadata = { title: "Privilège Valkyria — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminPrivilegeValkyriaPage() {
  await requireAdmin();
  const slug = "privilege-valkyria" as const;
  const program = await getProgram(slug);
  if (!program) notFound();

  const [dates, registrations] = await Promise.all([getProgramDates(slug), getAllRegistrations(slug)]);

  return <AdminSessionProgram slug={slug} program={program} initialDates={dates} initialRegistrations={registrations} />;
}
