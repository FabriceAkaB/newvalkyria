import { AdminTopbar } from "@/components/admin-topbar";
import { Pill } from "@/components/mandalart/ui";
import { ActionButton, AddRefereeForm, CopyLink, CostsForm, PaidButton } from "@/components/referees-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { env } from "@/lib/env";
import { dateLong, listMatches, listReferees, matchFinance, refereeLink } from "@/lib/referees-repo";

export const metadata = { title: "Arbitres et bilan des matchs — Admin", robots: "noindex" };
export const dynamic = "force-dynamic";

const money = (c: number) => `${(c / 100).toLocaleString("fr-CA", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} $`;
const signed = (c: number) => `${c > 0 ? "+" : c < 0 ? "−" : ""}${money(Math.abs(c))}`;

/** « Qui arbitre mes matchs, qui dois-je payer, et est-ce que mes matchs font leurs frais ? » */
export default async function RefereesPage() {
  await requireAdmin({ roles: ["admin"] });
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const [all, referees] = await Promise.all([listMatches({}), listReferees()]);
  const upcoming = all.filter((m) => m.date >= today);
  const played = all.filter((m) => m.date < today);
  // Seuls les matchs vendus ont lieu : ce sont eux qui ont besoin d'arbitres.
  const soldUpcoming = upcoming.filter((m) => m.bookingStatus === "paid");
  const open = soldUpcoming.reduce((s, m) => s + m.assignments.filter((a) => a.status === "ouvert").length, 0);
  const missing = soldUpcoming.reduce((s, m) => s + Math.max(0, m.refereesNeeded - m.assignments.length), 0);
  const toPay = played.flatMap((m) => m.assignments.filter((a) => a.status === "reserve" && !a.paid_at).map((a) => ({ a, m })));
  const active = referees.filter((r) => r.status === "actif");
  const pending = referees.filter((r) => r.status === "en_attente");
  const sold = all.filter((m) => m.bookingStatus === "paid");
  const fin = sold.map((m) => ({ m, f: matchFinance(m) }));
  const totals = fin.reduce(
    (t, { f }) => ({ rev: t.rev + f.revenueCents, field: t.field + f.fieldCents, ref: t.ref + f.refereeCents, coach: t.coach + f.coachCents, before: t.before + f.beforeCoachesCents, net: t.net + f.netCents }),
    { rev: 0, field: 0, ref: 0, coach: 0, before: 0, net: 0 }
  );

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Matchs à Terrebonne · {soldUpcoming.length} match{soldUpcoming.length > 1 ? "s" : ""} vendu{soldUpcoming.length > 1 ? "s" : ""} à venir · {upcoming.length - soldUpcoming.length} plage{upcoming.length - soldUpcoming.length > 1 ? "s" : ""} encore à vendre</p>
            <h1 className="mda-h1">{open + missing > 0 ? `${open + missing} poste${open + missing > 1 ? "s" : ""} d'arbitre à combler` : "Tous les matchs ont leurs arbitres"}</h1>
            <p className="mda-lead">Les arbitres réservent eux-mêmes leurs matchs avec leur lien personnel. Chaque réservation ajoute la paie de l'arbitre aux dépenses à payer (Revenus) ; vous la marquez payée après le virement.</p>
          </header>

          <section className="mda-cols-4">
            <div className="mda-card">
              <p className="mda-num">{open + missing}</p>
              <p className="mda-label">Postes d'arbitre à combler (matchs vendus à venir)</p>
            </div>
            <div className="mda-card" style={toPay.length ? { boxShadow: "inset 3px 0 0 var(--adm-warn)" } : undefined}>
              <p className="mda-num">{money(toPay.reduce((s, x) => s + x.a.fee_cents, 0))}</p>
              <p className="mda-label">À payer aux arbitres ({toPay.length} virement{toPay.length > 1 ? "s" : ""})</p>
            </div>
            <div className="mda-card" style={{ boxShadow: `inset 3px 0 0 ${totals.net >= 0 ? "var(--adm-good)" : "var(--adm-bad)"}` }}>
              <p className="mda-num" style={{ color: totals.net >= 0 ? "var(--adm-good)" : "var(--adm-bad)" }}>{signed(totals.net)}</p>
              <p className="mda-label">Bilan des {sold.length} match{sold.length > 1 ? "s" : ""} vendu{sold.length > 1 ? "s" : ""} (objectif : au moins 0 $)</p>
            </div>
            <div className="mda-card">
              <p className="mda-num">{active.length}</p>
              <p className="mda-label">Arbitres actifs{pending.length ? ` · ${pending.length} à approuver` : ""}</p>
            </div>
          </section>

          <section className="mda-card" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            {missing > 0 ? <ActionButton body={{ action: "open-all" }} label={`Ouvrir les ${missing} postes manquants`} done="opened" /> : null}
            {active.length === 0 ? (
              <span style={{ fontSize: "0.85rem", color: "var(--adm-text-2)", alignSelf: "center" }}>Ajoutez vos arbitres plus bas (ou partagez le lien d'inscription) avant d'envoyer la liste.</span>
            ) : (
            <ActionButton
              primary
              body={{ action: "send-list" }}
              label={`Envoyer les matchs ouverts aux ${active.length} arbitres`}
              confirmText={`Envoyer par courriel la liste des matchs ouverts à ${active.length} arbitre(s) actif(s) ?`}
              done="sent"
            />
            )}
            <span style={{ fontSize: "0.82rem", color: "var(--adm-text-3)", alignSelf: "center" }}>
              Lien d'inscription pour un nouvel arbitre : <CopyLink url={`${env.publicSiteUrl}/arbitres/inscription`} label="copier" />
            </span>
          </section>

          {toPay.length > 0 && (
            <section className="mda-card-flush">
              <div className="mda-card-head">
                <h2 className="mda-h2">À payer</h2>
              </div>
              <ul className="mda-tasks">
                {toPay.map(({ a, m }) => {
                  const name = a.referee ? `${a.referee.first_name} ${a.referee.last_name}` : "Arbitre";
                  return (
                    <li key={a.id} className="mda-task" style={{ justifyContent: "space-between" }}>
                      <div>
                        <p className="mda-task-title" style={{ fontWeight: 600 }}>
                          {name} · {money(a.fee_cents)}
                        </p>
                        <div className="mda-task-meta">
                          <span>Match du {dateLong(m.date)}</span>
                          <span>Virement Interac : {a.referee?.interac_email ?? a.referee?.email ?? "—"}</span>
                        </div>
                      </div>
                      <PaidButton assignmentId={a.id} name={name} amount={money(a.fee_cents)} />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="mda-card-flush">
            <div className="mda-card-head">
              <div>
                <h2 className="mda-h2">Matchs à venir · {upcoming.length}</h2>
                <p className="mda-sub" style={{ margin: 0 }}>Reliés aux plages de Vente de matchs. Prix de l'arbitre, terrain et éducateurs modifiables par match.</p>
              </div>
            </div>
            <ul className="mda-tasks">
              {upcoming.map((m) => {
                const f = matchFinance(m);
                const empty = Math.max(0, m.refereesNeeded - m.assignments.length);
                return (
                  <li key={m.id} className="mda-task" style={{ display: "block" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <p className="mda-task-title" style={{ fontWeight: 600 }}>
                          {dateLong(m.date)} · {m.start.replace(":", " h ")}
                        </p>
                        <div className="mda-task-meta">
                          <span>{m.field ?? m.location}</span>
                          <span>{m.ourTeam}</span>
                          {m.opponent ? <span style={{ color: m.bookingStatus === "paid" ? "var(--adm-good)" : undefined }}>contre {m.opponent}{m.bookingStatus === "paid" ? ` · payé ${money(m.revenueCents)}${m.balanceDueCents ? ` + ${money(m.balanceDueCents)} à encaisser` : ""}` : ""}</span> : <span>Plage pas encore vendue</span>}
                        </div>
                      </div>
                      <span className="mda-tnum" style={{ fontSize: "0.85rem", color: f.netCents >= 0 ? "var(--adm-good)" : "var(--adm-text-3)" }} title="Revenu − terrain − arbitres − éducateurs">
                        Bilan prévu {signed(f.netCents)}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                      {m.assignments.map((a) =>
                        a.status === "reserve" ? (
                          <span key={a.id} className="mda-pill" data-tone="good" style={{ gap: 8 }}>
                            ✓ {a.referee ? `${a.referee.first_name} ${a.referee.last_name}` : "Arbitre"}
                            {a.referee?.phone ? ` · ${a.referee.phone}` : ""} · {money(a.fee_cents)}
                            <ActionButton body={{ action: "release", assignmentId: a.id }} label="Libérer" confirmText="Libérer ce poste ? Il redeviendra ouvert aux autres arbitres." />
                          </span>
                        ) : (
                          <span key={a.id} className="mda-pill" data-tone="warn">
                            Poste ouvert · {money(a.fee_cents)}{a.held_for ? ` · gardé pour ${a.held_for}` : ""}
                          </span>
                        )
                      )}
                      {empty > 0 && m.bookingStatus === "paid" ? <ActionButton body={{ action: "open-match", slotId: m.id }} label={`Ouvrir ${empty} poste${empty > 1 ? "s" : ""}`} /> : null}
                      {m.bookingStatus !== "paid" && m.assignments.length === 0 ? <span className="mda-muted" style={{ fontSize: "0.8rem" }}>Les postes s'ouvrent quand la plage est vendue.</span> : null}
                    </div>
                    <details style={{ marginTop: 8 }}>
                      <summary style={{ cursor: "pointer", fontSize: "0.78rem", color: "var(--adm-text-3)" }}>Coûts du match</summary>
                      <div style={{ marginTop: 8 }}>
                        <CostsForm slotId={m.id} refereesNeeded={m.refereesNeeded} refereeFeeCents={m.refereeFeeCents} fieldCostCents={m.fieldCostCents} coachCostCents={m.coachCostCents} />
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="mda-card-flush">
            <div className="mda-card-head">
              <div>
                <h2 className="mda-h2">Bilan financier des matchs vendus</h2>
                <p className="mda-sub" style={{ margin: 0 }}>
                  Ce que l'adversaire paie, moins le terrain (373 $ par 2 h à Terrebonne, soit 186,50 $ par heure de match), les arbitres et les éducateurs. Règle : un match ne doit pas nous coûter.
                </p>
              </div>
            </div>
            {fin.length === 0 ? (
              <p style={{ padding: "16px 20px", margin: 0, color: "var(--adm-text-3)" }}>Aucun match vendu pour l'instant.</p>
            ) : (
              <div className="mda-scroll">
                <table className="mda-table" style={{ minWidth: 720 }}>
                  <thead>
                    <tr>
                      <th>Match</th>
                      <th className="r">Payé par l'adversaire</th>
                      <th className="r">Terrain</th>
                      <th className="r">Arbitres</th>
                      <th className="r">Avant éducateurs</th>
                      <th className="r">Éducateurs</th>
                      <th className="r">Bilan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fin.map(({ m, f }) => (
                      <tr key={m.id}>
                        <td>
                          {dateLong(m.date)}
                          <span className="mda-muted" style={{ display: "block", fontSize: "0.78rem" }}>{m.opponent}</span>
                        </td>
                        <td className="r">
                          {money(f.revenueCents)}
                          {f.balanceDueCents ? <span className="mda-muted" style={{ display: "block", fontSize: "0.75rem" }}>dont {money(f.balanceDueCents)} à encaisser</span> : null}
                        </td>
                        <td className="r">−{money(f.fieldCents)}</td>
                        <td className="r">−{money(f.refereeCents)}</td>
                        <td className="r" style={{ color: f.beforeCoachesCents >= 0 ? "var(--adm-good)" : "var(--adm-warn)" }}>{signed(f.beforeCoachesCents)}</td>
                        <td className="r">−{money(f.coachCents)}</td>
                        <td className="r" style={{ fontWeight: 700, color: f.netCents >= 0 ? "var(--adm-good)" : "var(--adm-bad)" }}>{signed(f.netCents)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td style={{ fontWeight: 700 }}>Total</td>
                      <td className="r" style={{ fontWeight: 700 }}>{money(totals.rev)}</td>
                      <td className="r">−{money(totals.field)}</td>
                      <td className="r">−{money(totals.ref)}</td>
                      <td className="r" style={{ fontWeight: 700 }}>{signed(totals.before)}</td>
                      <td className="r">−{money(totals.coach)}</td>
                      <td className="r" style={{ fontWeight: 700, color: totals.net >= 0 ? "var(--adm-good)" : "var(--adm-bad)" }}>{signed(totals.net)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="mda-card-flush">
            <div className="mda-card-head">
              <h2 className="mda-h2">Arbitres · {referees.length}</h2>
            </div>
            {referees.length === 0 ? (
              <p style={{ padding: "16px 20px", margin: 0, color: "var(--adm-text-3)" }}>Aucun arbitre pour l'instant. Ajoutez-en un ci-dessous, ou partagez le lien d'inscription.</p>
            ) : (
              <ul className="mda-tasks">
                {referees.map((r) => (
                  <li key={r.id} className="mda-task" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                    <div>
                      <p className="mda-task-title" style={{ fontWeight: 600 }}>
                        {r.first_name} {r.last_name}
                      </p>
                      <div className="mda-task-meta">
                        <span>{r.email}</span>
                        {r.phone ? <span>{r.phone}</span> : null}
                        {r.level ? <span>{r.level}</span> : null}
                        {r.interac_email ? <span>Interac : {r.interac_email}</span> : null}
                        <CopyLink url={refereeLink(r.token)} />
                      </div>
                    </div>
                    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                      <Pill tone={r.status === "actif" ? "good" : r.status === "en_attente" ? "warn" : undefined}>{r.status === "actif" ? "Actif" : r.status === "en_attente" ? "À approuver" : "Inactif"}</Pill>
                      {r.status !== "actif" ? <ActionButton body={{ action: "referee-status", id: r.id, status: "actif" }} label={r.status === "en_attente" ? "Approuver (envoie son lien)" : "Réactiver"} /> : <ActionButton body={{ action: "referee-status", id: r.id, status: "inactif" }} label="Désactiver" />}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div style={{ padding: "16px 20px", borderTop: "1px solid var(--adm-line)" }}>
              <p className="mda-label" style={{ marginTop: 0, fontWeight: 600, color: "var(--adm-text)" }}>Ajouter un arbitre</p>
              <AddRefereeForm />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
