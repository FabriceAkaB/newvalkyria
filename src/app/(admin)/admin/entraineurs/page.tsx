import { AdminEntraineurs, type CoachSummary } from "@/components/admin-entraineurs";
import { requireAdmin } from "@/lib/admin-auth";
import { startOfMonth, startOfWeek } from "@/lib/coach-payroll";
import { computeCoachNotifications, getPayrollRows } from "@/lib/coach-payroll-data";
import { getActivities, getCoaches } from "@/lib/coaches-repo";

export const metadata = { title: "Entraîneurs — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminEntraineursPage() {
  await requireAdmin({ roles: ["admin"] });

  const [coaches, rows, activities] = await Promise.all([getCoaches(), getPayrollRows(), getActivities()]);

  const today = new Date();
  const weekStartISO = startOfWeek(today).toISOString().slice(0, 10);
  const monthStartISO = startOfMonth(today).toISOString().slice(0, 10);

  const summaries: CoachSummary[] = coaches.map((coach) => {
    const own = rows.filter((r) => r.coachId === coach.id);
    let hoursWeek = 0;
    let hoursMonth = 0;
    let hoursTotal = 0;
    let payOwedCents = 0;
    let payPaidCents = 0;

    for (const r of own) {
      hoursTotal += r.hours;
      if (r.activityDate >= monthStartISO) hoursMonth += r.hours;
      if (r.activityDate >= weekStartISO) hoursWeek += r.hours;
      if (r.paid) payPaidCents += r.payCents;
      else payOwedCents += r.payCents;
    }

    return { coach, hoursWeek, hoursMonth, hoursTotal, payOwedCents, payPaidCents, balanceCents: payOwedCents };
  });

  const notifications = computeCoachNotifications(rows, activities, today);

  return <AdminEntraineurs summaries={summaries} notifications={notifications} />;
}
