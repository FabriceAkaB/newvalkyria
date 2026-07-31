import type { Metadata } from "next";

import { Container } from "@/components/container";
import { ParentDashboard } from "@/components/parent-dashboard";
import { requireParentUserId } from "@/lib/parent-auth";
import { getChildrenForParent, getParentAccount } from "@/lib/parent-repo";

export const metadata: Metadata = {
  title: "Mon espace | New Valkyria",
  robots: "noindex"
};
export const dynamic = "force-dynamic";

export default async function EspaceParentPage() {
  const userId = await requireParentUserId();
  const [account, children] = await Promise.all([getParentAccount(userId), getChildrenForParent(userId)]);

  return (
    <section className="insc-hero">
      <Container className="max-w-2xl">
        <div className="insc-hero-inner">
          <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Espace parent</p>
          <h1 className="insc-hero-title">Bonjour {account?.fullName || "!"}</h1>
          <p className="insc-hero-sub">
            Gérez les profils de vos enfants ici — ils seront proposés automatiquement au moment de vos prochaines inscriptions.
          </p>
        </div>
      </Container>
      <Container className="max-w-2xl">
        <ParentDashboard initialChildren={children} />
      </Container>
    </section>
  );
}
