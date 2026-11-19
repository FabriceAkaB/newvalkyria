import { AdminTopbar } from "@/components/admin-topbar";
import { CancelInviteButton, ConfirmInvitesButton, InviteSettingsForm, PriorityList, ScanNowButton } from "@/components/admin-practice-invites";
import { Pill } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdvancedGroups, getCandidates, getInviteSettings, listInvites } from "@/lib/practice-invites-repo";

export const metadata = { title: "Invitations à l'avancé — Coaching", robots: "noindex" };
export const dynamic = "force-dynamic";

const frDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const STATUS: Record<string, { label: string; tone?: "good" | "warn" | "bad" | "info" }> = {
  envoyee: { label: "En attente de réponse", tone: "info" },
  acceptee: { label: "Oui", tone: "good" },
  refusee: { label: "Non", tone: "warn" },
  expiree: { label: "Sans réponse" },
  annulee: { label: "Retirée" }
};

/** « Qui invite-t-on à l'avancé quand des filles sont absentes ? » Le robot lit les absences annoncées dans
 *  MonClubSportif (pratiques de semaine seulement) et propose les filles de l'intermédiaire selon la liste des
 *  priorités ; JP confirme d'un clic, le parent répond oui ou non, et un oui l'ajoute à la pratique dans MonClubSportif. */
export default async function PracticeInvitesPage() {
  await requireAdmin({ roles: ["admin", "gerante"] });
  const [settings, invites, groups] = await Promise.all([getInviteSettings(), listInvites(), getAdvancedGroups()]);
  const boards = await Promise.all(groups.map(async (g) => ({ group: g, candidates: await getCandidates(g) })));
  const proposed = invites.filter((i) => i.status === "proposee");
  const byPractice = [...new Map(proposed.map((i) => [`${i.slot_id}|${i.practice_date}`, proposed.filter((x) => x.slot_id === i.slot_id && x.practice_date === i.practice_date)])).entries()];
  const others = invites.filter((i) => i.status !== "proposee");

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Espace coaching · invitations à l&apos;avancé</p>
            <h1 className="mda-h1">{proposed.length ? `${proposed.length} invitation${proposed.length > 1 ? "s" : ""} à confirmer` : "Aucune invitation à confirmer"}</h1>
            <p className="mda-lead">
              Quand {settings.threshold} filles ou plus du groupe avancé annoncent leur absence dans MonClubSportif (pratiques de semaine seulement : lundi 18 h pour 2016-2017, mercredi 19 h 30 pour 2014-2015), le robot propose autant de filles de l&apos;intermédiaire du même âge. Tu confirmes, le parent répond oui ou non, et un oui l&apos;ajoute à la pratique dans MonClubSportif. C&apos;est la promesse faite aux parents : l&apos;intermédiaire est poussée vers l&apos;avancé.
            </p>
          </header>

          {byPractice.map(([key, rows]) => {
            const [slotId, date] = key.split("|");
            return (
              <section key={key} className="mda-card-flush">
                <div className="mda-card-head">
                  <h2 className="mda-h2" style={{ textTransform: "none" }}>{rows[0].group_label} · <span style={{ textTransform: "capitalize" }}>{frDate(date)}</span>, {rows[0].start_time.replace(":", " h ")}</h2>
                  <Pill tone="warn">{rows.length} à confirmer</Pill>
                </div>
                <p style={{ margin: 0, padding: "0 16px 10px", color: "var(--adm-text-2)" }}>{String(rows[0].reason ?? "").split(" · ")[0]}</p>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {rows.map((r) => (
                    <li key={r.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 16px", borderTop: "1px solid var(--adm-line)" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 600, color: "var(--adm-text)" }}>{r.rank}. {r.player_name}</p>
                        <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "var(--adm-text-2)" }}>{String(r.reason ?? "").split(" · ").slice(1).join(" · ")} · {r.parent_name ?? ""} ({r.parent_email})</p>
                      </div>
                      <CancelInviteButton id={r.id} />
                    </li>
                  ))}
                </ul>
                <div style={{ padding: "12px 16px", borderTop: "1px solid var(--adm-line)" }}>
                  <ConfirmInvitesButton slotId={slotId} date={date} count={rows.length} />
                  <p style={{ margin: "8px 0 0", fontSize: "0.82rem", color: "var(--adm-text-2)" }}>Un courriel par famille, Christine en copie, avec « Oui, elle sera là » / « Non, pas cette fois ».</p>
                </div>
              </section>
            );
          })}

          <section className="mda-card-flush">
            <div className="mda-card-head"><h2 className="mda-h2">Invitations envoyées</h2><ScanNowButton /></div>
            {others.length ? (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {others.map((r) => (
                  <li key={r.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 16px", borderTop: "1px solid var(--adm-line)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, color: "var(--adm-text)" }}><strong>{r.player_name}</strong> · {r.group_label}, <span style={{ textTransform: "capitalize" }}>{frDate(r.practice_date)}</span></p>
                      {r.status === "acceptee" && <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: r.mcs_error ? "var(--adm-bad)" : "var(--adm-text-2)" }}>{r.mcs_added_at ? "Ajoutée dans MonClubSportif" : r.mcs_error ? `MonClubSportif : ${r.mcs_error} (tâche créée)` : "Ajout dans MonClubSportif au prochain passage du robot"}</p>}
                    </div>
                    <Pill tone={STATUS[r.status]?.tone}>{STATUS[r.status]?.label ?? r.status}</Pill>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, padding: "14px 16px", color: "var(--adm-text-2)" }}>Aucune invitation dans les 14 derniers jours. Le robot lit les absences toutes les heures, de 8 h à 21 h.</p>
            )}
          </section>

          {boards.map(({ group, candidates }) => (
            <section key={group.slotId} className="mda-card-flush">
              <div className="mda-card-head">
                <h2 className="mda-h2" style={{ textTransform: "none" }}>Priorités : {group.label}</h2>
                <Pill>{candidates.length} filles de l&apos;intermédiaire</Pill>
              </div>
              <p style={{ margin: 0, padding: "0 16px 10px", color: "var(--adm-text-2)", fontSize: "0.9rem" }}>
                L&apos;ordre : 1. les filles que tu épingles, dans ton ordre ; 2. la moins invitée cette saison (chacune son tour) ; 3. les meilleures évaluations des 60 derniers jours ; 4. la meilleure présence. Jamais une fille qui a sa propre pratique à la même heure.
              </p>
              <PriorityList slotId={group.slotId} candidates={candidates.map((c) => ({ registrationId: c.registrationId, name: c.name, rank: c.rank, reason: c.reason, pinned: c.pinned, ownGroup: c.ownGroup }))} />
            </section>
          ))}

          <section className="mda-card-flush">
            <div className="mda-card-head"><h2 className="mda-h2">Réglages</h2></div>
            <InviteSettingsForm threshold={settings.threshold} enabled={settings.enabled} />
          </section>
        </div>
      </div>
    </>
  );
}
