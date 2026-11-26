import { CLUB_ID } from "@/lib/club";
import { parseDeductions, summarizePay, type PayLine, type PaySummary } from "@/lib/coach-pay";
import { countsInPay, payBank, type PayBank } from "@/lib/coach-pay-core";
import { computeAssignment } from "@/lib/coach-payroll";
import { getPayrollRows, type PayrollRow } from "@/lib/coach-payroll-data";
import { hasReportHour, isBoysActivity, PAY_HOLD_LABEL, REPORT_HOUR, REPORT_REQUIRED_TYPES, REPORT_RULE_V2_START } from "@/lib/coach-report";
import { getAllAssignments, getAllCoachTypeRates, type Coach, type CoachActivity, type CoachAssignment } from "@/lib/coaches-repo";
import { nextPayPeriod, payPeriodOf, type PayPeriod } from "@/lib/pay-periods";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Les lignes de paie d'un éducateur, toutes périodes : ce qui est fait (compté ou retenu) d'après la paie, puis ce
 *  qui est prévu (assigné, pas encore fait). Les séances où il n'était pas là (absent, annulé) sont enlevées. */
export function buildPayLines(coachId: string, today: string, rows: PayrollRow[], all: (CoachAssignment & { coach: Coach; activity: CoachActivity })[], rate: Map<string, number>): PayLine[] {
  const lines: PayLine[] = [];
  for (const r of rows) {
    if (r.coachId !== coachId || !countsInPay(r)) continue;
    const base = { activityId: r.activityId, date: String(r.activityDate).slice(0, 10), start: r.activityStart, end: r.activityEnd, label: r.activityLabel, paid: r.paid };
    // Heures de terrain : payées dès la présence confirmée (avant le 19 nov. : aussi le rapport).
    lines.push({
      ...base,
      hours: r.fieldHours,
      cents: r.fieldPayCents,
      state: r.hold ? "retenu" : "compte",
      why: r.hold ? (r.hold === "rapport" && r.missingDetail.length ? `Rapport pas fini : ${r.missingDetail.join(", ")}` : PAY_HOLD_LABEL[r.hold]) : null
    });
    // Heure de rapport (coachs) : gagnée quand le rapport est fini.
    if (r.reportHourDue) {
      const earned = r.reportHourEarned && !r.hold;
      lines.push({
        ...base,
        label: "Heure de rapport du jour",
        hours: REPORT_HOUR,
        cents: r.reportHourCents,
        state: earned ? "compte" : "retenu",
        why: earned ? null : r.hold ? PAY_HOLD_LABEL[r.hold] : r.missingDetail.length ? `Rapport pas fini : ${r.missingDetail.join(", ")}` : "Rapport pas fini"
      });
    }
  }
  // Ce qui est prévu (assigné, pas encore fait) : estimé avec la durée et le taux.
  const plannedReportDays = new Set<string>();
  for (const a of all) {
    const d = String(a.activity.activity_date).slice(0, 10);
    if (a.coach_id !== coachId || d <= today || !countsInPay({ attendance: a.status, paid: a.paid })) continue;
    const c = computeAssignment({ status: "present", arrivalTime: a.arrival_time, departureTime: a.departure_time, activityStartTime: a.activity.start_time, activityEndTime: a.activity.end_time, assignmentRateCents: a.hourly_rate_cents, typeRateCents: rate.get(`${a.coach_id}:${a.activity.activity_type}`) ?? null, defaultRateCents: a.coach.default_hourly_rate_cents });
    const label = a.activity.title || a.activity.category || a.activity.activity_type;
    lines.push({ activityId: a.activity_id, date: d, start: String(a.activity.start_time).slice(0, 5), end: String(a.activity.end_time).slice(0, 5), label, hours: c.hours, cents: c.payCents, state: "prevu" });
    // Une heure de rapport prévue par jour de pratique (pas une par pratique).
    if (d >= REPORT_RULE_V2_START && hasReportHour(a.coach.role) && REPORT_REQUIRED_TYPES.includes(a.activity.activity_type) && !a.activity.organization && !isBoysActivity(a.activity) && !plannedReportDays.has(d)) {
      plannedReportDays.add(d);
      lines.push({ activityId: a.activity_id, date: d, start: String(a.activity.end_time).slice(0, 5), end: String(a.activity.end_time).slice(0, 5), label: "Heure de rapport du jour", hours: REPORT_HOUR, cents: Math.round(REPORT_HOUR * c.rateCents), state: "prevu" });
    }
  }
  return lines.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

async function loadPaySources(known?: PayrollRow[]) {
  const [rows, all, typeRates, { data: setting }] = await Promise.all([
    known ?? getPayrollRows(),
    getAllAssignments(),
    getAllCoachTypeRates(),
    (getSupabaseAdminClient() as any).from("app_settings").select("value").eq("club_id", CLUB_ID).eq("key", "coach_pay_deductions").maybeSingle()
  ]);
  const rate = new Map(typeRates.map((t) => [`${t.coach_id}:${t.activity_type}`, t.hourly_rate_cents]));
  return { rows, all, rate, deductions: parseDeductions(setting?.value) };
}

/** Ma paie : la période de paie en cours (ou une précédente), activité par activité, et la banque d'heures. */
export async function getCoachPay(coachId: string, today: string, offset = 0): Promise<{ period: PayPeriod; lines: PayLine[]; summary: PaySummary; bank: PayBank }> {
  const current = nextPayPeriod(today);
  const period = offset ? payPeriodOf(new Date(Date.parse(`${current.from}T12:00:00Z`) - offset * 14 * 86_400_000).toISOString().slice(0, 10)) : current;
  const { rows, all, rate, deductions } = await loadPaySources();
  const allLines = buildPayLines(coachId, today, rows, all, rate);
  const lines = allLines.filter((l) => l.date >= period.from && l.date <= period.to);
  return { period, lines, summary: summarizePay(lines, deductions), bank: payBank(allLines, today) };
}

/** Toutes les lignes de paie d'un éducateur (toutes périodes) et sa banque d'heures (courriel de confirmation). */
export async function getCoachPayAll(coachId: string, today: string): Promise<{ lines: PayLine[]; bank: PayBank }> {
  const { rows, all, rate } = await loadPaySources();
  const lines = buildPayLines(coachId, today, rows, all, rate);
  return { lines, bank: payBank(lines, today) };
}

/** Banque d'heures de chaque éducateur (admin, paie). */
export async function getPayBanks(today: string, known?: PayrollRow[]): Promise<{ coachId: string; name: string; bank: PayBank }[]> {
  const { rows, all, rate } = await loadPaySources(known);
  const coaches = new Map<string, string>();
  for (const r of rows) coaches.set(r.coachId, r.coachName);
  for (const a of all) if (!coaches.has(a.coach_id)) coaches.set(a.coach_id, `${a.coach.first_name} ${a.coach.last_name}`);
  return [...coaches.entries()]
    .map(([coachId, name]) => ({ coachId, name, bank: payBank(buildPayLines(coachId, today, rows, all, rate), today) }))
    .filter((b) => b.bank.accumulated.hours > 0 || b.bank.upcoming.hours > 0)
    .sort((a, b) => b.bank.current.totalCents - a.bank.current.totalCents || a.name.localeCompare(b.name, "fr"));
}
