import Link from "next/link";

import { NewTournament } from "@/components/admin-tournament";
import { AdminTopbar } from "@/components/admin-topbar";
import { requireAdmin } from "@/lib/admin-auth";
import { money } from "@/lib/tournaments-core";
import { listTournaments } from "@/lib/tournaments-repo";

export const metadata = { title: "Tournois — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Tournois (JP, 25 nov. 2026) : lesquels peuvent partir ? Minimum, réponses, go, paiements. */
export default async function Page() {
  await requireAdmin({ roles: ["admin"] });
  const list = await listTournaments();
  const ready = list.filter((t) => t.progress.reached && !t.settings.go).length;
  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Tournois proposés aux familles</p>
            <h1 className="mda-h1">{list.length ? (ready ? `${ready} tournoi${ready > 1 ? "s" : ""} prêt${ready > 1 ? "s" : ""} pour le go` : `${list.length} tournoi${list.length > 1 ? "s" : ""} en préparation`) : "Aucun tournoi pour l'instant"}</h1>
            <p className="mda-lead">L&apos;académie n&apos;avance rien : les familles disent si leur fille est intéressée ou disponible ; au minimum de joueuses, tu donnes le go et chaque famille disponible reçoit son lien de paiement (inscription du tournoi + coach, partagés entre les joueuses), avec une date limite et un rappel.</p>
          </header>
          <NewTournament />
          {list.length ? (
            <section className="mda-card-flush">
              <div className="admin-table-wrap" style={{ margin: 0, border: 0, boxShadow: "none" }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Tournoi</th>
                      <th>Dates</th>
                      <th>Disponibles / minimum</th>
                      <th style={{ textAlign: "right" }}>Par joueuse</th>
                      <th>État</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((t) => (
                      <tr key={t.slug}>
                        <td>
                          <Link href={`/admin/tournois/${t.slug}`} style={{ color: "var(--adm-text)", fontWeight: 600 }}>{t.name}</Link>
                          {t.settings.teamLabel ? <span style={{ display: "block", color: "var(--adm-text-3)", fontSize: "0.8rem" }}>{t.settings.teamLabel}</span> : null}
                        </td>
                        <td>{t.datesLabel}</td>
                        <td style={{ minWidth: 160 }}>
                          <span className="mda-tnum">{t.progress.count} / {t.minPlayers}</span>
                          <div className="mda-bar mda-bar-thin" style={{ marginTop: 6 }}>
                            <div className="mda-fill" style={{ width: `${t.progress.pct}%`, background: t.progress.reached ? "var(--adm-good)" : undefined }} />
                          </div>
                        </td>
                        <td style={{ textAlign: "right" }} className="mda-tnum">{t.settings.go ? money(t.settings.go.priceCents) : t.cost.high != null ? `≤ ${money(t.cost.high)}` : "—"}</td>
                        <td>
                          <span className="mda-pill" data-tone={t.settings.go ? "good" : t.progress.reached ? "accent" : undefined}>
                            {t.settings.go ? `Go · ${t.tally.paid} payée${t.tally.paid > 1 ? "s" : ""}` : t.progress.reached ? "Prêt pour le go" : t.published ? "Publié, en attente" : "Brouillon"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
