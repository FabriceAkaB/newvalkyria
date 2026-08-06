import { AdminEntraineurs, type CoachSummary } from "@/components/admin-entraineurs";
import { requireAdmin } from "@/lib/admin-auth";
import { computeAssignment, startOfMonth, startOfWeek } from "@/lib/coach-payroll";
import { getAllAssignments, getAllCoachTypeRates, getCoaches } from "@/lib/coaches-repo";

export const metadata = { title: "Entraîneurs — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminEntraineursPage() {
  await requireAdmin();

  const [coaches, assignments, typeRates] = await Promise.all([getCoaches(), getAllAssignments(), getAllCoachTypeRates()]);

  const typeRateMap = new Map(typeRates.map((r) => [`${r.coach_id}:${r.activity_type}`, r.hourly_rate_cents]));

  const today = new Date();
  const weekStart = startOfWeek(today);
  const monthStart = startOfMonth(today);

  const summaries: CoachSummary[] = coaches.map((coach) => {
    const own = assignments.filter((a) => a.coach_id === coach.id);
    let hoursWeek = 0;
    let hoursMonth = 0;
    let hoursTotal = 0;
    let payOwedCents = 0;
    let payPaidCents = 0;

    for (const a of own) {
      const computed = computeAssignment({
        status: a.status,
        arrivalTime: a.arrival_time,
        departureTime: a.departure_time,
        activityStartTime: a.activity.start_time,
        activityEndTime: a.activity.end_time,
        assignmentRateCents: a.hourly_rate_cents,
        typeRateCents: typeRateMap.get(`${coach.id}:${a.activity.activity_type}`) ?? null,
        defaultRateCents: coach.default_hourly_rate_cents
      });

      const activityDate = new Date(a.activity.activity_date + "T00:00:00");
      hoursTotal += computed.hours;
      if (activityDate >= monthStart) hoursMonth += computed.hours;
      if (activityDate >= weekStart) hoursWeek += computed.hours;

      if (a.paid) payPaidCents += computed.payCents;
      else payOwedCents += computed.payCents;
    }

    return {
      coach,
      hoursWeek,
      hoursMonth,
      hoursTotal,
      payOwedCents,
      payPaidCents,
      balanceCents: payOwedCents
    };
  });

  return <AdminEntraineurs summaries={summaries} />;
}
