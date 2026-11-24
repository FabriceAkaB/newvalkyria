import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/container";
import { TournamentCard } from "@/components/tournament-card";
import { requireParentUserId } from "@/lib/parent-auth";
import { getVerifiedParentEmail } from "@/lib/parent-repo";
import { toView } from "@/lib/tournaments-core";
import { getFamilyTournaments } from "@/lib/tournaments-repo";

export const metadata: Metadata = { title: "Tournois | Espace famille", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Tournois proposés à l'équipe de chaque fille (JP, 25 nov. 2026) : le parent répond, et au go il paie la place. */
export default async function TournoisPage() {
  const userId = await requireParentUserId();
  const [list, email] = await Promise.all([getFamilyTournaments(userId), getVerifiedParentEmail(userId)]);
  return (
    <section className="insc-hero">
      <Container className="max-w-2xl">
        <div className="fam-hello">
          <p>Tournois</p>
          <h1>{list.length ? "Les tournois de l'équipe" : "Aucun tournoi pour l'instant"}</h1>
        </div>
        {list.length ? (
          <div className="tourn-list">
            {list.map(({ tournament, girls }) => (
              <TournamentCard
                key={tournament.slug}
                t={toView(tournament)}
                href={`/tournois/${tournament.slug}`}
                endpoint="famille"
                girls={girls.map((g) => ({ firstName: g.firstName, lastName: g.lastName, answer: g.response?.response ?? null, offerStatus: g.response?.offerStatus ?? null, payDeadline: g.response?.payDeadline ?? null, token: g.response?.token ?? null }))}
              />
            ))}
          </div>
        ) : (
          <p className="tourn-note">
            {email
              ? "Quand un tournoi sera proposé à l'équipe de votre fille, il apparaîtra ici : vous pourrez dire si elle est intéressée ou disponible."
              : "Confirmez d'abord votre courriel (lien reçu à la création du compte) ou reliez votre fille dans Mes enfants : les tournois de son équipe apparaîtront ici."}{" "}
            {!email ? <Link href="/compte/enfants">Mes enfants</Link> : null}
          </p>
        )}
      </Container>
    </section>
  );
}
