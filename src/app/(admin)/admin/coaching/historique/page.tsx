import Link from "next/link";

import { Pill } from "@/components/mandalart/ui";
import { PracticeDeposit } from "@/components/practice-deposit";
import { requireAdmin } from "@/lib/admin-auth";
import { CHECKS, checksOf, isComplete, isLate, missingOf } from "@/lib/practice-history";
import { getPracticeHistory, type HistoryRow } from "@/lib/practice-history-repo";
import { todayIso } from "@/lib/practices-repo";

export const metadata = { title: "Historique des pratiques — Coaching", robots: "noindex" };
export const dynamic = "force-dynamic";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

function Row({ r }: { r: HistoryRow }) {
  const c = checksOf(r);
  return (
    <li className="mda-task" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
      <div className="mda-task-body" style={{ flex: "1 1 240px" }}>
        <p className="mda-task-title" style={{ fontWeight: 600 }}>{day(r.date)} · {r.start.replace(":", " h ")} · Filles {r.group}</p>
        <div className="mda-task-meta">
          {CHECKS.map((k) => (
            <span key={k.key} style={{ color: c[k.key] ? "var(--adm-good)" : "var(--adm-text-3)" }}>{c[k.key] ? "✓" : "○"} {k.label}</span>
          ))}
          {r.deckUrl ? <a href={r.deckUrl} target="_blank" rel="noreferrer" style={{ color: "var(--adm-accent)" }}>Diapos ↗</a> : null}
          {r.activityId ? <Link href={`/admin/coaching/sondage/${r.activityId}`} style={{ color: "var(--adm-accent)" }}>Présences et sondage</Link> : null}
        </div>
        {r.analysisText ? <p className="mda-sub" style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{r.analysisText}</p> : null}
      </div>
      <PracticeDeposit practiceKey={r.key} deckUrl={r.deckUrl} analysis={r.analysisText} />
    </li>
  );
}

/** « Ai-je l'historique exact de chaque pratique ? » : les pratiques passées pas encore déposées d'abord, puis tout
 *  l'historique de la saison, mois par mois. */
export default async function PracticeHistoryPage() {
  await requireAdmin();
  const today = todayIso();
  const rows = await getPracticeHistory();
  const past = rows.filter((r) => r.date < today);
  const late = past.filter((r) => isLate(r, today));
  const complete = past.filter(isComplete).length;
  const months = [...new Set(past.map((r) => r.date.slice(0, 7)))];

  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 960 }}>
        <header>
          <p className="mda-eyebrow">Espace coaching · l&apos;historique exact de chaque pratique</p>
          <h1 className="mda-h1">{late.length ? `${late.length} pratique${late.length > 1 ? "s" : ""} en retard à déposer` : "Toutes les pratiques passées sont déposées"}</h1>
          <p className="mda-lead">
            Une pratique est complète quand elle est déposée (le lien de ses diapos ou son plan de séance), que les présences et le sondage de fin sont faits et que l&apos;analyse d&apos;après pratique est écrite. {complete} sur {past.length} pratiques de la saison sont complètes.
          </p>
        </header>

        {late.length > 0 && (
          <section className="mda-card-flush">
            <div className="mda-card-head">
              <h2 className="mda-h2">En retard</h2>
              <Pill tone="warn">{late.length}</Pill>
            </div>
            <ul className="mda-tasks">{late.map((r) => <Row key={r.key} r={r} />)}</ul>
          </section>
        )}

        {months.map((m) => {
          const list = past.filter((r) => r.date.startsWith(m) && !isLate(r, today));
          if (!list.length) return null;
          const [y, mo] = m.split("-").map(Number);
          return (
            <section key={m} className="mda-card-flush">
              <div className="mda-card-head">
                <h2 className="mda-h2" style={{ textTransform: "capitalize" }}>{MONTHS[mo - 1]} {y}</h2>
                <Pill>{list.filter(isComplete).length}/{list.length} complètes</Pill>
              </div>
              <ul className="mda-tasks">{list.map((r) => <Row key={r.key} r={r} />)}</ul>
            </section>
          );
        })}
        <p className="mda-sub" style={{ margin: 0 }}>À venir : les capsules vidéo de ball mastery de chaque joueuse, rangées avec la pratique et la fiche de la joueuse. Ce qui manque à une pratique : {past.length ? missingOf(past[0]).join(", ") || "rien" : "—"} (dernière pratique).</p>
      </div>
    </div>
  );
}
