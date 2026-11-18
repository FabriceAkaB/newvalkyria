import type { Metadata } from "next";

import { Container } from "@/components/container";
import { EmailCheckBanner } from "@/components/email-check-banner";
import { ParentDashboard } from "@/components/parent-dashboard";
import { requireParentUserId } from "@/lib/parent-auth";
import { getChildrenForParent, getParentAccount, isParentEmailVerified } from "@/lib/parent-repo";

export const metadata: Metadata = { title: "Mes enfants | Espace famille", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Les profils des enfants (relier une joueuse, photo, réserver une séance privée) : proposés aux prochaines inscriptions. */
export default async function MesEnfantsPage() {
  const userId = await requireParentUserId();
  const [account, children] = await Promise.all([getParentAccount(userId), getChildrenForParent(userId)]);
  const verified = account?.email ? await isParentEmailVerified(userId, account.email) : false;
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
        <ParentDashboard initialChildren={children} />
      </Container>
    </section>
  );
}
