import { McsRobotPanel } from "@/components/mcs-robot-panel";
import { McsRobotForm } from "@/components/mcs-teams-admin";
import { ScheduledEmailCancel } from "@/components/scheduled-email-cancel";
import { requireAdmin } from "@/lib/admin-auth";
import { getRobotStatus } from "@/lib/mcs-robot-config";
import { getMcsRules } from "@/lib/mcs-rules-repo";
import { listPendingEmails } from "@/lib/scheduled-emails";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const metadata = { title: "Robot MonClubSportif — Admin", robots: "noindex" };
export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("fr-CA", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });

/** Le robot MonClubSportif en un écran : son compte, ses règles (par club), ce qu'il ferait, ce qu'il a fait,
 *  et les courriels programmés qui attendent leur heure. */
export default async function McsRobotPage() {
  await requireAdmin({ roles: ["admin"] });
  const [rules, robot, pending, { data: journal }] = await Promise.all([
    getMcsRules(),
    getRobotStatus().catch(() => null),
    listPendingEmails(),
    (getSupabaseAdminClient() as any).from("audit_log").select("created_at, action, entity_label, after").in("action", ["mcs_robot_run", "mcs_attendance_sync", "mcs_rules_saved", "mcs_robot_saved"]).order("created_at", { ascending: false }).limit(15)
  ]);
  const campaigns = [...new Set(pending.map((p) => p.campaign ?? p.subject))];
  const summary = (a: any) => {
    if (a.action === "mcs_rules_saved") return "Règles modifiées";
    if (a.action === "mcs_robot_saved") return "Compte robot enregistré";
    if (a.action === "mcs_attendance_sync") return `Présences : ${a.entity_label}`;
    const r = a.after ?? {};
    const parts = [r.added?.length && `${r.added.length} ajout(s)`, r.photos?.length && `${r.photos.length} photo(s)`, r.opponents?.length && `${r.opponents.length} adversaire(s)`, r.calendar?.length && `${r.calendar.length} changement(s) de calendrier`, r.unlocked?.length && `${r.unlocked.length} équipe(s) déverrouillée(s)`, r.errors?.length && `${r.errors.length} erreur(s)`].filter(Boolean);
    return `Robot (${a.entity_label}) : ${parts.join(", ") || "rien à faire"}`;
  };

  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 1000 }}>
        <section className="mda-cols-3">
          <div className="mda-card">
            <p className="mda-num">{robot ? "Oui" : "Non"}</p>
            <p className="mda-label">Compte robot enregistré{robot ? ` (${robot.email})` : " : à faire plus bas"}</p>
          </div>
          <div className="mda-card">
            <p className="mda-num">{rules.robotActive ? "Actif" : "Assistant"}</p>
            <p className="mda-label">{rules.robotActive ? "Il agit tout seul à chaque paiement et chaque heure" : "Il montre ce qu'il ferait, sans rien toucher"}</p>
          </div>
          <div className="mda-card">
            <p className="mda-num">{pending.length}</p>
            <p className="mda-label">Courriel{pending.length > 1 ? "s" : ""} programmé{pending.length > 1 ? "s" : ""} en attente</p>
          </div>
        </section>

        <section className="mda-card">
          <h2 className="mda-h2" style={{ marginBottom: 4 }}>Les règles du club</h2>
          <p className="mda-sub" style={{ marginTop: 0 }}>Ce qui se fait tout seul dès qu&apos;une joueuse paie, chaque heure et chaque soir. Enregistré pour ce club : un autre club aura ses propres règles.</p>
          <McsRobotPanel initial={rules} hasAccount={Boolean(robot)} />
        </section>

        {pending.length > 0 && (
          <section className="mda-card-flush">
            <div className="mda-card-head">
              <h2 className="mda-h2">Courriels programmés</h2>
            </div>
            <ul className="mda-tasks">
              {campaigns.map((c) => {
                const list = pending.filter((p) => (p.campaign ?? p.subject) === c);
                return (
                  <li key={c} className="mda-task" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <span style={{ minWidth: 0 }}>
                      <span className="mda-task-title" style={{ fontWeight: 600 }}>{list[0].subject}</span>
                      <span className="mda-label" style={{ display: "block" }}>{when(list[0].send_at)} · {list.length} destinataire{list.length > 1 ? "s" : ""}</span>
                    </span>
                    <ScheduledEmailCancel campaign={c} />
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="mda-card-flush">
          <div className="mda-card-head">
            <h2 className="mda-h2">Journal du robot</h2>
          </div>
          {(journal ?? []).length === 0 ? (
            <p className="admin-empty-text" style={{ padding: "0 20px 20px" }}>Rien encore : le robot écrit ici chaque fois qu&apos;il fait quelque chose.</p>
          ) : (
            <ul className="mda-tasks">
              {(journal as any[]).map((a, i) => (
                <li key={i} className="mda-task">
                  <span className="mda-muted mda-tnum" style={{ minWidth: 120 }}>{when(a.created_at)}</span>
                  <span className="mda-task-title">{summary(a)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mda-card">
          <h2 className="mda-h2" style={{ marginBottom: 10 }}>Compte robot MonClubSportif</h2>
          <McsRobotForm status={robot} />
        </section>
      </div>
    </div>
  );
}
