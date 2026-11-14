import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/container";
import { IdeaForm } from "@/components/idea-box";
import { categoryLabel, statusOf } from "@/lib/idea-box-core";
import { listPublicIdeas } from "@/lib/idea-box-repo";
import { getParentUserId } from "@/lib/parent-auth";

export const metadata: Metadata = {
  title: "Boîte à idées | New Valkyria",
  description: "Une idée pour l'académie ? Une activité, un horaire, un programme : dites-le-nous, on lit tout.",
  alternates: { canonical: "/boite-a-idees" }
};
export const dynamic = "force-dynamic";

/** Boîte à idées publique : n'importe qui propose une idée ; les idées réalisées grâce aux familles sont montrées. */
export default async function BoiteAIdeesPage() {
  const [userId, done] = await Promise.all([getParentUserId(), listPublicIdeas().catch(() => [])]);
  return (
    <section className="insc-hero">
      <Container className="max-w-2xl">
        <div className="insc-hero-inner">
          <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Boîte à idées</p>
          <h1 className="insc-hero-title">Une idée pour l&apos;académie ?</h1>
          <p className="insc-hero-sub">
            Une activité, un horaire, un nouveau programme, quelque chose à améliorer : dites-le-nous. L&apos;équipe lit chaque idée et répond.
            {userId ? (
              <>
                {" "}Vous êtes connecté : vous pouvez aussi suivre vos idées dans <Link href="/compte/idees" style={{ textDecoration: "underline" }}>votre espace</Link>.
              </>
            ) : null}
          </p>
        </div>
      </Container>
      <Container className="max-w-2xl">
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "1.3rem", position: "relative" }}>
          <IdeaForm askIdentity={!userId} />
        </div>
        {done.length ? (
          <div style={{ marginTop: "1.6rem", display: "grid", gap: 10 }}>
            <h2 style={{ margin: 0, color: "#fff", fontSize: "1.2rem", fontWeight: 700 }}>Grâce à vous</h2>
            {done.map((i, n) => (
              <div key={n} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "0.9rem 1rem" }}>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "#7ee2a8", fontWeight: 700 }}>
                  {statusOf(i.status).family} · {categoryLabel(i.category)}
                </p>
                <p style={{ margin: "6px 0 0", color: "#fff" }}>{i.message}</p>
                {i.response ? <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.75)" }}>{i.response}</p> : null}
              </div>
            ))}
          </div>
        ) : null}
      </Container>
    </section>
  );
}
