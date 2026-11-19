import { CLUB_ID } from "@/lib/club";
import { parseDeductions, summarizePay, type PayLine, type PaySummary } from "@/lib/coach-pay";
import { computeAssignment } from "@/lib/coach-payroll";
import { getPayrollRows } from "@/lib/coach-payroll-data";
import { PAY_HOLD_LABEL } from "@/lib/coach-report";
import { getAllAssignments, getAllCoachTypeRates } from "@/lib/coaches-repo";
import { nextPayPeriod, payPeriodOf, type PayPeriod } from "@/lib/pay-periods";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Ma paie : la période de paie en cours (ou une précédente), activité par activité, pour un éducateur. */
export async function getCoachPay(coachId: string, today: string, offset = 0): Promise<{ period: PayPeriod; lines: PayLine[]; summary: PaySummary }> {
  const current = nextPayPeriod(today);
  const period = offset ? payPeriodOf(new Date(Date.parse(`${current.from}T12:00:00Z`) - offset * 14 * 86_400_000).toISOString().slice(0, 10)) : current;
  const [rows, all, typeRates, { data: setting }] = await Promise.all([
    getPayrollRows(),
    getAllAssignments(),
    getAllCoachTypeRates(),
    (getSupabaseAdminClient() as any).from("app_settings").select("value").eq("club_id", CLUB_ID).eq("key", "coach_pay_deductions").maybeSingle()
  ]);
  const inPeriod = (d: string) => d >= period.from && d <= period.to;
  const lines: PayLine[] = rows
    .filter((r) => r.coachId === coachId && inPeriod(String(r.activityDate).slice(0, 10)))
    .map((r) => ({
      activityId: r.activityId,
      date: String(r.activityDate).slice(0, 10),
      start: r.activityStart,
      end: r.activityEnd,
      label: r.activityLabel,
      hours: r.hold ? r.heldHours : r.hours,
      cents: r.hold ? r.heldPayCents : r.payCents,
      state: r.attendance !== "present" ? "absent" : r.hold ? "retenu" : "compte",
      why: r.hold ? PAY_HOLD_LABEL[r.hold] : null
    }));
  // Ce qui est prévu d'ici la fin de la période (assigné, pas encore fait) : estimé avec la durée et le taux.
  const rate = new Map(typeRates.map((t) => [`${t.coach_id}:${t.activity_type}`, t.hourly_rate_cents]));
  for (const a of all) {
    const d = String(a.activity.activity_date).slice(0, 10);
    if (a.coach_id !== coachId || d <= today || !inPeriod(d) || a.status === "absent" || a.status === "cancelled") continue;
    const c = computeAssignment({ status: "present", arrivalTime: a.arrival_time, departureTime: a.departure_time, activityStartTime: a.activity.start_time, activityEndTime: a.activity.end_time, assignmentRateCents: a.hourly_rate_cents, typeRateCents: rate.get(`${a.coach_id}:${a.activity.activity_type}`) ?? null, defaultRateCents: a.coach.default_hourly_rate_cents });
    lines.push({ activityId: a.activity_id, date: d, start: String(a.activity.start_time).slice(0, 5), end: String(a.activity.end_time).slice(0, 5), label: a.activity.title || a.activity.category || a.activity.activity_type, hours: c.hours, cents: c.payCents, state: "prevu" });
  }
  lines.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  return { period, lines, summary: summarizePay(lines, parseDeductions(setting?.value)) };
}
