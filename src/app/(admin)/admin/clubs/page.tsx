import { AdminClubs } from "@/components/admin-clubs";
import { requireAdmin } from "@/lib/admin-auth";
import { getAllLeads } from "@/lib/repositories";

export const metadata = { title: "Clubs — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminClubsPage() {
  await requireAdmin();
  const leads = await getAllLeads();

  // Extract all raw club names from goal field
  const clubsRaw = new Set<string>();
  for (const lead of leads) {
    const match = lead.goal?.match(/Club:\s*([^·]+)/);
    const club = match?.[1]?.trim();
    if (club && club !== "Aucun") clubsRaw.add(club);
  }

  return <AdminClubs allRawClubs={Array.from(clubsRaw).sort()} />;
}
