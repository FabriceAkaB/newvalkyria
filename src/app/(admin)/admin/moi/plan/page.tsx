import Link from "next/link";

import { PlanStepRow, shortDate } from "@/components/jp-space";
import { requireAdmin } from "@/lib/admin-auth";
import { PLAN, leftovers, nextAction, pieceProgress, weekOf, type Checks, type PlanPiece } from "@/lib/jp-plan";
import { getPlanChecks } from "@/lib/jp-repo";
import { getLiveTasks, todayIso } from "@/lib/mandalart-repo";
import { listPractices, type Practice } from "@/lib/practices-repo";

export const metadata = { title: "Mon plan — Espace JP", robots: "noindex" };
export const dynamic = "force-dynamic";

const PRACTICES_UNTIL = "2026-12-19";

function PieceCard({ piece, checks, doneCodes, nextStepId, late }: { piece: PlanPiece; checks: Checks; doneCodes: Set<string>; nextStepId: string | null; late?: boolean }) {
  const p = pieceProgress(piece, checks, doneCodes);
  return (
    <section className="mda-card-flush">
      <div className="mda-card-head" style={{ alignItems: "flex-start" }}>
        <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <h2 className="mda-h2" style={{ margin: 0 }}>
            {p.finished ? "✅ " : piece.star ? "⭐ " : ""}
            {piece.title}
          </h2>
          <p className="mda-sub" style={{ margin: 0 }}>{piece.why}</p>
        </div>
        <span className="mda-pill" data-tone={p.finished ? "good" : undefined} style={late && !p.finished ? { color: "var(--adm-warn)" } : undefined}>
          {p.finished ? "Fini" : late ? `En retard · ${p.done}/${p.total}` : `${p.done}/${p.total}`}
        </span>
      </div>
      {p.finished ? null : (
        <>
          <p style={{ padding: "12px 20px 0", margin: 0, fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
            🕐 <strong>Quand :</strong> {piece.when}
          </p>
          <ul className="mda-tasks">
            {piece.steps.map((s) => (
              <PlanStepRow key={s.id} s={{ ...s, done: !!checks[s.id] }} next={s.id === nextStepId} />
            ))}
          </ul>
          <p style={{ padding: "0 20px 14px", margin: 0, fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
            ✅ <strong>Fini quand :</strong> {piece.doneWhen}
            {piece.codes.length ? <span style={{ color: "var(--adm-text-3)" }}> · le Mandalart ({piece.codes.join(", ")}) se coche tout seul</span> : null}
          </p>
        </>
      )}
    </section>
  );
}

/** Espace JP — Mon plan : la semaine du plan de 6 mois en quelques pièces, une seule prochaine action,
 *  l'état des pratiques jusqu'aux Fêtes et ce qu'on vend cette semaine. */
export default async function MonPlanPage() {
  await requireAdmin({ roles: ["admin"] });
  const today = todayIso();
  const [checks, live, practices] = await Promise.all([
    getPlanChecks(),
    getLiveTasks(today).catch(() => []),
    listPractices({ from: today, to: PRACTICES_UNTIL }).catch(() => null as Practice[] | null)
  ]);
  const doneCodes = new Set(live.filter((t) => t.status === "fait").map((t) => t.code));
  const week = weekOf(today);
  const late = leftovers(today, checks, doneCodes);
  const next = nextAction(today, checks, doneCodes);
  const upcoming = practices?.filter((x) => x.daysLeft >= 0) ?? [];
  const notReady = upcoming.filter((x) => x.readiness !== "prete");
  const urgent = notReady.filter((x) => x.readiness === "rouge" || x.readiness === "jaune");
  const later = PLAN.filter((w) => week && w.n > week.n);

  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 820 }}>
        <header>
          <p className="mda-eyebrow">{week ? `Semaine ${week.n} sur ${PLAN.length} · ${shortDate(week.start)} au ${shortDate(week.end)}` : "Le plan des Fêtes est terminé"}</p>
          <h1 className="mda-h1" style={{ textTransform: "none" }}>{week ? week.title : "Bravo, tout est passé"}</h1>
          <p className="mda-lead">Une chose à la fois. Fais l&apos;étape 👉, coche-la, passe à la suivante. Le reste attend.</p>
        </header>

        {next ? (
          <section className="mda-card" style={{ borderColor: "var(--adm-accent)", display: "grid", gap: 8 }}>
            <p className="mda-label" style={{ margin: 0 }}>{next.late ? "À rattraper d'abord" : "Ta prochaine action"}</p>
            <p style={{ margin: 0, fontSize: "1.15rem", fontWeight: 600, lineHeight: 1.35 }}>👉 {next.step.text}</p>
            <p className="mda-sub" style={{ margin: 0 }}>
              Pour : {next.piece.title} · {next.piece.when}
            </p>
            {next.step.link ? (
              <p style={{ margin: 0 }}>
                <Link href={next.step.link.href} className="admin-btn-primary">
                  Ouvrir {next.step.link.label}
                </Link>
              </p>
            ) : null}
          </section>
        ) : (
          <section className="mda-card">
            <p style={{ margin: 0 }}>✅ Tout ce qui est prévu cette semaine est fini. Avance la semaine suivante ou vends.</p>
          </section>
        )}

        <section className="mda-cols-2">
          <div className="mda-card">
            <p className="mda-num" style={{ color: urgent.length ? "var(--adm-warn)" : "var(--adm-good)" }}>{practices ? notReady.length : "—"}</p>
            <p className="mda-label">
              {practices
                ? notReady.length
                  ? `Pratique${notReady.length > 1 ? "s" : ""} à monter d'ici le 19 déc.${urgent.length ? ` · ${urgent.length} dans moins d'une semaine` : ""}`
                  : "Toutes les pratiques sont prêtes jusqu'au 19 déc."
                : "Pratiques : impossible de lire l'horaire"}
            </p>
            {urgent.length ? (
              <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 4, fontSize: "0.85rem" }}>
                {urgent.slice(0, 5).map((x) => (
                  <li key={x.key} style={{ color: x.readiness === "rouge" ? "var(--adm-bad)" : "var(--adm-warn)" }}>
                    {x.readiness === "rouge" ? "🔴" : "🟡"} {shortDate(x.date)} {x.start} · {x.group}
                  </li>
                ))}
                {urgent.length > 5 ? <li style={{ color: "var(--adm-text-3)" }}>et {urgent.length - 5} autres</li> : null}
              </ul>
            ) : null}
            <p style={{ margin: "10px 0 0" }}>
              <Link href="/admin/pratiques">Voir les pratiques</Link>
            </p>
          </div>
          <div className="mda-card">
            <p className="mda-label" style={{ marginTop: 0 }}>💰 Cette semaine, tu vends</p>
            <p style={{ margin: "6px 0 0", fontSize: "0.92rem", lineHeight: 1.45 }}>{week?.sell ?? "Voir le Mandalart du mois."}</p>
            <p className="mda-sub" style={{ margin: "8px 0 0" }}>Chaque matin, bloc 🧲 de 8 h 45 : 100 actions (messages, appels, relances).</p>
            <p style={{ margin: "10px 0 0" }}>
              <Link href="/admin/moi/habitudes">Noter mes actions du jour</Link>
            </p>
          </div>
        </section>

        {late.length ? (
          <>
            <h2 className="mda-h2" style={{ margin: "8px 0 0" }}>À rattraper</h2>
            {late.map((p) => (
              <PieceCard key={p.id} piece={p} checks={checks} doneCodes={doneCodes} nextStepId={next?.step.id ?? null} late />
            ))}
          </>
        ) : null}

        {week ? (
          <>
            <h2 className="mda-h2" style={{ margin: "8px 0 0" }}>Cette semaine</h2>
            {week.pieces.map((p) => (
              <PieceCard key={p.id} piece={p} checks={checks} doneCodes={doneCodes} nextStepId={next?.step.id ?? null} />
            ))}
          </>
        ) : null}

        {later.length ? (
          <section className="mda-card-flush">
            <div className="mda-card-head">
              <h2 className="mda-h2">Les semaines suivantes</h2>
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: "8px 20px 14px", display: "grid", gap: 10 }}>
              {later.map((w) => (
                <li key={w.n} style={{ fontSize: "0.88rem" }}>
                  <strong>
                    Semaine {w.n} · {shortDate(w.start)} : {w.title}
                  </strong>
                  <br />
                  <span style={{ color: "var(--adm-text-3)" }}>{w.pieces.map((p) => p.title).join(" · ")}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
