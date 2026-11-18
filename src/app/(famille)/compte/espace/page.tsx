import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/container";
import { EmailCheckBanner } from "@/components/email-check-banner";
import { ChampionFeed, GirlPointsCard } from "@/components/family-champions";
import { requireParentUserId } from "@/lib/parent-auth";
import { progressOf } from "@/lib/player-points";
import { getFamilyFeed, getPointsHistory, getPointsSummaries, getRewards } from "@/lib/player-points-repo";
import { getFamilyRegistrations, getParentAccount, isParentEmailVerified } from "@/lib/parent-repo";

export const metadata: Metadata = { title: "Accueil | Espace famille", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Accueil de l'app famille : les points de chaque fille, puis le fil des championnes du jour (les pratiques de
 *  son groupe) et son palmarès. */
export default async function EspaceParentPage({ searchParams }: { searchParams: Promise<{ courriel?: string }> }) {
  const userId = await requireParentUserId();
  const [account, family, sp] = await Promise.all([getParentAccount(userId), getFamilyRegistrations(userId), searchParams]);
  const verified = account?.email ? await isParentEmailVerified(userId, account.email) : false;
  const ids = family.map((f) => f.registrationId);
  const [summaries, rewards, feed, histories] = await Promise.all([
    getPointsSummaries(ids),
    getRewards(),
    getFamilyFeed(ids),
    Promise.all(ids.map((id) => getPointsHistory(id).catch(() => [])))
  ]);
  const active = rewards.filter((r) => r.active);
  const firstName = (account?.fullName ?? "").split(" ")[0];

  return (
    <section className="insc-hero">
      <Container className="max-w-2xl">
        <div className="fam-hello">
          <p>Bonjour{firstName ? ` ${firstName}` : ""} 👋</p>
          <h1>{family.length ? (family.length === 1 ? `La saison de ${family[0].firstName}` : `La saison de ${family.map((f) => f.firstName).join(" et ")}`) : "Votre espace famille"}</h1>
        </div>
        <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1.25rem" }}>
          {sp.courriel === "confirme" ? <p style={{ margin: 0, color: "#7ee2a8", fontWeight: 600 }}>Merci, votre courriel est confirmé.</p> : null}
          {sp.courriel === "invalide" ? <p style={{ margin: 0, color: "#f4a3a3" }}>Ce lien de confirmation n&apos;est plus valide : demandez-en un nouveau ci-dessous.</p> : null}
          {!verified ? <EmailCheckBanner /> : null}
        </div>

        {family.length ? (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {family.map((f, i) => {
              const s = summaries.get(f.registrationId);
              if (!s) return null;
              return (
                <GirlPointsCard
                  key={f.registrationId}
                  firstName={f.firstName}
                  progress={progressOf(s.earned, active, s.balance)}
                  summary={s}
                  titles={histories[i].filter((h) => h.kind === "victoire" || h.kind === "attitude").length}
                />
              );
            })}
          </div>
        ) : (
          <div className="parent-card">
            <h2 style={{ marginTop: 0 }}>Bienvenue</h2>
            <p className="parent-muted" style={{ margin: 0 }}>
              {verified
                ? "Nous ne trouvons pas encore d'inscription à la saison pour votre famille. Si l'autre parent a inscrit votre fille, reliez son profil dans « Mes enfants »."
                : "Confirmez votre courriel ci-dessus : la saison de votre fille (points, championnes, bulletin) apparaîtra ici."}{" "}
              <Link href="/compte/enfants" className="parent-link">Mes enfants →</Link>
            </p>
          </div>
        )}

        <h2 className="fam-h2">Championnes du jour</h2>
        <ChampionFeed posts={feed} empty={family.length ? "Les championnes de ses pratiques apparaîtront ici dès que les éducatrices les publieront, après chaque pratique." : "Le fil des championnes s'ouvre dès l'inscription de votre fille."} />

        {family.map((f, i) => {
          const wins = histories[i].filter((h) => h.kind === "victoire" || h.kind === "attitude");
          if (!wins.length) return null;
          return (
            <div key={f.registrationId} className="fam-palmares">
              <h2 className="fam-h2">Le palmarès de {f.firstName}</h2>
              <ul>
                {wins.slice(0, 12).map((w) => (
                  <li key={w.id}>
                    <span aria-hidden>{w.kind === "attitude" ? "⭐" : "🏆"}</span>
                    <span>{w.label}<small>{new Date(`${w.date}T12:00:00Z`).toLocaleDateString("fr-CA", { day: "numeric", month: "long", timeZone: "UTC" })}</small></span>
                    <strong>+{w.points}</strong>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </Container>
    </section>
  );
}
