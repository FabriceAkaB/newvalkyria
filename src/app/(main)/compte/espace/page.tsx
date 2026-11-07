import type { Metadata } from "next";

import Link from "next/link";

import { Container } from "@/components/container";
import { EmailCheckBanner } from "@/components/email-check-banner";
import { ParentDashboard } from "@/components/parent-dashboard";
import { requireParentUserId } from "@/lib/parent-auth";
import { getChildrenForParent, getParentAccount, isParentEmailVerified } from "@/lib/parent-repo";

export const metadata: Metadata = {
  title: "Mon espace | New Valkyria",
  robots: "noindex"
};
export const dynamic = "force-dynamic";

export default async function EspaceParentPage({ searchParams }: { searchParams: Promise<{ courriel?: string }> }) {
  const userId = await requireParentUserId();
  const [account, children, sp] = await Promise.all([getParentAccount(userId), getChildrenForParent(userId), searchParams]);
  const verified = account?.email ? await isParentEmailVerified(userId, account.email) : false;

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
        <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1rem" }}>
          {sp.courriel === "confirme" ? <p style={{ margin: 0, color: "#7ee2a8", fontWeight: 600 }}>Merci, votre courriel est confirmé.</p> : null}
          {sp.courriel === "invalide" ? <p style={{ margin: 0, color: "#f4a3a3" }}>Ce lien de confirmation n&apos;est plus valide : demandez-en un nouveau ci-dessous.</p> : null}
          {!verified ? <EmailCheckBanner /> : null}
          <Link href="/compte/matchs" style={{ display: "block", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "0.9rem 1rem", color: "#fff", fontWeight: 600, textDecoration: "none" }}>
            🎥 Matchs filmés de l&apos;équipe →
          </Link>
        </div>
        <ParentDashboard initialChildren={children} />
      </Container>
    </section>
  );
}
