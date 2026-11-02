import Link from "next/link";

import { AdminTopbar } from "@/components/admin-topbar";
import { Pill } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { getCoachingWeek } from "@/lib/coaching-repo";
import type { Practice, Readiness } from "@/lib/practices-repo";

export const metadata = { title: "Coaching — cette semaine", robots: "noindex" };
export const dynamic = "force-dynamic";

const DAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
const fr = (n: number | null) => (n === null ? "—" : n.toLocaleString("fr-CA", { maximumFractionDigits: 1 }));
const READY: Record<Readiness, { tone?: "good" | "warn" | "bad" | "info"; label: string }> = {
  prete: { tone: "good", label: "Prête" },
  rouge: { tone: "bad", label: "À préparer d'urgence" },
  jaune: { tone: "warn", label: "À préparer" },
  vert: { tone: "info", label: "À préparer" },
  "plus-tard": { label: "Plus tard" },
  passee: { label: "Passée" }
};

function PracticeRow({ p }: { p: Practice }) {
  const r = READY[p.readiness];
  return (
    <li className="mda-task" style={{ alignItems: "center" }}>
      <div className="mda-task-body">
        <p className="mda-task-title" style={{ fontWeight: 600 }}>
          {dayLabel(p.date)} · {p.start.replace(":", " h ")} · {p.group}
        </p>
        <div className="mda-task-meta">
          <span>{p.location}</span>
          {p.theme ? <span>Thème : {p.theme}</span> : null}
          {p.blocks ? <span>{p.blocks} bloc{p.blocks > 1 ? "s" : ""}</span> : null}
        </div>
      </div>
      <Pill tone={r.tone}>{r.label}</Pill>
      {p.activityId ? (
        <Link href={`/admin/entraineurs/activites/${p.activityId}`} className="admin-btn-ghost" style={{ padding: "6px 12px", textDecoration: "none", whiteSpace: "nowrap" }}>
          {p.blocks ? "Voir le plan" : "Préparer"}
        </Link>
      ) : (
        <Link href="/admin/pratiques" className="admin-btn-ghost" style={{ padding: "6px 12px", textDecoration: "none", whiteSpace: "nowrap" }}>
          Préparer
        </Link>
      )}
    </li>
  );
}

/** Espace coaching : « Qu'est-ce qui se passe sur le terrain cette semaine, et qui a besoin d'attention ? »
 *  Seulement le foot, aucun montant (l'argent reste dans l'espace Académie). */
