import Link from "next/link";

import { AdminTopbar } from "@/components/admin-topbar";
import { Pill } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { getPayrollRows, holdDetail, type PayrollRow } from "@/lib/coach-payroll-data";
import { getCoaches } from "@/lib/coaches-repo";
import { getAllContracts } from "@/lib/employee-contracts";
import { listPractices } from "@/lib/practices-repo";

export const metadata = { title: "Suivi des éducateurs — Admin", robots: "noindex" };
export const dynamic = "force-dynamic";

const TZ = "America/Toronto";
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const DAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
const money = (c: number) => `${(c / 100).toLocaleString("fr-CA", { maximumFractionDigits: 2 })} $`;

function rowState(r: PayrollRow): { tone: "good" | "warn" | "bad" | undefined; label: string } {
  if (r.attendance === "absent" || r.attendance === "cancelled") return { tone: undefined, label: "Absent / annulé" };
  if (!r.hold) return { tone: "good", label: r.paid ? "Complet · payé" : "Complet" };
  return { tone: r.hold === "presence" ? "bad" : "warn", label: holdDetail(r) };
}

/** « Mes éducateurs ont-ils un contrat signé, un accès au portail, et remplissent-ils leurs rapports ? » */
export default async function CoachFollowUpPage() {
  await requireAdmin({ roles: ["admin"] });
  const t = today();
  const from = addDays(t, -21);
  const [coaches, contracts, rows, practices] = await Promise.all([getCoaches(), getAllContracts(), getPayrollRows().catch(() => []), listPractices({ from, to: t }).catch(() => [])]);
  const recent = rows.filter((r) => String(r.activityDate).slice(0, 10) >= from && String(r.activityDate).slice(0, 10) <= t);
  const active = coaches.filter((c) => c.status === "active");
  const contractFor = (first: string) => contracts.find((k) => norm(k.employee_name).split(/\s+/)[0] === norm(first).split(/\s+/)[0] && k.status !== "cancelled");
  const unmatchedContracts = contracts.filter((k) => k.status !== "cancelled" && !active.some((c) => norm(k.employee_name).split(/\s+/)[0] === norm(c.first_name).split(/\s+/)[0]));
  const incomplete = recent.filter((r) => r.hold && r.attendance !== "absent" && r.attendance !== "cancelled");
  const pastNoCoach = practices.filter((p) => p.date < t && p.source !== "activite" && !p.activityId);
  const pastActivityIds = new Set(rows.map((r) => r.activityId));
  const pastWithoutAssignment = practices.filter((p) => p.date <= t && p.activityId && !pastActivityIds.has(p.activityId) && !p.organization);

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">3 dernières semaines · contrats, accès, présences et rapports</p>
            <h1 className="mda-h1">{incomplete.length ? `${incomplete.length} rapport${incomplete.length > 1 ? "s" : ""} d'éducateur à compléter` : "Tous les rapports des éducateurs sont complets"}</h1>
            <p className="mda-lead">Un rapport est complet quand l'éducateur a confirmé sa présence, rempli les présences des joueuses et les évaluations. Sinon, ses heures sont retenues dans la paie et il reçoit une relance 24 h après la pratique.</p>
          </header>

          <section className="mda-cols-3">
            <div className="mda-card">
              <p className="mda-num">{contracts.filter((k) => k.status === "signed").length}/{contracts.filter((k) => k.status !== "cancelled").length}</p>
              <p className="mda-label">Contrats signés · <Link href="/admin/contrats" style={{ color: "var(--adm-accent)" }}>Contrats de travail</Link></p>
            </div>
            <div className="mda-card">
              <p className="mda-num">{active.filter((c) => c.username && c.email).length}/{active.length}</p>
              <p className="mda-label">Éducateurs avec accès au portail (identifiant + courriel) · <Link href="/admin/entraineurs" style={{ color: "var(--adm-accent)" }}>Entraîneurs</Link></p>
            </div>
            <div className="mda-card" style={incomplete.length ? { boxShadow: "inset 3px 0 0 var(--adm-warn)" } : undefined}>
              <p className="mda-num">{recent.length ? Math.round(((recent.length - incomplete.length) / recent.length) * 100) : 0} %</p>
              <p className="mda-label">Rapports complets ({recent.length - incomplete.length} sur {recent.length} activités assignées)</p>
            </div>
          </section>

          {active.map((c) => {
            const k = contractFor(c.first_name);
            const mine = recent.filter((r) => r.coachId === c.id).sort((a, b) => String(b.activityDate).localeCompare(String(a.activityDate)));
            const held = mine.filter((r) => r.hold);
            return (
              <section key={c.id} className="mda-card-flush">
                <div className="mda-card-head" style={{ alignItems: "flex-start" }}>
                  <div>
                    <h2 className="mda-h2" style={{ textTransform: "capitalize" }}>
                      {c.first_name} {c.last_name}
                    </h2>
                    <div className="mda-task-meta" style={{ marginTop: 6 }}>
                      {k ? (
                        <Pill tone={k.status === "signed" ? "good" : "warn"}>{k.status === "signed" ? "Contrat signé" : "Contrat envoyé, pas signé"}</Pill>
                      ) : (
                        <Pill tone="bad">Pas de contrat</Pill>
                      )}
                      <Pill tone={c.username && c.email ? "good" : "bad"}>{c.username && c.email ? "Accès au portail" : !c.email ? "Pas de courriel" : "Pas d'identifiant"}</Pill>
                      {held.length ? <Pill tone="warn">{held.length} rapport{held.length > 1 ? "s" : ""} à compléter</Pill> : mine.length ? <Pill tone="good">Rapports à jour</Pill> : <Pill>Aucune activité assignée</Pill>}
                    </div>
                  </div>
                  <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
                    <Link href={`/admin/entraineurs/${c.id}`} className="admin-btn-ghost" style={{ textDecoration: "none", padding: "6px 12px" }}>Fiche</Link>
                    {k ? (
                      <Link href="/admin/contrats" className="admin-btn-ghost" style={{ textDecoration: "none", padding: "6px 12px" }}>Contrat</Link>
                    ) : null}
                  </span>
                </div>
                {mine.length ? (
                  <ul className="mda-tasks">
                    {mine.map((r) => {
                      const s = rowState(r);
                      return (
                        <li key={r.assignmentId} className="mda-task" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                          <div>
                            <Link href={`/admin/entraineurs/activites/${r.activityId}`} className="mda-task-title" style={{ color: "var(--adm-text)", textDecoration: "none", fontWeight: 600 }}>
                              {dayLabel(String(r.activityDate).slice(0, 10))} · {r.activityStart} · {r.activityLabel}
                            </Link>
                            <div className="mda-task-meta">
                              <span>{r.hours.toLocaleString("fr-CA")} h</span>
                              {r.hold ? <span>{r.heldHours.toLocaleString("fr-CA")} h retenues ({money(r.heldPayCents)})</span> : <span>{money(r.payCents)}</span>}
                              {r.reminderSentAt ? <span>Relancé</span> : null}
                            </div>
                          </div>
                          <Pill tone={s.tone}>{s.label}</Pill>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p style={{ padding: "12px 20px", margin: 0, color: "var(--adm-text-3)", fontSize: "0.88rem" }}>Aucune activité assignée ces 3 dernières semaines. Assignez l'éducateur dans chaque pratique (Entraînements) pour suivre ses rapports.</p>
                )}
              </section>
            );
          })}

          {unmatchedContracts.length > 0 && (
            <section className="mda-card">
              <h2 className="mda-h2">Contrats sans fiche d'éducateur</h2>
              <p className="mda-sub">Créez leur fiche dans Entraîneurs (avec courriel et identifiant) pour pouvoir les assigner aux pratiques et suivre leurs rapports.</p>
              <ul style={{ margin: 0, paddingLeft: 18, color: "var(--adm-text-2)", fontSize: "0.9rem", lineHeight: 1.7 }}>
                {unmatchedContracts.map((k) => (
                  <li key={k.id}>
                    {k.employee_name} · {k.title} · {k.status === "signed" ? "signé" : "pas encore signé"}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(pastNoCoach.length > 0 || pastWithoutAssignment.length > 0) && (
            <section className="mda-card-flush">
              <div className="mda-card-head">
                <div>
                  <h2 className="mda-h2">Pratiques passées sans rapport possible · {pastNoCoach.length + pastWithoutAssignment.length}</h2>
                  <p className="mda-sub" style={{ margin: 0 }}>Aucune activité créée, ou aucun éducateur assigné : personne n'a pu remplir le rapport. Créez l'activité et assignez l'éducateur.</p>
                </div>
              </div>
              <ul className="mda-tasks">
                {[...pastWithoutAssignment, ...pastNoCoach]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .slice(0, 30)
                  .map((p) => (
                    <li key={p.key} className="mda-task" style={{ justifyContent: "space-between" }}>
                      <span className="mda-task-title">
                        {dayLabel(p.date)} · {p.start} · {p.group}
                      </span>
                      <Link href={p.activityId ? `/admin/entraineurs/activites/${p.activityId}` : "/admin/pratiques"} className="admin-btn-ghost" style={{ textDecoration: "none", padding: "6px 12px" }}>
                        {p.activityId ? "Assigner" : "Créer"}
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
