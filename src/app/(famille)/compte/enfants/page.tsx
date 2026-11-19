import type { Metadata } from "next";

import { Container } from "@/components/container";
import { EmailCheckBanner } from "@/components/email-check-banner";
import { ParentDashboard } from "@/components/parent-dashboard";
import { requireParentUserId } from "@/lib/parent-auth";
import { getChildrenForParent, getParentAccount, isParentEmailVerified } from "@/lib/parent-repo";
import { signedPhotoUrl } from "@/lib/player-photos";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const metadata: Metadata = { title: "Mes enfants | Espace famille", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Les profils des enfants (relier une joueuse, photo, réserver une séance privée) : proposés aux prochaines inscriptions. */
export default async function MesEnfantsPage() {
  const userId = await requireParentUserId();
  const [account, children] = await Promise.all([getParentAccount(userId), getChildrenForParent(userId)]);
  const verified = account?.email ? await isParentEmailVerified(userId, account.email) : false;
  // Sans photo choisie par le parent : la photo de nos dossiers (players.photo_url, stockage privé, lien d'une heure).
  const playerIds = children.filter((c) => !c.photo_url && c.player_id).map((c) => c.player_id as string);
  const { data: players } = playerIds.length ? await (getSupabaseAdminClient() as any).from("players").select("id, photo_url").in("id", playerIds).not("photo_url", "is", null) : { data: [] };
  const ours = new Map(await Promise.all(((players ?? []) as any[]).map(async (p) => [p.id, await signedPhotoUrl(p.photo_url, 3600).catch(() => null)] as const)));
  const withPhotos = children.map((c) => ({ ...c, our_photo_url: !c.photo_url && c.player_id ? ours.get(c.player_id) ?? null : null }));
  return (
    <section className="insc-hero">
      <Container className="max-w-2xl">
        <div className="insc-hero-inner">
          <h1 className="insc-hero-title">Mes enfants</h1>
          <p className="insc-hero-sub">Gérez les profils de vos enfants ici : ils sont proposés automatiquement à vos prochaines inscriptions.</p>
        </div>
      </Container>
      <Container className="max-w-2xl">
        {!verified ? <div style={{ marginBottom: "1rem" }}><EmailCheckBanner /></div> : null}
        <ParentDashboard initialChildren={withPhotos} />
      </Container>
    </section>
  );
}
