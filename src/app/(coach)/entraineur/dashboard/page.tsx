import { CoachDashboard, type DashboardActivity } from "@/components/coach-dashboard";
import { requireCoach } from "@/lib/coach-auth";
import { getExpectedRoster, getCoachActivities } from "@/lib/coach-portal-repo";
import { getCoach } from "@/lib/coaches-repo";
import { SEASON_DB_ID } from "@/lib/season-2027-db-map";
import { getThemeForDate } from "@/lib/season-themes-repo";

export const metadata = { title: "Tableau de bord — Espace Entraîneur" };
export const dynamic = "force-dynamic";

export default async function CoachDashboardPage() {
  const coachId = await requireCoach();

  const [coach, allActivities, weekTheme] = await Promise.all([getCoach(coachId), getCoachActivities(coachId), getThemeForDate(SEASON_DB_ID, new Date())]);
  const activities = allActivities.filter((a) => a.assignment.status !== "cancelled");

  const todayISO = new Date().toISOString().slice(0, 10);

  const withRoster: DashboardActivity[] = await Promise.all(
    activities.map(async (a) => {
      const roster = await getExpectedRoster(SEASON_DB_ID, a.activity.category, a.activity.activity_date);
      return {
        id: a.activity.id,
        date: a.activity.activity_date,
        startTime: a.activity.start_time,
        endTime: a.activity.end_time,
        location: a.activity.location,
        category: a.activity.category,
        activityType: a.activity.activity_type,
        title: a.activity.title,
        otherCoaches: a.otherCoaches.map((c) => `${c.first_name} ${c.last_name}`),
        expectedCount: roster.filter((p) => !p.isTrial).length,
        trialCount: roster.filter((p) => p.isTrial).length
      };
    })
  );

  const today = withRoster.filter((a) => a.date === todayISO);
  const upcoming = withRoster.filter((a) => a.date > todayISO).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <CoachDashboard
      coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"}
      today={today}
      upcoming={upcoming}
      weekTheme={weekTheme?.theme ?? null}
    />
  );
}