export default async function CoachingWeekPage() {
  await requireAdmin();
  const w = await getCoachingWeek();
  const academy = w.practices.filter((p) => !p.organization);
  const ready = academy.filter((p) => p.readiness === "prete").length;
  const toPrepare = academy.length - ready;

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Espace coaching · les 7 prochains jours</p>
            <h1 className="mda-h1">
              {academy.length === 0
                ? "Aucune pratique dans les 7 prochains jours"
                : toPrepare
                  ? `${toPrepare} pratique${toPrepare > 1 ? "s" : ""} sur ${academy.length} à préparer cette semaine`
                  : `Les ${academy.length} pratiques de la semaine sont prêtes`}
            </h1>
            <p className="mda-lead">{w.theme ? `Thème de la semaine : ${w.theme}.` : "Aucun thème entré pour cette semaine (Pratiques → Thèmes)."} Ici on ne parle que de foot : les pratiques, les exercices et la progression de chaque fille.</p>
          </header>

          <section className="mda-cols-4">
            <div className="mda-card">
              <p className="mda-num" style={{ color: toPrepare ? "var(--adm-warn)" : "var(--adm-good)" }}>
                {ready}/{academy.length}
              </p>
              <p className="mda-label">Pratiques prêtes cette semaine</p>
            </div>
            <div className="mda-card">
              <p className="mda-num">{w.feedback?.rating !== null && w.feedback ? `${fr(w.feedback.rating)}/10` : "—"}</p>
              <p className="mda-label">{w.feedback ? `Note des joueuses (sem. du ${dayLabel(w.feedback.weekStart)}) · fatigue ${fr(w.feedback.fatigue)}/10` : "Note des joueuses : pas encore de routine de fin"}</p>
            </div>
            <div className="mda-card">
              <p className="mda-num" style={{ color: w.reportsMissing.length ? "var(--adm-warn)" : undefined }}>{w.reportsMissing.length}</p>
              <p className="mda-label">Rapports d&apos;éducateurs à compléter</p>
            </div>
            <div className="mda-card">
              <p className="mda-num">
                {w.bank.approuve}
                <span style={{ fontSize: "0.9rem", color: "var(--adm-text-3)" }}>/{w.bank.total}</span>
              </p>
              <p className="mda-label">Exercices approuvés{w.bank.aValider ? ` · ${w.bank.aValider} à valider` : ""}</p>
            </div>
          </section>

          <section className="mda-card-flush">
            <div className="mda-card-head">
              <h2 className="mda-h2">Pratiques de la semaine</h2>
              <Link href="/admin/pratiques" className="admin-btn-ghost" style={{ textDecoration: "none" }}>Toutes les pratiques</Link>
            </div>
            {academy.length === 0 ? (
              <p className="admin-empty-text" style={{ padding: "0 20px 20px" }}>Rien au calendrier dans les 7 prochains jours.</p>
            ) : (
              <ul className="mda-tasks">
                {academy.map((p) => (
                  <PracticeRow key={p.key} p={p} />
                ))}
              </ul>
            )}
          </section>

          <section className="mda-card-flush">
            <div className="mda-card-head">
              <h2 className="mda-h2">Joueuses à suivre de près</h2>
              <Link href="/admin/coaching/joueuses" className="admin-btn-ghost" style={{ textDecoration: "none" }}>Progression de toutes</Link>
            </div>
            {w.toWatch.length === 0 ? (
              <p className="admin-empty-text" style={{ padding: "0 20px 20px" }}>Rien à signaler : aucune attitude basse, baisse nette ou grosse fatigue dans les dernières évaluations.</p>
            ) : (
              <ul className="mda-tasks">
                {w.toWatch.map((p) => (
                  <li key={p.registrationId} className="mda-task" style={{ alignItems: "center" }}>
                    <div className="mda-task-body">
                      <p className="mda-task-title" style={{ fontWeight: 600 }}>{p.name}</p>
                      <div className="mda-task-meta">
                        <span>{p.group}</span>
                        {p.watch.map((x) => (
                          <span key={x} style={{ color: "var(--adm-warn)" }}>{x}</span>
                        ))}
                      </div>
                    </div>
                    <Link href={`/admin/coaching/joueuses/${p.registrationId}`} className="admin-btn-ghost" style={{ padding: "6px 12px", textDecoration: "none", whiteSpace: "nowrap" }}>
                      Voir sa saison
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mda-card-flush">
            <div className="mda-card-head">
              <h2 className="mda-h2">Rapports des éducateurs à compléter</h2>
              <Link href="/admin/entraineurs/suivi" className="admin-btn-ghost" style={{ textDecoration: "none" }}>Suivi des éducateurs</Link>
            </div>
            {w.reportsMissing.length === 0 ? (
              <p className="admin-empty-text" style={{ padding: "0 20px 20px" }}>Chaque pratique terminée a son rapport : présences, évaluations et présence de l&apos;éducateur.</p>
            ) : (
              <ul className="mda-tasks">
                {w.reportsMissing.map((r) => (
                  <li key={`${r.activityId}-${r.coach}`} className="mda-task" style={{ alignItems: "center" }}>
                    <div className="mda-task-body">
                      <p className="mda-task-title" style={{ fontWeight: 600 }}>
                        {r.coach} · {dayLabel(r.date)} {r.start}
                      </p>
                      <div className="mda-task-meta">
                        <span>{r.label}</span>
                        <span style={{ color: "var(--adm-warn)" }}>{r.detail}</span>
                      </div>
                    </div>
                    <Link href={`/admin/entraineurs/activites/${r.activityId}`} className="admin-btn-ghost" style={{ padding: "6px 12px", textDecoration: "none", whiteSpace: "nowrap" }}>
                      Voir le rapport
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {(w.bank.aTester > 0 || w.bank.aChanger > 0 || w.bank.aValider > 0) && (
            <section className="mda-card">
              <h2 className="mda-h2" style={{ marginBottom: 8 }}>Banque d&apos;exercices</h2>
              <p className="mda-lead" style={{ margin: 0 }}>
                {[w.bank.aTester ? `${w.bank.aTester} à tester en séance` : null, w.bank.aValider ? `${w.bank.aValider} à valider par JP` : null, w.bank.aChanger ? `${w.bank.aChanger} à changer (note sous 8)` : null]
                  .filter(Boolean)
                  .join(" · ")}
                {" · "}
                <Link href="/admin/exercices">Ouvrir la banque</Link>
              </p>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
