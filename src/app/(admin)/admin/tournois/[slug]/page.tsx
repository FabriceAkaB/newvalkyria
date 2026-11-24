import { notFound } from "next/navigation";

import { AdminTournament } from "@/components/admin-tournament";
import { AdminTopbar } from "@/components/admin-topbar";
import { requireAdmin } from "@/lib/admin-auth";
import { env } from "@/lib/env";
import { costPerPlayerCents, planGo } from "@/lib/tournaments-core";
import { getAdminTournament } from "@/lib/tournaments-repo";

export const metadata = { title: "Tournoi — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin({ roles: ["admin"] });
  const { slug } = await params;
  const data = await getAdminTournament(slug);
  if (!data) notFound();
  const t = data.tournament;
  const plan = planGo(data.responses.map((r) => ({ id: r.id, response: r.response, respondedAt: r.respondedAt, offerStatus: r.offerStatus })), t.maxPlayers);
  const rows = [
    ...data.people.map(({ girl, response }) => ({
      key: girl.key,
      firstName: girl.firstName,
      lastName: girl.lastName,
      birthYear: girl.birthYear,
      parentName: girl.parentName,
      parentEmail: girl.parentEmail,
      inRoster: true,
      response: response ? { id: response.id, answer: response.response, source: response.source, respondedAt: response.respondedAt, offerStatus: response.offerStatus, payDeadline: response.payDeadline } : null
    })),
    ...data.others.map((r) => ({
      key: r.playerKey,
      firstName: r.firstName,
      lastName: r.lastName,
      birthYear: r.birthYear,
      parentName: r.parentName ?? "",
      parentEmail: r.parentEmail ?? "",
      inRoster: false,
      response: { id: r.id, answer: r.response, source: r.source, respondedAt: r.respondedAt, offerStatus: r.offerStatus, payDeadline: r.payDeadline }
    }))
  ];
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <AdminTournament
          slug={slug}
          name={t.name}
          published={t.published}
          datesLabel={t.datesLabel}
          dates={t.dates}
          birthYears={t.birthYears}
          minPlayers={t.minPlayers}
          maxPlayers={t.maxPlayers}
          settings={t.settings}
          tally={t.tally}
          progress={t.progress}
          cost={t.cost}
          goPreview={{ players: plan.offer.length, waiting: plan.waiting.length, priceCents: costPerPlayerCents(t.settings, plan.offer.length) }}
          collectedCents={data.collectedCents}
          rows={rows}
          privateUrl={`${env.publicSiteUrl}/tournois/${slug}`}
        />
      </div>
    </>
  );
}
