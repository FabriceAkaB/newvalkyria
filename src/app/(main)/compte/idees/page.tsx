import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/container";
import { IdeaForm, MyIdeas } from "@/components/idea-box";
import { listIdeasForParent } from "@/lib/idea-box-repo";
import { requireParentUserId } from "@/lib/parent-auth";
import { getChildrenForParent } from "@/lib/parent-repo";

export const metadata: Metadata = { title: "Boîte à idées | Mon espace", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Boîte à idées dans l'espace parent : proposer une idée et suivre la réponse de l'académie. */
export default async function MesIdeesPage() {
  const userId = await requireParentUserId();
  const [ideas, children] = await Promise.all([listIdeasForParent(userId), getChildrenForParent(userId)]);
  return (
    <section className="insc-hero">
      <Container className="max-w-2xl">
        <div className="insc-hero-inner">
          <Link href="/compte/espace" className="text-sm text-white/60">← Mon espace</Link>
          <h1 className="insc-hero-title">💡 Boîte à idées</h1>
          <p className="insc-hero-sub">Une idée pour l&apos;académie ? Proposez-la ici : l&apos;équipe la lit et vous répond dans cette page.</p>
        </div>
      </Container>
      <Container className="max-w-2xl">
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "1.3rem", position: "relative" }}>
          <IdeaForm askIdentity={false} players={children.map((c) => `${c.first_name} ${c.last_name}`.trim())} />
        </div>
        <div style={{ marginTop: "1.6rem", display: "grid", gap: 10 }}>
          <h2 style={{ margin: 0, color: "#fff", fontSize: "1.2rem", fontWeight: 700 }}>Mes idées</h2>
          <MyIdeas ideas={ideas} />
        </div>
      </Container>
    </section>
  );
}
