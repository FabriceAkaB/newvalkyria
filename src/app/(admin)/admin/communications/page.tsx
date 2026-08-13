import { AdminCommunications } from "@/components/admin-communications";
import { requireAdmin } from "@/lib/admin-auth";
import { getCommunicationHistory } from "@/lib/communications-repo";
import { ETE_SEASON_KEY, ETE_SEASON_LABEL } from "@/lib/revenue-calc";
import { getSeasonCategories, getSeasons, getSeasonSlots } from "@/lib/season-admin-repo";

export const metadata = { title: "Communications — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminCommunicationsPage() {
  await requireAdmin({ roles: ["admin"] });

  const allSeasons = await getSeasons();
  const realSeasons = allSeasons.filter((s) => s.id !== ETE_SEASON_KEY);

  const [categoriesBySeasons, slotsBySeasons] = await Promise.all([
    Promise.all(realSeasons.map((s) => getSeasonCategories(s.id))),
    Promise.all(realSeasons.map((s) => getSeasonSlots(s.id)))
  ]);

  const seasonOptions = [
    { key: ETE_SEASON_KEY, label: ETE_SEASON_LABEL, categories: [] as { id: string; label: string }[], slots: [] as { id: string; label: string }[] },
    ...realSeasons.map((s, i) => ({
      key: s.id,
      label: s.label,
      categories: categoriesBySeasons[i].map((c) => ({ id: c.id, label: c.label })),
      slots: slotsBySeasons[i].map((sl) => ({ id: sl.id, label: `${sl.day} ${sl.start_time.slice(0, 5)}-${sl.end_time.slice(0, 5)} (${sl.location})` }))
    }))
  ];

  const history = await getCommunicationHistory();

  return <AdminCommunications seasonOptions={seasonOptions} history={history} />;
}
