import Link from "next/link";

import { AdminTopbar } from "@/components/admin-topbar";
import { Pill } from "@/components/mandalart/ui";
import { ExternalPracticeForm, PrepareButton } from "@/components/practices-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { listPractices, summarize, type Practice, type Readiness } from "@/lib/practices-repo";

export const metadata = { title: "Pratiques — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

const TONE: Record<Readiness, { tone?: "good" | "warn" | "bad" | "info"; label: string; color: string }> = {
  prete: { tone: "good", label: "Prête", color: "var(--adm-good)" },
  rouge: { tone: "bad", label: "Rouge", color: "var(--adm-bad)" },
  jaune: { tone: "warn", label: "Jaune", color: "var(--adm-warn)" },
  vert: { tone: "info", label: "À préparer", color: "var(--adm-info)" },
  "plus-tard": { label: "Plus tard", color: "var(--adm-text-3)" },
  passee: { label: "Passée", color: "var(--adm-text-3)" }
};
const DAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
const weekStart = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
};

function Row({ p }: { p: Practice }) {
  const t = TONE[p.readiness];
  return (
    <li className="mda-task" style={{ alignItems: "center", boxShadow: p.readiness === "rouge" ? "inset 3px 0 0 var(--adm-bad)" : p.readiness === "jaune" ? "inset 3px 0 0 var(--adm-warn)" : undefined }}>
      <span className="mda-dot" style={{ background: t.color, width: 10, height: 10 }} aria-hidden />
      <div className="mda-task-body">
        <p className="mda-task-title" style={{ fontWeight: 600 }}>
          {dayLabel(p.date)} · {p.start.replace(":", " h ")} · {p.group}
          {p.organization ? <span className="mda-muted" style={{ fontWeight: 400 }}> · {p.organization}</span> : null}
        </p>
        <div className="mda-task-meta">
          <span>{p.location}</span>
          {p.activityType !== "Pratique" ? <span>{p.activityType}</span> : null}
          {p.theme ? <span>Thème : {p.theme}</span> : null}
          {p.blocks ? <span style={{ color: "var(--adm-good)" }}>{p.blocks} bloc{p.blocks > 1 ? "s" : ""}{p.preparedDaysAhead !== null ? ` · prête ${p.preparedDaysAhead} j d'avance` : ""}</span> : null}
          {p.readiness !== "prete" && p.readiness !== "passee" ? <span style={{ color: t.color }}>{p.daysLeft === 0 ? "aujourd'hui" : `dans ${p.daysLeft} jour${p.daysLeft > 1 ? "s" : ""}`}</span> : null}
        </div>
      </div>
      {p.activityId ? (
        <Link href={`/admin/entraineurs/activites/${p.activityId}`} className={p.blocks ? "admin-btn-ghost" : "admin-btn-primary"} style={{ padding: "6px 12px", textDecoration: "none", whiteSpace: "nowrap" }}>
          {p.blocks ? "Voir le plan" : "Préparer"}
        </Link>
      ) : p.readiness !== "passee" ? (
        <PrepareButton practice={{ date: p.date, start: p.start, end: p.end, location: p.location, group: p.group, organization: p.organization }} />
      ) : null}
    </li>
  );
}

/** « Mes prochaines pratiques sont-elles prêtes, deux semaines d'avance ? » */
export default async function PracticesPage() {
  await requireAdmin();
  const all = await listPractices();
  const s = summarize(all);
  const upcoming = all.filter((p) => p.daysLeft >= 0);
  const academy = upcoming.filter((p) => !p.organization);
  const external = upcoming.filter((p) => p.organization);
  const weeks = [...new Set(academy.map((p) => weekStart(p.date)))];
  const urgent = s.rouge + s.jaune;

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda">
          <header>
            <p className="mda-eyebrow">Règle : chaque pratique est prête 2 semaines d'avance</p>
            <h1 className="mda-h1">{urgent ? `${urgent} pratique${urgent > 1 ? "s" : ""} à préparer en priorité` : s.vert ? `${s.vert} pratique${s.vert > 1 ? "s" : ""} à préparer cette semaine` : "Toutes les pratiques des 2 prochaines semaines sont prêtes"}</h1>
            <p className="mda-lead">Vert : il reste 8 à 14 jours. Jaune : 4 à 7 jours. Rouge : 3 jours ou moins (rappel 2 fois par jour). « Préparer » ouvre le plan de séance : thème, blocs, exercices de la banque.</p>
          </header>

          <section className="mda-cols-4">
            <div className="mda-card" style={s.rouge ? { boxShadow: "inset 3px 0 0 var(--adm-bad)" } : undefined}>
              <p className="mda-num" style={{ color: s.rouge ? "var(--adm-bad)" : undefined }}>{s.rouge}</p>
              <p className="mda-label">Rouges (3 jours ou moins)</p>
            </div>
            <div className="mda-card">
              <p className="mda-num" style={{ color: s.jaune ? "var(--adm-warn)" : undefined }}>{s.jaune}</p>
              <p className="mda-label">Jaunes (1 semaine)</p>
            </div>
            <div className="mda-card">
              <p className="mda-num">{s.vert}</p>
              <p className="mda-label">À préparer (2 semaines)</p>
            </div>
            <div className="mda-card">
              <p className="mda-num" style={{ color: "var(--adm-good)" }}>{s.prete}</p>
              <p className="mda-label">Prêtes{s.preparedPast ? ` · ${Math.round((s.preparedTwoWeeks / s.preparedPast) * 100)} % des passées prêtes 2 sem. d'avance` : ""}</p>
            </div>
          </section>

          {weeks.map((w) => {
            const list = academy.filter((p) => weekStart(p.date) === w);
            const ready = list.filter((p) => p.readiness === "prete").length;
            return (
              <section key={w} className="mda-card-flush">
                <div className="mda-card-head">
                  <h2 className="mda-h2">Semaine du {dayLabel(w)}</h2>
                  <Pill tone={ready === list.length ? "good" : undefined}>
                    {ready}/{list.length} prêtes
                  </Pill>
                </div>
                <ul className="mda-tasks">
                  {list.map((p) => (
                    <Row key={p.key} p={p} />
                  ))}
                </ul>
              </section>
            );
          })}

          <section className="mda-card-flush">
            <div className="mda-card-head">
              <div>
                <h2 className="mda-h2">Mes pratiques hors Académie · {external.length}</h2>
                <p className="mda-sub" style={{ margin: 0 }}>CF Montréal, St-Gabriel… Même plan de séance, rangées à part (pas envoyées dans MonClubSportif, pas dans la paie des éducateurs).</p>
              </div>
            </div>
            {external.length ? (
              <ul className="mda-tasks">
                {external.map((p) => (
                  <Row key={p.key} p={p} />
                ))}
              </ul>
            ) : null}
            <div style={{ padding: "16px 20px", borderTop: external.length ? "1px solid var(--adm-line)" : undefined }}>
              <ExternalPracticeForm />
            </div>
          </section>

          <p className="mda-sub" style={{ margin: 0 }}>
            Les pratiques viennent de l'horaire de la saison et des programmes ; une pratique ajoutée dans <Link href="/admin/entraineurs/activites" style={{ color: "var(--adm-accent)" }}>Entraînements</Link> apparaît ici aussi. Le lien avec le calendrier MonClubSportif (dans les deux sens) est la tâche P8.4.08 du plan.
          </p>
        </div>
      </div>
    </>
  );
}
