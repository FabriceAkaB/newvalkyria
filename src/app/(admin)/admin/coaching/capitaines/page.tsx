import { AdminTopbar } from "@/components/admin-topbar";
import { Pill } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { LEADERSHIP_SCALE } from "@/lib/practice-teams-core";
import { getCaptainFollowUp } from "@/lib/practice-teams-repo";
import { getSeasonPlayers } from "@/lib/skill-tests-repo";

export const metadata = { title: "Capitaines et leadership — Coaching", robots: "noindex" };
export const dynamic = "force-dynamic";

const fr = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { day: "numeric", month: "short", timeZone: "UTC" });

/** « Qui a été capitaine, et comment se développe son leadership ? » Les éducateurs forment les équipes dans le portail
 *  (le site évite de remettre les mêmes ensemble), nomment une capitaine à tour de rôle avec une tâche liée au thème,
 *  puis notent son leadership de 1 à 5. */
export default async function CaptainsPage() {
  await requireAdmin();
  const [players, follow] = await Promise.all([getSeasonPlayers(), getCaptainFollowUp()]);
  const byId = new Map(follow.map((f) => [f.registrationId, f]));
  const groups = [...new Map(players.map((p) => [p.groupKey, p.group])).entries()];
  const never = players.filter((p) => !byId.has(p.registrationId)).length;
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Espace coaching · leadership</p>
            <h1 className="mda-h1">{follow.length ? `${follow.length} capitaine${follow.length > 1 ? "s" : ""} jusqu'ici · ${never} pas encore` : "Aucune capitaine nommée pour l'instant"}</h1>
            <p className="mda-lead">
              À chaque pratique, l&apos;éducateur forme les équipes ou les duos dans son portail (étape « Pendant ») : le site évite de remettre les mêmes filles ensemble et propose comme capitaine celle qui l&apos;a été le moins. La capitaine reçoit une tâche selon le thème de la semaine ; après la pratique, l&apos;éducateur note son leadership de 1 à 5.
            </p>
          </header>
          {groups.map(([key, label]) => {
            const list = players.filter((p) => p.groupKey === key);
            return (
              <section key={key} className="mda-card-flush">
                <div className="mda-card-head">
                  <h2 className="mda-h2" style={{ fontSize: "1rem" }}>{label}</h2>
                  <Pill>{list.filter((p) => byId.has(p.registrationId)).length}/{list.length} capitaines</Pill>
                </div>
                <ul className="mda-tasks">
                  {list.map((p) => {
                    const f = byId.get(p.registrationId);
                    return (
                      <li key={p.registrationId} className="mda-task" style={{ alignItems: "flex-start" }}>
                        <div className="mda-task-body">
                          <p className="mda-task-title" style={{ fontWeight: 600 }}>
                            {p.firstName} {p.lastName}
                          </p>
                          <div className="mda-task-meta">
                            {f ? (
                              <>
                                <span>Capitaine {f.times} fois</span>
                                <span style={{ color: f.average !== null && f.average >= 4 ? "var(--adm-good)" : f.average !== null && f.average < 3 ? "var(--adm-warn)" : undefined }}>
                                  Leadership {f.average !== null ? `${f.average.toLocaleString("fr-CA")}/5` : "pas encore noté"}
                                </span>
                                {f.last.slice(0, 3).map((l, i) => (
                                  <span key={i}>
                                    {fr(l.date)} : {l.leadership ? `${l.leadership}/5 (${LEADERSHIP_SCALE[l.leadership].toLowerCase()})` : "à noter"}
                                    {l.note ? ` · « ${l.note} »` : ""}
                                  </span>
                                ))}
                              </>
                            ) : (
                              <span>Pas encore capitaine : elle sera proposée en premier</span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
