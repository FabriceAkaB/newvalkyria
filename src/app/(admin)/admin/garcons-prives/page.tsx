import { AdminPrives } from "@/components/admin-prives";
import { requireAdmin } from "@/lib/admin-auth";
import { env } from "@/lib/env";
import { countHeldPlaces, countPaidPlaces, getAllPrivatePrograms, getPrivateRegistrationRows, getWaitlistCount } from "@/lib/private-programs-repo";

export const metadata = { title: "Programmes garçons privés — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminGarconsPrivesPage() {
  await requireAdmin();
  const [programs, registrations] = await Promise.all([getAllPrivatePrograms(), getPrivateRegistrationRows()]);
  const stats: Record<string, { held: number; paid: number; waitlist: number }> = {};
  for (const p of programs) {
    const [held, paid, waitlist] = await Promise.all([countHeldPlaces(p.slug), countPaidPlaces(p.slug), getWaitlistCount(p.slug)]);
    stats[p.slug] = { held, paid, waitlist };
  }
  return <AdminPrives programs={programs} stats={stats} registrations={registrations} origin={env.siteUrl} />;
}
