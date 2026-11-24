import Link from "next/link";

import { TrialFunnelRow } from "@/components/admin-trial-funnel";
import { requireAdmin } from "@/lib/admin-auth";
import { getTrialFunnel } from "@/lib/acquisition-goals-repo";
import { OPEN_STAGES, STAGES, stageLabel, type FunnelRow } from "@/lib/trial-funnel";

export const metadata = { title: "Entonnoir des essais — Admin", robots: "noindex" };
export const dynamic = "force-dynamic";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

/** Entonnoir des essais sans perte (Mandalart P3.6.10) : qui appeler ou relancer aujourd'hui, puis chaque essai à son
 *  étape. Chaque bouton note l'étape dans le journal des relances (/admin/relances). Admin et gérante. */
export default async function TrialFunnelPage() {
  const role = await requireAdmin();
  const f = await getTrialFunnel();
  const planHref = (r: FunnelRow) =>
    r.table === "registrations" ? `/admin/saison/${f.seasonId}/essais` : r.table === "boys_trials" ? "/admin/inscriptions-garcons" : "/admin/sport-etudes";
  const open = f.rows.filter((r) => OPEN_STAGES.includes(r.stage));
  const results = f.rows.filter((r) => !OPEN_STAGES.includes(r.stage));
  const late = f.today.filter((r) => r.next?.late).length;
  const c24 = f.contact24h;
  const pct24 = c24.total ? Math.round((c24.within / c24.total) * 100) : null;

  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 1000 }}>
        <header>
          <p className="mda-eyebrow">Demande · contact en 24 h · essai · offre le lendemain · relances jour 3, 7 et 14 · inscrite ou liste chaude</p>
          <h1 className="mda-h1">
            {f.today.length ? `${plural(f.today.length, "famille")} à contacter ou relancer aujourd'hui` : "Personne à relancer aujourd'hui"}
          </h1>
          <p className="mda-lead">
            L&apos;essai est le moment qui fait signer. Chaque bouton note ce qui a été fait dans les relances : la prochaine étape apparaît toute seule, à sa date.
          </p>
        </header>

        <section className="mda-cols-4">
          <div className="mda-card" style={late ? { boxShadow: "inset 3px 0 0 var(--adm-bad)" } : undefined}>
            <p className="mda-num" style={{ color: late ? "var(--adm-bad)" : undefined }}>{late}</p>
            <p className="mda-label">En retard (demande sans réponse après 24 h, offre ou relance pas faite)</p>
          </div>
          <div className="mda-card">
            <p className="mda-num" style={{ color: pct24 !== null && pct24 >= 90 ? "var(--adm-good)" : undefined }}>{pct24 === null ? "—" : `${pct24} %`}</p>
            <p className="mda-label">Demandes contactées en moins de 24 h ({c24.within} sur {c24.total}, 30 derniers jours) · cible 100 %</p>
          </div>
          <div className="mda-card">
            <p className="mda-num">{open.length}</p>
            <p className="mda-label">Essais en cours, de la demande aux relances</p>
          </div>
          <div className="mda-card">
            <p className="mda-num">
              {f.counts.inscrite} <span className="mda-muted" style={{ fontSize: "1rem", fontWeight: 500 }}>· {f.counts["liste-chaude"]} en liste chaude</span>
            </p>
            <p className="mda-label">Inscrites (45 derniers jours)</p>
          </div>
        </section>

        <section className="mda-card-flush" id="aujourdhui">
          <div className="mda-card-head">
            <div>
              <h2 className="mda-h2">À faire aujourd&apos;hui</h2>
              <p className="mda-sub" style={{ margin: 0 }}>Les nouvelles demandes d&apos;abord (appel ou texto), puis ce qui est en retard. Notez-le dès que c&apos;est fait.</p>
            </div>
          </div>
          {f.today.length ? (
            <ul className="mda-tasks">
              {f.today.map((r) => (
                <TrialFunnelRow key={r.ref} row={r} planHref={planHref(r)} showStage={stageLabel(r.stage)} />
              ))}
            </ul>
          ) : (
            <p style={{ padding: "16px 20px", margin: 0, color: "var(--adm-text-3)" }}>Rien d&apos;autre aujourd&apos;hui : toutes les demandes ont une réponse et les relances sont à jour.</p>
          )}
        </section>

        <section className="mda-card">
          <h2 className="mda-h2">L&apos;entonnoir</h2>
          <div className="mda-scroll">
            <div style={{ display: "flex", gap: 8, minWidth: 640, marginTop: 8 }}>
              {STAGES.map((s) => (
                <a
                  key={s.id}
                  href={`#etape-${s.id}`}
                  style={{
                    flex: 1,
                    textDecoration: "none",
                    borderRadius: 10,
                    padding: "10px 12px",
                    background: OPEN_STAGES.includes(s.id) ? "var(--adm-surface-2)" : "transparent",
                    border: "1px solid var(--adm-line)",
                    opacity: f.counts[s.id] ? 1 : 0.55
                  }}
                >
                  <span className="mda-num" style={{ fontSize: "1.25rem", display: "block" }}>{f.counts[s.id]}</span>
                  <span style={{ fontSize: "0.78rem", color: "var(--adm-text-2)" }}>{s.label}</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {STAGES.filter((s) => f.counts[s.id] && OPEN_STAGES.includes(s.id)).map((s) => (
          <section key={s.id} className="mda-card-flush" id={`etape-${s.id}`}>
            <div className="mda-card-head">
              <div>
                <h2 className="mda-h2">
                  {s.label} <span className="mda-muted" style={{ fontWeight: 500 }}>· {f.counts[s.id]}</span>
                </h2>
                <p className="mda-sub" style={{ margin: 0 }}>{s.help}</p>
              </div>
            </div>
            <ul className="mda-tasks">
              {open.filter((r) => r.stage === s.id).map((r) => (
                <TrialFunnelRow key={r.ref} row={r} planHref={planHref(r)} />
              ))}
            </ul>
          </section>
        ))}

        {results.length ? (
          <details className="mda-card-flush" id="etape-inscrite">
            <summary style={{ padding: "14px 20px", cursor: "pointer", minHeight: 44 }}>
              <span className="mda-h2" style={{ display: "inline" }}>Résultats</span>
              <span className="mda-muted"> · {f.counts.inscrite} inscrite{f.counts.inscrite > 1 ? "s" : ""}, {f.counts["liste-chaude"]} en liste chaude, {f.counts.perdue} fermé{f.counts.perdue > 1 ? "s" : ""}</span>
            </summary>
            <ul className="mda-tasks" style={{ borderTop: "1px solid var(--adm-line)" }} id="etape-liste-chaude">
              {results.map((r) => (
                <TrialFunnelRow key={r.ref} row={r} planHref={null} showStage={stageLabel(r.stage)} />
              ))}
            </ul>
          </details>
        ) : null}
        <p id="etape-perdue" style={{ fontSize: "0.85rem", color: "var(--adm-text-3)", margin: 0 }}>
          La liste chaude reçoit un courriel de valeur chaque semaine jusqu&apos;au camp ou à la saison suivante (P3.6.06).
          {role === "admin" ? (
            <>
              {" "}Tout l&apos;historique des échanges : <Link href="/admin/relances" style={{ color: "var(--adm-accent)" }}>Relances et suivi</Link>.
            </>
          ) : null}{" "}
          Les objectifs de la semaine :{" "}
          <Link href="/admin/acquisition#objectifs" style={{ color: "var(--adm-accent)" }}>D&apos;où viennent nos familles</Link>.
        </p>
      </div>
    </div>
  );
}
