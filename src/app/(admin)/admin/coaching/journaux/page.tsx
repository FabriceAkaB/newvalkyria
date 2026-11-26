import Link from "next/link";

import { AdminTopbar } from "@/components/admin-topbar";
import { Pill } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { getCoaches } from "@/lib/coaches-repo";
import { JOURNAL_FIELDS, EXERCISE_OUTCOMES } from "@/lib/practice-journal";
import { listJournals } from "@/lib/practice-debriefs-repo";
import { journalOutcome, PLANNED_EXERCISES_RULE_START, type BlockAnswer } from "@/lib/planned-exercises";
import { listPlannedPractices } from "@/lib/planned-exercises-repo";

export const metadata = { title: "Rapports journaliers — Coaching", robots: "noindex" };
export const dynamic = "force-dynamic";

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const fr = (iso?: string) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }) : "");
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** « Qu'est-ce qui s'est vraiment passé à chaque pratique ? » Les rapports journaliers des coachs (déroulement, exercices,
 *  temps, transitions, répétitions, consignes, comportements, difficultés, sondages et présences, matériel), avec leurs
 *  réussites et améliorations, par date, groupe et coach. Ce n'est pas l'évaluation professionnelle des coachs. */
export default async function JournalsPage({ searchParams }: { searchParams: Promise<{ du?: string; au?: string; coach?: string; groupe?: string }> }) {
  await requireAdmin({ roles: ["admin", "gerante"] });
  const sp = await searchParams;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const to = sp.au && ISO.test(sp.au) ? sp.au : today;
  const from = sp.du && ISO.test(sp.du) ? sp.du : addDays(to, -14);
  const [rows, coaches, plannedAll] = await Promise.all([listJournals({ from, to, coachId: sp.coach || null, group: sp.groupe || null }), getCoaches(), listPlannedPractices({ from, to }).catch(() => [])]);
  // « Exercices prévus : faits ? » : la réponse partagée de chaque bloc, par pratique (JP, 26 nov. 2026).
  const planned = plannedAll.filter((p) => !sp.groupe || p.group === sp.groupe);
  const answersOf = new Map(plannedAll.map((p) => [p.activityId, new Map<string, BlockAnswer>(p.view.blocks.map((b) => [b.id, b.answer]))]));
  const all = rows;
  const groups = [...new Set((await listJournals({ from, to })).map((r) => r.group))].sort();
  const scaleFields = JOURNAL_FIELDS.filter((f) => f.kind === "scale");
  const textFields = JOURNAL_FIELDS.filter((f) => f.kind === "text");

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Espace coaching · mémoire des pratiques</p>
            <h1 className="mda-h1">{all.length} rapport{all.length > 1 ? "s" : ""} journalier{all.length > 1 ? "s" : ""}</h1>
            <p className="mda-lead">Ce que les coachs notent au fil de chaque pratique, du {fr(from)} au {fr(to)}. Ce rapport décrit la pratique ; l&apos;évaluation professionnelle des coachs reste dans Suivi des éducateurs.</p>
          </header>

          <form className="mda-card" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
            <label style={{ display: "grid", gap: 4, fontSize: "0.85rem", color: "var(--adm-text-2)" }}>Du<input className="admin-input" type="date" name="du" defaultValue={from} /></label>
            <label style={{ display: "grid", gap: 4, fontSize: "0.85rem", color: "var(--adm-text-2)" }}>Au<input className="admin-input" type="date" name="au" defaultValue={to} /></label>
            <label style={{ display: "grid", gap: 4, fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
              Groupe
              <select className="admin-input" name="groupe" defaultValue={sp.groupe ?? ""}>
                <option value="">Tous</option>
                {groups.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
              Coach
              <select className="admin-input" name="coach" defaultValue={sp.coach ?? ""}>
                <option value="">Tous</option>
                {coaches.filter((c) => c.status === "active").map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </label>
            <button type="submit" className="admin-btn-primary">Afficher</button>
          </form>

          <section className="mda-card-flush">
            <div className="mda-card-head">
              <div>
                <h2 className="mda-h2" style={{ textTransform: "none", margin: 0 }}>Exercices prévus : faits ou non, par pratique</h2>
                <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
                  La réponse des éducateurs dans leur rapport (une par bloc du plan, la même pour tous). Obligatoire dans le rapport depuis le {fr(PLANNED_EXERCISES_RULE_START)}.
                </p>
              </div>
            </div>
            <div style={{ padding: "6px 20px 14px", display: "grid" }}>
              {planned.length === 0 ? (
                <p style={{ margin: "8px 0 0", color: "var(--adm-text-2)" }}>Aucune pratique avec un plan pour cette période.</p>
              ) : (
                planned.map((p, i) => (
                  <div key={p.activityId} style={{ display: "grid", gap: 6, padding: "10px 0", borderTop: i ? "1px solid var(--adm-border)" : "none" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap" }}>
                      <Link href={`/admin/entraineurs/activites/${p.activityId}`} style={{ color: "var(--adm-text)", fontWeight: 600, textDecoration: "none" }}>
                        {p.group} <span style={{ fontWeight: 400, color: "var(--adm-text-2)", textTransform: "capitalize" }}>· {fr(p.date)} · {p.start.replace(":", " h ")}</span>
                      </Link>
                      <Pill tone={p.view.summary.complete ? (p.view.summary.notDone ? "warn" : "good") : p.date >= PLANNED_EXERCISES_RULE_START && p.date < today ? "bad" : undefined}>
                        {p.view.summary.done} fait{p.view.summary.done > 1 ? "s" : ""} · {p.view.summary.notDone} pas fait{p.view.summary.notDone > 1 ? "s" : ""}
                        {p.view.summary.complete ? "" : ` · ${p.view.summary.total - p.view.summary.answered} sans réponse`}
                      </Pill>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {p.view.blocks.map((b) => (
                        <Pill key={b.id} tone={b.answer === "oui" ? "good" : b.answer === "non" ? "warn" : undefined}>
                          {b.answer === "oui" ? "Fait" : b.answer === "non" ? "Pas fait" : "Sans réponse"} : {b.title}
                        </Pill>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {all.length === 0 ? (
            <div className="mda-card"><p style={{ margin: 0, color: "var(--adm-text-2)" }}>Aucun rapport pour cette période. Les coachs le remplissent dans leur portail, étapes « Pendant » et « Après » de chaque pratique.</p></div>
          ) : (
            all.map((r) => {
              const shared = answersOf.get(r.activityId);
              const ex = [...new Set([...Object.keys(r.journal.exercices ?? {}), ...(shared?.keys() ?? [])])]
                .map((id) => journalOutcome(shared?.get(id) ?? null, r.journal.exercices?.[id]))
                .filter(Boolean);
              return (
                <section key={r.id} className="mda-card-flush">
                  <div className="mda-card-head">
                    <div>
                      <h2 className="mda-h2" style={{ textTransform: "none", margin: 0 }}>{r.group}</h2>
                      <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "var(--adm-text-2)", textTransform: "capitalize" }}>{fr(r.date)} · {r.startTime.replace(":", " h ")} · {r.coachName}</p>
                    </div>
                    <Link href={`/admin/entraineurs/activites/${r.activityId}`} className="admin-btn-ghost" style={{ textDecoration: "none" }}>Voir la pratique</Link>
                  </div>
                  <div style={{ padding: "14px 20px", display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {scaleFields.map((f) => {
                        const v = r.journal[f.key];
                        return typeof v === "number" ? <Pill key={f.key} tone={v >= 4 ? "good" : v <= 2 ? "bad" : "warn"}>{f.label} : {v}/5</Pill> : null;
                      })}
                      {ex.length ? <Pill>{EXERCISE_OUTCOMES.map((o) => `${ex.filter((x) => x === o.value).length} ${o.label.toLowerCase()}`).join(" · ")}</Pill> : null}
                    </div>
                    {scaleFields.map((f) => (r.journal[`${f.key}_note`] ? <p key={`${f.key}-n`} style={{ margin: 0, color: "var(--adm-text)" }}><strong style={{ color: "var(--adm-text-2)" }}>{f.label} :</strong> {String(r.journal[`${f.key}_note`])}</p> : null))}
                    {textFields.map((f) => (r.journal[f.key] ? <p key={f.key} style={{ margin: 0, color: "var(--adm-text)", whiteSpace: "pre-line" }}><strong style={{ color: "var(--adm-text-2)" }}>{f.label} :</strong> {String(r.journal[f.key])}</p> : null))}
                    {r.wentWell ? <p style={{ margin: 0, color: "var(--adm-text)", whiteSpace: "pre-line" }}><strong style={{ color: "var(--adm-good)" }}>Réussites :</strong> {r.wentWell}</p> : null}
                    {r.toImprove ? <p style={{ margin: 0, color: "var(--adm-text)", whiteSpace: "pre-line" }}><strong style={{ color: "var(--adm-warn)" }}>Améliorations :</strong> {r.toImprove}</p> : null}
                    {r.nextTime ? <p style={{ margin: 0, color: "var(--adm-text)", whiteSpace: "pre-line" }}><strong style={{ color: "var(--adm-text-2)" }}>On change la prochaine fois :</strong> {r.nextTime}</p> : null}
                  </div>
                </section>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
