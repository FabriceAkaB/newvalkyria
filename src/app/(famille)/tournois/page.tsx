import type { Metadata } from "next";

import { Container } from "@/components/container";
import { TournamentCard } from "@/components/tournament-card";
import { toView } from "@/lib/tournaments-core";
import { listTournaments } from "@/lib/tournaments-repo";

/** Page à lien privé (non répertoriée) : les tournois proposés aux familles de l'académie. */
export const metadata: Metadata = { title: "Tournois | New Valkyria", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function TournoisPrivePage() {
  const list = await listTournaments({ publishedOnly: true });
  return (
    <section className="insc-hero">
      <Container className="max-w-2xl">
        <div className="fam-hello">
          <p>Tournois New Valkyria</p>
          <h1>{list.length ? "Les tournois proposés aux familles" : "Aucun tournoi pour l'instant"}</h1>
        </div>
        <p className="tourn-lead">L&apos;académie n&apos;inscrit une équipe que si assez de joueuses sont disponibles. Au go, chaque famille paie sa part : l&apos;inscription du tournoi et le coach, partagés entre les joueuses. Le transport et l&apos;hébergement restent à la charge des familles.</p>
        <div className="tourn-list">
          {list.map((t) => (
            <TournamentCard key={t.slug} t={toView(t)} href={`/tournois/${t.slug}`} endpoint="lien" girls={[]} />
          ))}
        </div>
      </Container>
    </section>
  );
}
