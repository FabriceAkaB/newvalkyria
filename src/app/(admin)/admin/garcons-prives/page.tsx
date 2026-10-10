import { AdminPrives } from "@/components/admin-prives";
import { requireAdmin } from "@/lib/admin-auth";
import { env } from "@/lib/env";
import { getProgramDates } from "@/lib/session-programs-repo";
import { countHeldPlaces, countPaidPlaces, getAllPrivatePrograms, getPrivateRegistrationRows, getWaitlistCount } from "@/lib/private-programs-repo";

export const metadata = { title: "Programmes garçons privés — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminGarconsPrivesPage() {
  await requireAdmin();
  const [programs, registrations] = await Promise.all([getAllPrivatePrograms(), getPrivateRegistrationRows()]);
  const stats: Record<string, { held: number; paid: number; waitlist: number }> = {};
  const dates: Record<string, Awaited<ReturnType<typeof getProgramDates>>> = {};
  for (const p of programs) {
    const [held, paid, waitlist, d] = await Promise.all([countHeldPlaces(p.slug), countPaidPlaces(p.slug), getWaitlistCount(p.slug), getProgramDates(p.slug as never)]);
    stats[p.slug] = { held, paid, waitlist };
    dates[p.slug] = d;
  }
  return <AdminPrives programs={programs} stats={stats} dates={dates} registrations={registrations} origin={env.publicSiteUrl} />;
}
