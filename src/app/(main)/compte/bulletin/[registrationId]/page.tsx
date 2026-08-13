import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BulletinView } from "@/components/bulletin-view";
import { getBulletinData } from "@/lib/coach-portal-repo";
import { getParentUserId } from "@/lib/parent-auth";
import { getChildrenForParent } from "@/lib/parent-repo";
import { getRegistrationById, getSeason } from "@/lib/season-admin-repo";

export const metadata = { title: "Bulletin — New Valkyria" };
export const dynamic = "force-dynamic";

export default async function ParentBulletinPage({ params }: { params: Promise<{ registrationId: string }> }) {
  const userId = await getParentUserId();
  if (!userId) redirect("/compte");
  const { registrationId } = await params;

  const registration = await getRegistrationById(registrationId);
  if (!registration) notFound();

  // Jamais faire confiance à l'ID dans l'URL — vérifie que cette inscription
  // appartient bien à une joueuse reliée à un enfant de ce compte parent.
  const children = await getChildrenForParent(userId);
  const owns = registration.player_id && children.some((c) => c.player_id === registration.player_id);
  if (!owns) notFound();

  const [data, season] = await Promise.all([getBulletinData(registrationId), getSeason(registration.season_id)]);
  if (!data) notFound();

  return (
    <div className="nv27-step" style={{ maxWidth: "760px", margin: "0 auto", padding: "2rem 1rem" }}>
      <Link href="/compte/espace" className="nv27-btn-ghost" style={{ textDecoration: "none", display: "inline-block", marginBottom: "1.5rem" }}>
        ← Mon espace
      </Link>
      <BulletinView data={data} seasonLabel={season?.label} />
    </div>
  );
}
