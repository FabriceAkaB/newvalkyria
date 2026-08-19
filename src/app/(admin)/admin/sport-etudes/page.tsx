import { AdminSportEtudes } from "@/components/admin-sport-etudes";
import { requireAdmin } from "@/lib/admin-auth";
import { getAllRegistrations, getAllSessions, getEnrollmentsForRegistration, getSettings } from "@/lib/sport-etudes-repo";

export const metadata = { title: "Sport-Études — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminSportEtudesPage() {
  await requireAdmin();

  const [sessions, settings, registrations] = await Promise.all([getAllSessions(), getSettings(), getAllRegistrations()]);
  const registrationsWithEnrollments = await Promise.all(
    registrations.map(async (r) => ({ ...r, enrollments: await getEnrollmentsForRegistration(r.id) }))
  );

  return <AdminSportEtudes initialSessions={sessions} initialSettings={settings} initialRegistrations={registrationsWithEnrollments} />;
}
