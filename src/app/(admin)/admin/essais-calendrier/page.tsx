import { AdminEssaisCalendrier, type TrialCalendarEntry } from "@/components/admin-essais-calendrier";
import { requireAdmin } from "@/lib/admin-auth";
import { getAllLeads } from "@/lib/repositories";
import { getSeasonRegistrations, getSeasons } from "@/lib/season-admin-repo";

export const metadata = { title: "Calendrier des essais — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

function childNameFromGoal(goal: string): string {
  const match = goal.match(/Joueuse:\s*([^·]+)/);
  return match?.[1]?.trim() || "Sans nom";
}

export default async function AdminEssaisCalendrierPage() {
  await requireAdmin();

  const [leads, seasons] = await Promise.all([getAllLeads(), getSeasons()]);

  const entries: TrialCalendarEntry[] = [];

  for (const lead of leads) {
    if (lead.status === "essai") {
      entries.push({
        id: lead.id,
        date: lead.trial_date ?? null,
        playerName: childNameFromGoal(lead.goal),
        parentName: lead.parent_name,
        parentPhone: lead.phone,
        seasonLabel: "Été 2026",
        detailHref: "/admin/inscriptions"
      });
    }
  }

  const seasonRegistrations = await Promise.all(seasons.map((season) => getSeasonRegistrations(season.id)));
  seasons.forEach((season, i) => {
    for (const r of seasonRegistrations[i]) {
      if (r.is_trial && r.status !== "cancelled") {
        entries.push({
          id: r.id,
          date: r.trial_date,
          playerName: [r.player_first_name, r.player_last_name].filter(Boolean).join(" ") || "Sans nom",
          parentName: r.parent_name,
          parentPhone: r.parent_phone,
          seasonLabel: season.label,
          detailHref: `/admin/saison/${season.id}/essais`
        });
      }
    }
  });

  return <AdminEssaisCalendrier entries={entries} />;
}
