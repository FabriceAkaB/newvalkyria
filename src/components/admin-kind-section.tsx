import Link from "next/link";

import { NewKindProgram } from "@/components/admin-program-kind";
import { getProgramSatisfaction } from "@/lib/program-satisfaction-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Début de section « Camps de jour » ou « Parascolaire » (JP, 17 nov. 2026 ; plan des deux espaces, phase 4) :
 *  chaque camp ou groupe d'école est un programme à dates fixes (session_programs.program_kind), avec ses dates,
 *  ses inscrites, ses places et la satisfaction des parents ; la gestion se fait dans sa fiche. */

const fr = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export async function AdminKindSection({ kind, canCreate }: { kind: "camp" | "parascolaire"; canCreate: boolean }) {
  const db = getSupabaseAdminClient() as any;
  const { data: programs } = await db.from("session_programs").select("slug, name, published, active, max_capacity, price_cents, presentation, created_at").eq("program_kind", kind).order("created_at", { ascending: false });
  const list = (programs ?? []) as any[];
  const slugs = list.map((p) => p.slug);
  const [{ data: dates }, { data: regs }, sat] = await Promise.all([
    slugs.length ? db.from("session_program_dates").select("program_slug, session_date").in("program_slug", slugs) : Promise.resolve({ data: [] }),
    slugs.length ? db.from("session_program_registrations").select("program_slug, status").in("program_slug", slugs) : Promise.resolve({ data: [] }),
    getProgramSatisfaction().catch(() => ({ months: [], rows: [] }))
  ]);
  const label = kind === "camp" ? "camp" : "groupe parascolaire";
  return (
    <div className="admin-section mda">
      <header>
        <p className="mda-eyebrow">{kind === "camp" ? "Camps de jour, relâche et Fêtes" : "Programmes parascolaires dans les écoles"}</p>
        <h1 className="mda-h1">{list.length ? `${list.length} ${label}${list.length > 1 ? "s" : ""}` : kind === "camp" ? "Aucun camp pour l'instant" : "Aucun groupe parascolaire pour l'instant"}</h1>
        <p className="mda-lead">
          {kind === "camp"
            ? "Chaque semaine de camp est un programme à dates fixes : dates, prix, page, inscriptions, paiements et satisfaction au même endroit. Le plan : prévente aux familles en janvier, terrains réservés en mars, 1 adulte pour 10 campeurs."
            : "Chaque école est un programme à dates fixes : groupe, dates, inscriptions, présences et satisfaction par école. Le plan : contacter les écoles au printemps, une démo gratuite par école, lancement à l'automne 2027."}
        </p>
      </header>
      {canCreate ? <NewKindProgram kind={kind} /> : null}
      {list.length ? (
        <section className="mda-card-flush">
          <div className="admin-table-wrap" style={{ margin: 0, border: 0, boxShadow: "none" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{kind === "camp" ? "Camp" : "École et groupe"}</th>
                  <th>Dates</th>
                  <th style={{ textAlign: "right" }}>Inscrites</th>
                  <th style={{ textAlign: "right" }}>Parents /10</th>
                  <th>État</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const d = ((dates ?? []) as any[]).filter((x) => x.program_slug === p.slug).map((x) => String(x.session_date).slice(0, 10)).sort();
                  const paid = ((regs ?? []) as any[]).filter((x) => x.program_slug === p.slug && x.status === "paid").length;
                  const s = sat.rows.find((r) => r.key === `programme:${p.slug}`);
                  return (
                    <tr key={p.slug}>
                      <td>
                        {p.name}
                        {p.presentation?.school ? <span style={{ display: "block", color: "var(--adm-text-3)", fontSize: "0.8rem" }}>{p.presentation.school}</span> : null}
                      </td>
                      <td>{d.length ? `${fr(d[0])}${d.length > 1 ? ` au ${fr(d[d.length - 1])}` : ""} · ${d.length} jour${d.length > 1 ? "s" : ""}` : <span style={{ color: "var(--adm-text-3)" }}>à fixer</span>}</td>
                      <td style={{ textAlign: "right" }}>{paid}/{p.max_capacity ?? "—"}</td>
                      <td style={{ textAlign: "right" }}>{s?.parents.average ?? "—"}</td>
                      <td>{p.published ? "Publié" : "Brouillon"}</td>
                      <td><Link href={`/admin/programme/${p.slug}`} className="admin-btn-ghost" style={{ textDecoration: "none" }}>Gérer</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      <p className="mda-sub" style={{ margin: 0 }}>
        La satisfaction des jeunes et des parents de chaque {label} se suit dans Voix des familles → Satisfaction par programme ; un sondage de fin de {kind === "camp" ? "camp" : "session"} se crée dans Sondages.
      </p>
    </div>
  );
}
