import { notFound } from "next/navigation";

import { AdminUniformeCommandeDetail } from "@/components/admin-uniforme-commande-detail";
import { requireAdmin } from "@/lib/admin-auth";
import { getSeasons } from "@/lib/season-admin-repo";
import { getOrderDetail, getOrderEvents, getOrderProblems } from "@/lib/shop-repo";

export const metadata = { title: "Commande — Uniformes — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminUniformeCommandeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const order = await getOrderDetail(id);
  if (!order) notFound();

  const [events, seasons, problems] = await Promise.all([getOrderEvents(id), getSeasons(), getOrderProblems(id)]);

  return <AdminUniformeCommandeDetail order={order} events={events} seasons={seasons} problems={problems} />;
}
