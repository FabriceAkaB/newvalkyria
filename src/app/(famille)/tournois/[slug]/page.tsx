import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Container } from "@/components/container";
import { TournamentCard, TournamentPublicAnswer } from "@/components/tournament-card";
import { getParentUserId } from "@/lib/parent-auth";
import { toView, type GirlAnswer } from "@/lib/tournaments-core";
import { getFamilyTournaments, getResponseByToken, getTournament } from "@/lib/tournaments-repo";

export const metadata: Metadata = { title: "Tournoi | New Valkyria", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Un tournoi : par le lien personnel du courriel (?r=…), par l'espace famille si le parent est connecté,
 *  sinon un petit formulaire (joueuse + courriel de l'inscription). */
export default async function TournoiPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ r?: string; paye?: string }> }) {
  const { slug } = await params;
  const { r, paye } = await searchParams;
  const found = await getTournament(slug);
  if (!found) notFound();
  const personal = r ? await getResponseByToken(r) : null;
  const mine = personal?.programSlug === slug ? personal : null;
  if (!found.tournament.published && !mine) notFound();
  const view = toView(found.tournament);

  let girls: GirlAnswer[] = mine ? [{ firstName: mine.firstName, lastName: mine.lastName, answer: mine.response, offerStatus: mine.offerStatus, payDeadline: mine.payDeadline, token: mine.token }] : [];
  let endpoint: "famille" | "lien" = "lien";
  if (!mine) {
    const userId = await getParentUserId();
    const fam = userId ? (await getFamilyTournaments(userId)).find((x) => x.tournament.slug === slug) : null;
    if (fam) {
      endpoint = "famille";
      girls = fam.girls.map((g) => ({ firstName: g.firstName, lastName: g.lastName, answer: g.response?.response ?? null, offerStatus: g.response?.offerStatus ?? null, payDeadline: g.response?.payDeadline ?? null, token: g.response?.token ?? null }));
    }
  }

  return (
    <section className="insc-hero">
      <Container className="max-w-2xl">
        <p className="tourn-back">
          <Link href="/tournois">Tous les tournois</Link>
        </p>
        {paye ? <p className="tourn-paid tourn-banner">Merci ! Le paiement est reçu, la confirmation arrive par courriel.</p> : null}
        <TournamentCard t={view} girls={girls} endpoint={endpoint} full>
          {girls.length ? null : <TournamentPublicAnswer t={view} />}
        </TournamentCard>
      </Container>
    </section>
  );
}
