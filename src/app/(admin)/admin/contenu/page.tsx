import Link from "next/link";

import { requireAdmin } from "@/lib/admin-auth";
import { postKindLabel } from "@/lib/content-core";
import { hm, shortDate, slotLabel } from "@/lib/content-format";
import { getContentDashboard } from "@/lib/content-repo";
import { fmtInt } from "@/lib/marketing-posts-core";

export const metadata = { title: "Création de contenu — Cette semaine", robots: "noindex" };
export const dynamic = "force-dynamic";

const tone = (done: number, target: number) => (target === 0 ? "var(--adm-text-3)" : done >= target ? "var(--adm-good)" : done > 0 ? "var(--adm-warn)" : "var(--adm-bad, #d9534f)");

/** Espace Contenu › Cette semaine : les quotas de la personne caméra, ce qu'il reste à capter, les entrevues,
 *  ce qui se publie dans les 14 prochains jours, la portée et les tâches du plan. */
export default async function ContenuPage() {
  const role = await requireAdmin();
  const d = await getContentDashboard();
  const toCapture = d.practices.filter((p) => (p.gym || p.type === "Match") && !p.captured);

  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 1100 }}>
        <header>
          <p className="mda-eyebrow">
            Semaine du {shortDate(d.week.from)} au {shortDate(d.week.to)}
          </p>
          <h1 className="mda-h1">Création de contenu</h1>
          <p className="mda-lead">
            Le coach coache, la personne caméra filme au maximum. Tout ce qu&apos;on capte (ball mastery à 360°, photos de match, pratiques Veo, entrevues) devient de la preuve pour
            les familles et du contenu pour nos réseaux.
          </p>
        </header>

        <section className="admin-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {d.quotas.map((q) => (
            <div key={q.key} className="admin-stat-card" title={q.help}>
              <p className="admin-stat-label">{q.label}</p>
              <p className="admin-stat-value" style={{ color: tone(q.done, q.target) }}>
                {q.done}
                <span style={{ fontSize: "0.6em", color: "var(--adm-text-3)" }}> / {q.target}</span>
              </p>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--adm-text-3)" }}>{q.help}</p>
            </div>
          ))}
        </section>

        <section className="mda-card">
          <h2 className="mda-h2" style={{ marginTop: 0 }}>🎥 À capter cette semaine ({toCapture.length})</h2>
          {toCapture.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, fontSize: "0.9rem" }}>
              {toCapture.map((p) => (
                <li key={p.activityId}>
                  {shortDate(p.date)} {hm(p.start)} · {p.title} · {p.type === "Match" ? "photos des joueuses" : "ball mastery à 360°"}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, color: "var(--adm-text-2)" }}>Tout ce qui était prévu cette semaine est capté.</p>
          )}
          <p style={{ margin: "10px 0 0" }}>
            <Link href="/admin/contenu/captation">Cocher et coller les liens →</Link>
          </p>
        </section>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))" }}>
          <section className="mda-card">
            <h2 className="mda-h2" style={{ marginTop: 0 }}>🎙️ Entrevues avant/après</h2>
            <p style={{ margin: "0 0 8px", fontSize: "0.95rem" }}>
              <strong>{d.interviews.filmed}</strong> filmées sur {d.interviews.goal} · {d.interviews.confirmed} avec une heure · {d.interviews.invited} invitées sans réponse
            </p>
            <p style={{ margin: "0 0 10px", fontSize: "0.85rem", color: "var(--adm-text-2)" }}>Rythme à tenir : {d.interviews.perWeek} par semaine jusqu&apos;à la fin de la saison.</p>
            {d.nextSlots.length ? (
              <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, fontSize: "0.88rem" }}>
                {d.nextSlots.map((s) => (
                  <li key={s.id}>
                    {slotLabel(s)} — {s.booked.length} inscrite{s.booked.length > 1 ? "s" : ""}, {s.remaining} place{s.remaining > 1 ? "s" : ""}
                    {s.booked.length ? <div style={{ fontSize: "0.78rem", color: "var(--adm-text-3)" }}>{s.booked.join(", ")}</div> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, color: "var(--adm-text-2)", fontSize: "0.88rem" }}>Aucune journée d&apos;entrevues prévue.</p>
            )}
            <p style={{ margin: "10px 0 0" }}>
              <Link href="/admin/contenu/entrevues">Gérer les entrevues →</Link>
            </p>
          </section>

          <section className="mda-card">
            <h2 className="mda-h2" style={{ marginTop: 0 }}>📅 À publier (14 prochains jours)</h2>
            {d.calendar.filter((c) => c.kind === "prevu").length ? (
              <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, fontSize: "0.88rem" }}>
                {d.calendar
                  .filter((c) => c.kind === "prevu")
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((c, i) => (
                    <li key={i}>
                      {shortDate(c.date)} · {c.title} · {postKindLabel(c.postKind)}
                      {c.angle ? ` · ${c.angle}` : ""}
                    </li>
                  ))}
              </ul>
            ) : (
              <p style={{ margin: 0, color: "var(--adm-text-2)", fontSize: "0.88rem" }}>Rien de planifié. Le calendrier doit être tenu chaque semaine (P3.2.06).</p>
            )}
            <p style={{ margin: "10px 0 0" }}>
              <Link href="/admin/contenu/calendrier">Ouvrir le calendrier →</Link>
            </p>
          </section>

          <section className="mda-card">
            <h2 className="mda-h2" style={{ marginTop: 0 }}>📈 Portée (30 derniers jours)</h2>
            <p style={{ margin: "0 0 8px", fontSize: "0.95rem" }}>
              <strong>{fmtInt(d.reach.views30)}</strong> vues · {d.reach.posts30} publication{d.reach.posts30 > 1 ? "s" : ""}
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, fontSize: "0.88rem" }}>
              {d.reach.followers.map((f) => (
                <li key={f.network}>
                  {f.network} : {f.followers === null ? "pas encore de relevé" : `${fmtInt(f.followers)} abonnés`}
                  {f.gained30 !== null ? ` (${f.gained30 >= 0 ? "+" : ""}${f.gained30} en 30 jours)` : ""}
                </li>
              ))}
            </ul>
            <p style={{ margin: "10px 0 0", fontSize: "0.82rem", color: "var(--adm-text-3)" }}>
              Les chiffres s&apos;entrent pour l&apos;instant à la main{role === "admin" ? <> dans <Link href="/admin/reseaux">Réseaux sociaux</Link></> : null} ; la connexion directe à Instagram, Facebook et YouTube est décrite dans le calendrier.
            </p>
          </section>
        </div>

        <section className="mda-card">
          <h2 className="mda-h2" style={{ marginTop: 0 }}>🗺️ Le plan (Mandalart) : tâches de contenu ouvertes</h2>
          {d.tasks.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, fontSize: "0.88rem" }}>
              {d.tasks.map((t) => (
                <li key={t.code} style={{ color: t.overdue ? "var(--adm-bad, #d9534f)" : "var(--adm-text)" }}>
                  <strong>{t.code}</strong> {t.title} <span style={{ color: "var(--adm-text-3)" }}>· {t.due ? shortDate(t.due) : "sans date"} · {t.owner ?? "à attribuer"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, color: "var(--adm-text-2)" }}>Aucune tâche ouverte.</p>
          )}
          <p style={{ margin: "10px 0 0", fontSize: "0.82rem", color: "var(--adm-text-3)" }}>
            La recherche et les missions de l&apos;agent contenu (A05 : plan de captation, brouillons de légendes, projet entrevues) sont décrites dans le cahier des agents.
          </p>
        </section>
      </div>
    </div>
  );
}
