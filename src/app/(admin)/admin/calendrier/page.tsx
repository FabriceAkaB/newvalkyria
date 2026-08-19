import { AdminCalendrier } from "@/components/admin-calendrier";
import { requireAdmin } from "@/lib/admin-auth";
import { getUnifiedCalendarEvents } from "@/lib/calendar-repo";
import { getCoaches } from "@/lib/coaches-repo";
import { getTerrains } from "@/lib/terrains-repo";

export const metadata = { title: "Calendrier — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function AdminCalendrierPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireAdmin();
  const { from: fromParam, to: toParam } = await searchParams;

  const today = new Date();
  const defaultFrom = isoDate(today);
  const defaultTo = isoDate(new Date(today.getTime() + 13 * 24 * 60 * 60 * 1000));

  const from = fromParam || defaultFrom;
  const to = toParam || defaultTo;

  const [events, terrains, coaches] = await Promise.all([getUnifiedCalendarEvents(from, to), getTerrains(), getCoaches()]);
  const coachNames = coaches.map((c) => `${c.first_name} ${c.last_name}`.trim());

  return <AdminCalendrier events={events} terrains={terrains} from={from} to={to} coachNames={coachNames} />;
}
