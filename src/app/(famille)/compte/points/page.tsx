import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/container";
import { GirlPointsCard } from "@/components/family-champions";
import { RewardRequestButton } from "@/components/family-reward-button";
import { requireParentUserId } from "@/lib/parent-auth";
import { getFamilyRegistrations } from "@/lib/parent-repo";
import { progressOf, REWARD_KINDS } from "@/lib/player-points";
import { getPointsHistory, getPointsSummaries, getRedemptions, getRewards, getRules } from "@/lib/player-points-repo";

export const metadata: Metadata = { title: "Points Valkyria | Espace famille", robots: "noindex" };
export const dynamic = "force-dynamic";

const STATUS = { demandee: "En préparation", remise: "Remise", annulee: "Annulée (points rendus)" } as const;
/** Une date (AAAA-MM-JJ) ou un moment (horodatage) : toujours le jour à Montréal. */
const day = (iso: string) =>
  iso.length > 10
    ? new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "long", timeZone: "America/Toronto" })
    : new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { day: "numeric", month: "long", timeZone: "UTC" });
const money = (c: number | null) => (c ? (c / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" }) : null);

/** « Combien de points a ma fille, et qu'est-ce qu'elle peut avoir ? » Le solde à dépenser, les récompenses (cadeau,
 *  rabais en boutique, crédit sur la prochaine saison), ses demandes, et comment gagner des points. */
export default async function PointsPage() {
  const userId = await requireParentUserId();
  const family = await getFamilyRegistrations(userId);
  const ids = family.map((f) => f.registrationId);
  const [rules, rewards, summaries, requests, histories] = await Promise.all([
    getRules(),
    getRewards(),
    getPointsSummaries(ids),
    getRedemptions({ registrationIds: ids }),
    Promise.all(ids.map((id) => getPointsHistory(id).catch(() => [])))
  ]);
  const active = rewards.filter((r) => r.active).sort((a, b) => a.cost - b.cost);

  return (
    <section className="insc-hero">
      <Container className="max-w-2xl">
        <div className="fam-hello">
          <p>Points Valkyria</p>
          <h1>Gagner, puis choisir sa récompense</h1>
        </div>

        {!family.length ? (
          <div className="parent-card">
            <p className="parent-muted" style={{ margin: 0 }}>
              Les points apparaissent dès que votre fille est inscrite à la saison et reliée à votre compte. <Link href="/compte/enfants" className="parent-link">Mes enfants →</Link>
            </p>
          </div>
        ) : null}

        {family.map((f, i) => {
          const s = summaries.get(f.registrationId);
          if (!s) return null;
          const p = progressOf(s.earned, active, s.balance);
          const mine = requests.filter((r) => r.registrationId === f.registrationId);
          const history = histories[i];
          return (
            <div key={f.registrationId} className="fam-points">
              <GirlPointsCard firstName={f.firstName} progress={p} summary={s} titles={s.victoires + s.attitudes} link={false} />

              <h2 className="fam-h2">Ses récompenses</h2>
              {active.length ? (
                <ul className="fam-rewards">
                  {active.map((r) => (
                    <li key={r.id} className="fam-reward" data-ok={r.cost <= s.balance || undefined}>
                      <span className="fam-reward__icon" aria-hidden>{REWARD_KINDS[r.kind].emoji}</span>
                      <div className="fam-reward__body">
                        <p className="fam-reward__name">{r.name}{money(r.value_cents) ? ` · ${money(r.value_cents)}` : ""}</p>
                        <p className="fam-reward__how">{r.description || REWARD_KINDS[r.kind].how}</p>
                      </div>
                      <div className="fam-reward__side">
                        <strong>{r.cost}</strong>
                        <small>points</small>
                        {s.phase !== "expire" ? (
                          <RewardRequestButton registrationId={f.registrationId} rewardId={r.id} name={r.name} cost={r.cost} firstName={f.firstName} missing={Math.max(0, r.cost - s.balance)} />
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="parent-card"><p className="parent-muted" style={{ margin: 0 }}>Les récompenses de la saison arrivent bientôt : ses points l&apos;attendent.</p></div>
              )}

              {mine.length ? (
                <>
                  <h2 className="fam-h2">Ses demandes</h2>
                  <ul className="fam-list">
                    {mine.map((r) => (
                      <li key={r.id}>
                        <span>{r.reward}<small>{day(r.createdAt)} · {r.points} points</small></span>
                        <span className="fam-status" data-status={r.status}>{STATUS[r.status]}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              <h2 className="fam-h2">Ses points</h2>
              <ul className="fam-list">
                <li><span>Bienvenue dans la saison</span><strong>+{s.bienvenue}</strong></li>
                <li><span>Présences<small>{s.presences} pratique{s.presences > 1 ? "s" : ""} × {rules.presence} points</small></span><strong>+{s.presence}</strong></li>
                {history.map((h) => (
                  <li key={h.id} data-off={h.status === "annulee" || undefined}>
                    <span>{h.kind === "attitude" ? "⭐ " : h.kind === "victoire" ? "🏆 " : ""}{h.label}<small>{day(h.date)}{h.status === "annulee" ? " · annulée" : ""}</small></span>
                    <strong>{h.status === "annulee" ? "0" : h.points > 0 ? `+${h.points}` : h.points}</strong>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        <div className="parent-card fam-howto">
          <h2 className="fam-h2" style={{ marginTop: 0 }}>Comment gagner des points</h2>
          <ul>
            <li><strong>+{rules.bienvenue}</strong> en commençant la saison</li>
            <li><strong>+{rules.presence}</strong> à chaque pratique où elle est présente</li>
            <li><strong>+{rules.individuel}</strong> quand elle gagne un jeu</li>
            <li><strong>+{rules.groupe}</strong> chacune quand son équipe gagne</li>
            <li><strong>+{rules.attitude}</strong> pour une attitude remarquée par les éducatrices</li>
            <li><strong>jusqu&apos;à +{rules.specialMax}</strong> aux parties spéciales</li>
          </ul>
          <p className="parent-muted" style={{ margin: 0 }}>Les points se dépensent avant la fin de la saison ; ce qui reste devient le cadeau de fin de saison. Le niveau, lui, ne baisse jamais. Il n&apos;y a pas de classement entre les filles.</p>
        </div>
      </Container>
    </section>
  );
}
