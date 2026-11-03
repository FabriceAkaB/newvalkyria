import { AdminTopbar } from "@/components/admin-topbar";
import { Pill } from "@/components/mandalart/ui";
import { RedeemButton, RewardsEditor } from "@/components/player-points-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { POINTS } from "@/lib/player-points";
import { getPointsSummaries, getRewards } from "@/lib/player-points-repo";
import { getSeasonPlayers } from "@/lib/skill-tests-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const metadata = { title: "Points et récompenses — Coaching", robots: "noindex" };
export const dynamic = "force-dynamic";

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** « Qui a gagné cette semaine, et combien de points a chaque fille ? » Les éducateurs nomment les gagnantes dans leur
 *  rapport ; la présence donne des points toute seule. Pas de classement entre les filles. */
export default async function PointsPage() {
  await requireAdmin();
  const db = getSupabaseAdminClient() as any;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const players = await getSeasonPlayers();
  const [summaries, rewards, { data: products }, { data: recent }] = await Promise.all([
    getPointsSummaries(players.map((p) => p.registrationId)),
    getRewards(),
    db.from("products").select("id, name").eq("active", true).order("name"),
    db
      .from("player_points")
      .select("registration_id, kind, created_at, activity:coach_activities(activity_date, title, category)")
      .in("kind", ["victoire", "attitude"])
      .gte("created_at", `${addDays(today, -7)}T00:00:00`)
      .order("created_at", { ascending: false })
  ]);
  const nameOf = new Map(players.map((p) => [p.registrationId, `${p.firstName} ${p.lastName}`.trim()]));
  const winners = ((recent ?? []) as any[]).filter((w) => nameOf.has(w.registration_id));
  const groups = [...new Map(players.map((p) => [p.groupKey, p.group])).entries()];
  const total = [...summaries.values()].reduce((s, x) => s + x.earned, 0);

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Espace coaching · points des joueuses</p>
            <h1 className="mda-h1">{winners.length ? `${winners.length} titre${winners.length > 1 ? "s" : ""} de gagnante cette semaine` : "Aucune gagnante nommée cette semaine"}</h1>
            <p className="mda-lead">
              Présence : {POINTS.presence} points (comptés tout seuls). Victoire : {POINTS.victoire} points. Attitude : {POINTS.attitude} points (au plus 3 gagnantes par catégorie et par pratique, nommées dans le rapport de l&apos;éducateur). Les points s&apos;échangent contre une récompense. {total.toLocaleString("fr-CA")} points gagnés cette saison.
            </p>
          </header>

          <section className="mda-card-flush">
            <div className="mda-card-head"><h2 className="mda-h2">Gagnantes des 7 derniers jours</h2></div>
            {winners.length === 0 ? (
              <p className="admin-empty-text" style={{ padding: "0 20px 20px" }}>Les gagnantes apparaissent ici dès qu&apos;un éducateur les nomme dans son rapport.</p>
            ) : (
              <ul className="mda-tasks">
                {winners.map((w, i) => (
                  <li key={i} className="mda-task" style={{ alignItems: "center" }}>
                    <div className="mda-task-body">
                      <p className="mda-task-title" style={{ fontWeight: 600 }}>{w.kind === "victoire" ? "🏆" : "⭐"} {nameOf.get(w.registration_id)}</p>
                      <div className="mda-task-meta">
                        <span>{w.kind === "victoire" ? "A remporté quelque chose" : "Attitude"}</span>
                        <span>{String(w.activity?.activity_date ?? "").slice(0, 10)} · {w.activity?.title || w.activity?.category || "Pratique"}</span>
                      </div>
                    </div>
                  </li>
                ))}
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
                        <th style={{ textAlign: "right" }}>Points</th>
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
                            <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                              <strong>{s.balance}</strong>
                              {s.spent > 0 && <span style={{ display: "block", fontSize: "0.72rem", color: "var(--adm-text-3)" }}>{s.spent} échangés</span>}
                            </td>
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
            <h2 className="mda-h2" style={{ marginBottom: 12 }}>Récompenses</h2>
            <RewardsEditor rewards={rewards} products={(products ?? []) as { id: string; name: string }[]} />
          </section>
        </div>
      </div>
    </>
  );
}
