import Link from "next/link";

import { AdminTopbar } from "@/components/admin-topbar";
import { Pill } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { getCoaches } from "@/lib/coaches-repo";
import { JOURNAL_FIELDS, EXERCISE_OUTCOMES } from "@/lib/practice-journal";
import { listJournals } from "@/lib/practice-debriefs-repo";

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
  const [rows, coaches] = await Promise.all([listJournals({ from, to, coachId: sp.coach || null, group: sp.groupe || null }), getCoaches()]);
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

          {all.length === 0 ? (
            <div className="mda-card"><p style={{ margin: 0, color: "var(--adm-text-2)" }}>Aucun rapport pour cette période. Les coachs le remplissent dans leur portail, étapes « Pendant » et « Après » de chaque pratique.</p></div>
          ) : (
            all.map((r) => {
              const ex = Object.values(r.journal.exercices ?? {});
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
