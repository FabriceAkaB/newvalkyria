import { AdminTopbar } from "@/components/admin-topbar";
import { Pill } from "@/components/mandalart/ui";
import { HidePostButton, RedeemButton, RedemptionActions, RewardsEditor, RulesEditor } from "@/components/player-points-admin";
import { PointsProgress } from "@/components/points-progress";
import { requireAdmin } from "@/lib/admin-auth";
import { CHAMPION_KINDS, LEVELS, progressOf } from "@/lib/player-points";
import { getPointsSummaries, getRecentChampions, getRedemptions, getRewards, getRules } from "@/lib/player-points-repo";
import { getSeasonPlayers } from "@/lib/skill-tests-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const metadata = { title: "Points et récompenses — Coaching", robots: "noindex" };
export const dynamic = "force-dynamic";

const fr = (iso: string) =>
  iso.length > 10
    ? new Date(iso).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short", timeZone: "America/Toronto" })
    : new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** « Qu'est-ce que j'ai à remettre, et qui a été championne ? » Les éducateurs publient les championnes du jour dans
 *  leur portail ; la présence et la bienvenue donnent des points toutes seules ; les familles demandent leurs
 *  récompenses dans leur espace. Pas de classement entre les filles. */
export default async function PointsPage() {
  const role = await requireAdmin();
  const db = getSupabaseAdminClient() as any;
  const [players, rules, rewards, posts, open, { data: products }] = await Promise.all([
    getSeasonPlayers(),
    getRules(),
    getRewards(),
    getRecentChampions(14),
    getRedemptions({ openOnly: true }),
    db.from("products").select("id, name").eq("active", true).order("name")
  ]);
  const summaries = await getPointsSummaries(players.map((p) => p.registrationId), rules);
  const groups = [...new Map(players.map((p) => [p.groupKey, p.group])).entries()];
  const active = rewards.filter((r) => r.active);
  const toSpend = [...summaries.values()].reduce((s, x) => s + x.balance, 0);
  const any = [...summaries.values()][0];
  const end = any?.seasonEnd;
  const defaultGift = rewards.find((r) => r.is_default && r.active);

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Espace coaching · points des joueuses</p>
            <h1 className="mda-h1">
              {open.length ? `${open.length} récompense${open.length > 1 ? "s" : ""} à remettre` : posts.length ? `${posts.length} publication${posts.length > 1 ? "s" : ""} de championnes en 14 jours` : "Aucune championne publiée depuis 14 jours"}
            </h1>
            <p className="mda-lead">
              Chaque fille commence la saison avec {rules.bienvenue} points de bienvenue, puis gagne {rules.presence} points par présence et ses points de championne. Elle dépense ses points dans l&apos;espace famille avant le {end ? new Date(`${end}T12:00:00Z`).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "dernier jour de la saison"} ; après, ce qui reste devient {defaultGift ? `« ${defaultGift.name} »` : "le cadeau par défaut (à choisir plus bas)"}. {toSpend.toLocaleString("fr-CA")} points à dépenser en ce moment.
            </p>
          </header>

          {open.length > 0 && (
            <section className="mda-card-flush">
              <div className="mda-card-head"><h2 className="mda-h2">À remettre</h2><Pill>{open.length}</Pill></div>
              <ul className="mda-tasks">
                {open.map((r) => (
                  <li key={r.id} className="mda-task" style={{ alignItems: "center" }}>
                    <div className="mda-task-body">
                      <p className="mda-task-title" style={{ fontWeight: 600 }}>{r.reward} · {r.playerName}</p>
                      <div className="mda-task-meta"><span>{r.points} points · demandée le {fr(r.createdAt)}</span></div>
                    </div>
                    <RedemptionActions id={r.id} name={r.playerName} reward={r.reward} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mda-card-flush">
            <div className="mda-card-head"><h2 className="mda-h2">Championnes des 14 derniers jours</h2></div>
            {posts.length === 0 ? (
              <p className="admin-empty-text" style={{ padding: "0 20px 20px" }}>Les éducateurs publient les championnes dans leur portail, à l&apos;étape « Après » de chaque pratique.</p>
            ) : (
              <ul className="mda-tasks">
                {posts.map((p) => {
                  const k = CHAMPION_KINDS.find((x) => x.kind === p.kind)!;
                  return (
                    <li key={p.id} className="mda-task" style={{ alignItems: "center", opacity: p.hidden ? 0.55 : 1 }}>
                      {p.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.photoUrl} alt="" width={56} height={56} style={{ borderRadius: 10, objectFit: "cover", flex: "0 0 auto" }} />
                      ) : (
                        <span aria-hidden style={{ width: 56, height: 56, borderRadius: 10, display: "grid", placeItems: "center", fontSize: "1.5rem", background: "var(--adm-accent-soft)", flex: "0 0 auto" }}>{k.emoji}</span>
                      )}
                      <div className="mda-task-body">
                        <p className="mda-task-title" style={{ fontWeight: 600 }}>{p.title || k.label} · {p.girls.map((g) => g.name).join(", ")}</p>
                        <div className="mda-task-meta">
                          <span>+{p.points}{p.girls.length > 1 ? " chacune" : ""}</span>
                          <span>{fr(p.activity.date)} · {p.activity.title}</span>
                          {p.coachName ? <span>{p.coachName}</span> : null}
                          {p.hidden ? <span>retirée du fil</span> : null}
                        </div>
                      </div>
                      <HidePostButton id={p.id} hidden={p.hidden} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {groups.map(([key, label]) => {
            const list = players.filter((p) => p.groupKey === key);
            return (
              <section key={key} className="mda-card-flush">
                <div className="mda-card-head">
                  <h2 className="mda-h2" style={{ fontSize: "1rem" }}>{label}</h2>
                  <Pill>{list.length} joueuses</Pill>
                </div>
                <div className="admin-table-wrap" style={{ margin: 0 }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Joueuse</th>
                        <th style={{ textAlign: "right" }}>Présences</th>
                        <th style={{ textAlign: "right" }}>🏆</th>
                        <th style={{ textAlign: "right" }}>⭐</th>
                        <th style={{ textAlign: "right" }}>À dépenser</th>
                        <th style={{ minWidth: 200 }}>Niveau</th>
                        <th>Récompense</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((p) => {
                        const s = summaries.get(p.registrationId)!;
                        return (
                          <tr key={p.registrationId}>
                            <td>{p.firstName} {p.lastName}</td>
                            <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.presences}</td>
                            <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.victoires}</td>
                            <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.attitudes}</td>
                            <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{s.balance}</td>
                            <td><PointsProgress p={progressOf(s.earned, active, s.balance)} compact /></td>
                            <td><RedeemButton registrationId={p.registrationId} name={p.firstName} balance={s.balance} rewards={rewards} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}

          <section className="mda-card">
            <h2 className="mda-h2" style={{ marginBottom: 6 }}>Le barème</h2>
            <p className="mda-sub" style={{ margin: "0 0 12px" }}>
              Une gagnante seule, chaque fille d&apos;un groupe gagnant (ex. une équipe de 4), l&apos;attitude ; une partie spéciale se règle à la publication, jusqu&apos;au maximum. Présence et bienvenue se recalculent pour toutes les joueuses (même les présences saisies en retard) ; les points de championne restent tels que donnés.
            </p>
            <RulesEditor rules={rules} canEdit={role === "admin"} />
          </section>

          <section className="mda-card">
            <h2 className="mda-h2" style={{ marginBottom: 6 }}>Les récompenses</h2>
            <p className="mda-sub" style={{ margin: "0 0 12px" }}>
              Les familles les demandent dans leur espace (onglet Points) : les points sont retirés tout de suite et une tâche « Remettre … » arrive dans Aujourd&apos;hui. Niveaux (selon les points gagnés, ils ne baissent jamais) : {LEVELS.map((l) => `${l.name} ${l.min}`).join(" · ")}.
            </p>
            {role === "admin" ? (
              <RewardsEditor rewards={rewards} products={(products ?? []) as { id: string; name: string }[]} />
            ) : (
              <ul className="mda-sub" style={{ margin: 0 }}>{rewards.filter((r) => r.active).map((r) => <li key={r.id}>{r.cost} points · {r.name}</li>)}</ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
