import Link from "next/link";

import { McsTeamActions, McsTeamForm } from "@/components/mcs-teams-admin";
import { Pill } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { getSlotsWithAvailability } from "@/lib/match-slots-repo";
import { needsOpponent } from "@/lib/mcs-teams";
import { getRobotStatus } from "@/lib/mcs-robot-config";
import { getOpponentsToSync, getUpcomingEvents, listTeams, syncStaleTeams } from "@/lib/mcs-teams-repo";

export const metadata = { title: "Équipes MonClubSportif — Admin", robots: "noindex" };
export const dynamic = "force-dynamic";

const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const ago = (iso: string | null) => {
  if (!iso) return "jamais lu";
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  return min < 1 ? "lu à l'instant" : min < 60 ? `lu il y a ${min} min` : `lu il y a ${Math.round(min / 60)} h`;
};

/** « MonClubSportif et le site disent-ils la même chose ? » : chaque équipe avec son lien « Sync », ses matchs avec ou
 *  sans adversaire, et les plages de match bloquées parce que l'équipe est déjà prise. */
export default async function McsTeamsPage() {
  await requireAdmin({ roles: ["admin"] });
  await syncStaleTeams(15, 6_000).catch(() => 0);
  const [teams, events, slots, robot, toName] = await Promise.all([listTeams(), getUpcomingEvents().catch(() => []), getSlotsWithAvailability().catch(() => []), getRobotStatus().catch(() => null), getOpponentsToSync().catch(() => [])]);
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const matches = events.filter((e) => e.type === "Match" || e.type === "Tournoi");
  const toFind = matches.filter(needsOpponent);
  const blocked = slots.filter((s) => s.mcsConflict);

  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 960 }}>
        <header>
          <p className="mda-eyebrow">MonClubSportif relié au site · lecture automatique</p>
          <h1 className="mda-h1">
            {teams.length === 0 ? "Aucune équipe reliée pour l'instant" : `${teams.length} équipe${teams.length > 1 ? "s" : ""} reliée${teams.length > 1 ? "s" : ""} · ${toFind.length} match${toFind.length > 1 ? "s" : ""} sans adversaire`}
          </h1>
          <p className="mda-lead">
            Pour chaque équipe, colle une seule fois son lien « Sync » (MonClubSportif → l&apos;équipe → Calendrier → Sync). Le site relit ensuite chaque calendrier tout seul :
            une plage de match n&apos;est plus mise en vente quand l&apos;équipe du même âge est déjà prise, et les matchs sans adversaire apparaissent ici.
          </p>
        </header>

        <section className="mda-cols-4">
          <div className="mda-card"><p className="mda-num">{teams.filter((t) => t.urlMasked).length}/{teams.length}</p><p className="mda-label">Équipes avec leur lien</p></div>
          <div className="mda-card"><p className="mda-num">{events.length}</p><p className="mda-label">Événements des 10 prochaines semaines</p></div>
          <div className="mda-card"><p className="mda-num" style={{ color: toFind.length ? "var(--adm-warn)" : undefined }}>{toFind.length}</p><p className="mda-label">Matchs sans adversaire</p></div>
          <div className="mda-card"><p className="mda-num" style={{ color: blocked.length ? "var(--adm-warn)" : undefined }}>{blocked.length}</p><p className="mda-label">Plages retirées de la vente (équipe prise)</p></div>
        </section>

        {toName.length > 0 && (
          <section className="mda-card-flush">
            <div className="mda-card-head">
              <h2 className="mda-h2">Adversaires qui ont payé : à inscrire dans MonClubSportif</h2>
              <Pill tone={robot ? "info" : "warn"}>{robot ? "Le robot s'en charge" : "Robot pas encore branché"}</Pill>
            </div>
            <ul className="mda-tasks">
              {toName.map((o) => (
                <li key={`${o.date}-${o.start}`} className="mda-task" style={{ display: "block" }}>
                  <p className="mda-task-title" style={{ fontWeight: 600 }}>{day(o.date)} · {o.start} · {o.opponent}</p>
                  <div className="mda-task-meta">
                    <span>{o.location}</span>
                    <span>{o.mcsMatch ? `Mettre « ${o.opponent} » comme adversaire du match de ${o.mcsMatch.team}` : "Aucun match à cette heure dans MonClubSportif : le créer (ou y déplacer le match)"}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {toFind.length > 0 && (
          <section className="mda-card-flush">
            <div className="mda-card-head"><h2 className="mda-h2">Matchs à qui il faut trouver un adversaire</h2></div>
            <ul className="mda-tasks">
              {toFind.map((e) => (
                <li key={`${e.team_id}-${e.key}`} className="mda-task" style={{ display: "block" }}>
                  <p className="mda-task-title" style={{ fontWeight: 600 }}>{day(e.date)} · {e.start ?? "?"} · {teamName.get(e.team_id)}</p>
                  <div className="mda-task-meta"><span>{e.title}</span>{e.location ? <span>{e.location}</span> : null}</div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {blocked.length > 0 && (
          <section className="mda-card-flush">
            <div className="mda-card-head"><h2 className="mda-h2">Plages retirées de la vente</h2></div>
            <ul className="mda-tasks">
              {blocked.map((s) => (
                <li key={s.id} className="mda-task" style={{ display: "block" }}>
                  <p className="mda-task-title" style={{ fontWeight: 600 }}>{day(String(s.slot_date).slice(0, 10))} · {String(s.start_time).slice(0, 5)} · {s.location}</p>
                  <div className="mda-task-meta"><span>{s.mcsConflict}</span></div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mda-card-flush">
          <div className="mda-card-head"><h2 className="mda-h2">Les équipes</h2></div>
          {teams.length === 0 ? (
            <p className="admin-empty-text" style={{ padding: "0 20px 20px" }}>Ajoute la première équipe ci-dessous.</p>
          ) : (
            <ul className="mda-tasks">
              {teams.map((t) => {
                const own = matches.filter((e) => e.team_id === t.id);
                return (
                  <li key={t.id} className="mda-task" style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <p className="mda-task-title" style={{ fontWeight: 600, margin: 0 }}>{t.name}</p>
                      <Pill tone={t.last_error ? "bad" : t.urlMasked ? "good" : "warn"}>{t.last_error ? "Lecture impossible" : t.urlMasked ? ago(t.last_sync_at) : "Lien à coller"}</Pill>
                    </div>
                    <div className="mda-task-meta">
                      <span>{t.gender === "garcons" ? "Garçons" : t.gender === "mixte" ? "Mixte" : "Filles"} {t.birth_years.join(", ") || "· années à préciser"}</span>
                      <span>{t.events_count} événement{t.events_count > 1 ? "s" : ""}</span>
                      <span>{own.length} match{own.length > 1 ? "s" : ""} ({own.filter(needsOpponent).length} sans adversaire)</span>
                    </div>
                    <div className="mda-task-meta">
                      <span>{t.mcs_team_id ? `MonClubSportif n° ${t.mcs_team_id}` : "Numéro MonClubSportif manquant : le robot l'ignore"}</span>
                      <span>
                        {t.kind === "match"
                          ? `Équipe de matchs : ${(t.program_ids ?? []).join(", ") || "aucun programme relié"}`
                          : t.kind === "programme"
                            ? `Programme : ${[...(t.session_program_slugs ?? []), ...(t.program_ids ?? [])].join(", ") || "aucun programme relié"}`
                            : `Groupe de pratique : ${(t.slot_ids ?? []).length} plage${(t.slot_ids ?? []).length > 1 ? "s" : ""} horaire${(t.slot_ids ?? []).length > 1 ? "s" : ""}`}
                      </span>
                    </div>
                    {t.last_error && <p style={{ margin: 0, color: "var(--adm-bad)", fontSize: "0.85rem" }}>{t.last_error}</p>}
                    <McsTeamActions team={t} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mda-card">
          <p className="mda-label" style={{ margin: 0 }}>Le robot, ses règles, son compte et son journal sont dans l&apos;onglet <Link href="/admin/monclubsportif/robot" style={{ color: "var(--adm-accent)" }}>Robot et règles</Link>.</p>
        </section>

        <section className="mda-card">
          <h2 className="mda-h2" style={{ marginBottom: 10 }}>Ajouter une équipe</h2>
          <McsTeamForm />
        </section>
      </div>
    </div>
  );
}
