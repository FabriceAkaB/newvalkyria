import { CoachDashboard, type DashboardActivity, type ToComplete } from "@/components/coach-dashboard";
import { requireCoach } from "@/lib/coach-auth";
import { cleanCategory, getActivityReports, getCoachActivities, loadRosterSources, rosterForActivity } from "@/lib/coach-portal-repo";
import { hasStarted, REPORT_RULE_START } from "@/lib/coach-report";
import { listObservations } from "@/lib/coach-observations-repo";
import { getCoach } from "@/lib/coaches-repo";
import { getSeasonThemes, mondayOfWeek, themeFor } from "@/lib/season-themes-repo";
import { SEASON_DB_ID } from "@/lib/season-2027-db-map";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const metadata = { title: "Mes pratiques — Espace Technique" };
export const dynamic = "force-dynamic";

export default async function CoachDashboardPage() {
  const coachId = await requireCoach();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

  const [coach, allActivities, sources, themes, observations] = await Promise.all([
    getCoach(coachId),
    getCoachActivities(coachId),
    loadRosterSources(),
    getSeasonThemes(SEASON_DB_ID).catch(() => []),
    listObservations({ coachId, sharedOnly: true }).catch(() => [])
  ]);
  const activities = allActivities.filter((a) => a.assignment.status !== "cancelled" && a.assignment.status !== "replaced");
  const ids = activities.map((a) => a.activity.id);
  const { data: blocks } = ids.length
    ? await (getSupabaseAdminClient() as any).from("activity_session_blocks").select("activity_id, duration_minutes").in("activity_id", ids)
    : { data: [] };
  const themeOf = (date: string, category: string | null) => themeFor(themes.find((t) => String(t.week_start_date).slice(0, 10) === mondayOfWeek(new Date(`${date}T12:00:00`))), cleanCategory(category));

  const view: DashboardActivity[] = activities.map((a) => {
    const date = String(a.activity.activity_date).slice(0, 10);
    const roster = rosterForActivity(a.activity, sources.slots, sources.regs);
    const own = ((blocks ?? []) as any[]).filter((b) => b.activity_id === a.activity.id);
    return {
      id: a.activity.id,
      date,
      startTime: String(a.activity.start_time).slice(0, 5),
      endTime: String(a.activity.end_time).slice(0, 5),
      location: a.activity.location,
      category: a.activity.category,
      activityType: a.activity.activity_type,
      title: a.activity.title,
      otherCoaches: a.otherCoaches.map((c) => c.first_name),
      expectedCount: roster.filter((p) => !p.isTrial).length,
      trialCount: roster.filter((p) => p.isTrial).length,
      blocks: own.length,
      minutes: own.reduce((s, b) => s + (b.duration_minutes ?? 0), 0),
      theme: themeOf(date, a.activity.category)
    };
  });

  // À compléter : activités commencées dont ma présence ou le rapport manque (les heures attendent).
  const started = activities.filter((a) => {
    const date = String(a.activity.activity_date).slice(0, 10);
    return date >= REPORT_RULE_START && hasStarted(date, String(a.activity.start_time).slice(0, 5));
  });
  const reports = await getActivityReports(started.map((a) => a.activity)).catch(() => new Map());
  const toComplete: ToComplete[] = started
    .map((a) => {
      const report = reports.get(a.activity.id);
      const missing: string[] = [];
      if (report?.required) {
        if (report.attendanceMissing.length) missing.push(`${report.attendanceMissing.length} présence${report.attendanceMissing.length > 1 ? "s" : ""} de joueuses`);
        if (report.evaluationsMissing.length) missing.push(`${report.evaluationsMissing.length} évaluation${report.evaluationsMissing.length > 1 ? "s" : ""}`);
      }
      if (!a.assignment.confirmed) missing.push("confirmer ta présence");
      return { activity: view.find((v) => v.id === a.activity.id)!, missing };
    })
    .filter((x) => x.missing.length > 0)
    .sort((x, y) => `${x.activity.date} ${x.activity.startTime}`.localeCompare(`${y.activity.date} ${y.activity.startTime}`));

  return (
    <CoachDashboard
      coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"}
      today={view.filter((a) => a.date === today).sort((a, b) => a.startTime.localeCompare(b.startTime))}
      upcoming={view.filter((a) => a.date > today).sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))}
      toComplete={toComplete}
      lastFeedback={
        observations[0]
          ? { date: observations[0].observed_on, total: observations[0].total, strengths: observations[0].strengths, toImprove: observations[0].to_improve, nextFocus: observations[0].next_focus, videoUrl: observations[0].video_url }
          : null
      }
    />
  );
}
