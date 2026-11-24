import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BulletinReport } from "@/components/bulletin-report";
import { FamilyInviteCard } from "@/components/family-invite-card";
import { getBulletinReport } from "@/lib/bulletin-repo";
import { getParentUserId } from "@/lib/parent-auth";
import { getChildrenForParent, getVerifiedParentEmail } from "@/lib/parent-repo";
import { getTrialInviteUrl } from "@/lib/referrals-repo";
import { getRegistrationById } from "@/lib/season-admin-repo";

export const metadata = { title: "Bulletin — New Valkyria" };
export const dynamic = "force-dynamic";

export default async function ParentBulletinPage({ params, searchParams }: { params: Promise<{ registrationId: string }>; searchParams: Promise<{ bulletin?: string }> }) {
  const sp = await searchParams;
  const period = sp.bulletin === "mi-saison" || sp.bulletin === "fin-saison" ? sp.bulletin : null;
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

  const data = await getBulletinReport(registrationId, { period, audience: "parent" });
  if (!data) notFound();
  // « Invite une amie à l'essai » (P3.1.08), juste après le bulletin remis.
  const inviteUrl = data.released ? await getTrialInviteUrl(await getVerifiedParentEmail(userId), registration.parent_name ?? null) : null;

  return (
    <div className="nv27-step" style={{ maxWidth: "760px", margin: "0 auto", padding: "2rem 1rem" }}>
      <Link href="/compte/progression" className="nv27-btn-ghost" style={{ textDecoration: "none", display: "inline-block", marginBottom: "1.5rem" }}>
        ← Progression
      </Link>
      <BulletinReport data={data} periodHref={(p) => `/compte/bulletin/${registrationId}?bulletin=${p}`} />
      {inviteUrl ? (
        <div style={{ marginTop: "1.5rem" }}>
          <FamilyInviteCard moment="bulletin" firstName={data.player.firstName} url={inviteUrl} />
        </div>
      ) : null}
    </div>
  );
}
