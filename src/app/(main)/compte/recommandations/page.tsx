import type { Metadata } from "next";

import { Container } from "@/components/container";
import { ParentRecommandations } from "@/components/parent-recommandations";
import { requireParentUserId } from "@/lib/parent-auth";

export const metadata: Metadata = { title: "Mes recommandations | New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function RecommandationsPage() {
  await requireParentUserId();
  return (
    <section className="insc-hero">
      <Container className="max-w-2xl">
        <div className="insc-hero-inner">
          <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Espace parent</p>
          <h1 className="insc-hero-title">Mes recommandations</h1>
          <p className="insc-hero-sub">Partagez New Valkyria avec d&apos;autres familles et obtenez une récompense pour chaque inscription.</p>
        </div>
        <ParentRecommandations />
      </Container>
    </section>
  );
}
