import { GymExerciseCard, shortDate, type GymExerciseItem } from "@/components/jp-space";
import { requireAdmin } from "@/lib/admin-auth";
import { GYM, WARMUP, cycleWeek, lastEntry, restLabel, sessionFor, setsFor, targetFor, type GymExercise, type GymLog } from "@/lib/jp-gym";
import { getGymLog } from "@/lib/jp-repo";
import { todayIso } from "@/lib/mandalart-repo";

export const metadata = { title: "Mon gym — Espace JP", robots: "noindex" };
export const dynamic = "force-dynamic";

const fmtKg = (w: number | null) => (w === null ? "poids du corps" : `${String(w).replace(".", ",")} kg`);

function toItem(e: GymExercise, log: GymLog, day: string, phase: ReturnType<typeof cycleWeek>["phase"]): GymExerciseItem {
  const sets = setsFor(e, phase);
  const last = lastEntry(log, e.id, day);
  const t = targetFor(e, last?.entry ?? null, phase);
  const unit = e.unit === "s" ? "s" : "reps";
  const range = e.repsMin === e.repsMax ? `${e.repsMax}` : `${e.repsMin} à ${e.repsMax}`;
  return {
    id: e.id,
    name: e.name,
    prescription: `${sets} séries de ${range}${unit === "s" ? " s" : ""}${e.perSide ? " par côté" : ""}`,
    rest: restLabel(e.rest),
    cue: e.cue,
    swap: e.swap,
    sets,
    unit,
    target: t.text,
    targetWeight: t.weight,
    last: last ? `${shortDate(last.date)} · ${unit === "s" ? "" : `${fmtKg(last.entry.w)} · `}${last.entry.r.join(", ")}${unit === "s" ? " s" : ""}` : null,
    today: log[day]?.[e.id] ?? null,
    superset: !!e.superset
  };
}

/** Espace JP — Mon gym : la séance du jour (A, B ou C), quoi viser à chaque exercice selon la dernière fois,
 *  et la case pour noter charges et répétitions pendant la séance. */
export default async function MonGymPage() {
  await requireAdmin({ roles: ["admin"] });
  const today = todayIso();
  const log = await getGymLog().catch(() => ({}) as GymLog);
  const { session, date, isToday } = sessionFor(today);
  const cw = cycleWeek(date);
  const items = session.exercises.map((e) => toItem(e, log, date, cw.phase));
  const done = items.filter((i) => i.today).length;
  const weekStart = (() => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  })();
  const sessionsThisWeek = Object.keys(log).filter((d) => d >= weekStart && d <= today).length;

  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 820 }}>
        <header>
          <p className="mda-eyebrow">
            {isToday ? "Aujourd'hui" : `Prochaine séance : ${shortDate(date)}`} · {cw.label} ({cw.week}/6)
          </p>
          <h1 className="mda-h1" style={{ textTransform: "none" }}>{session.title}</h1>
          <p className="mda-lead">
            {session.focus} {cw.reserve}
          </p>
        </header>

        <section className="mda-cols-3">
          <div className="mda-card">
            <p className="mda-num" style={{ color: done === items.length ? "var(--adm-good)" : undefined }}>
              {done}/{items.length}
            </p>
            <p className="mda-label">Exercices notés {isToday ? "aujourd'hui" : "pour cette séance"}</p>
          </div>
          <div className="mda-card">
            <p className="mda-num">{sessionsThisWeek}/3</p>
            <p className="mda-label">Séances cette semaine (mardi, mercredi, vendredi)</p>
          </div>
          <div className="mda-card">
            <p className="mda-num">≈ 55 min</p>
            <p className="mda-label">Échauffement compris. Déjeuner protéiné en sortant.</p>
          </div>
        </section>

        <section className="mda-card">
          <p className="mda-label" style={{ marginTop: 0 }}>🔥 Échauffement</p>
          <p style={{ margin: "6px 0 0", fontSize: "0.9rem", lineHeight: 1.45 }}>{WARMUP}</p>
        </section>

        <section className="mda-card-flush">
          <div className="mda-card-head">
            <h2 className="mda-h2">La séance, dans l&apos;ordre</h2>
          </div>
          <ul className="mda-tasks">
            {items.map((e, i) => (
              <GymExerciseCard key={e.id} e={e} day={date} n={i + 1} />
            ))}
          </ul>
          {session.finisher ? (
            <p style={{ padding: "0 20px 14px", margin: 0, fontSize: "0.88rem" }}>
              ❤️ <strong>Pour finir :</strong> {session.finisher}
            </p>
          ) : null}
        </section>

        <section className="mda-card">
          <p className="mda-label" style={{ marginTop: 0 }}>Les règles, en 4 lignes</p>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: "0.88rem", lineHeight: 1.5 }}>
            <li>Tu fais le haut de la fourchette à toutes les séries ? La séance suivante, la charge monte. Sinon, même charge et une répétition de plus.</li>
            <li>Toujours une belle technique : si ça casse, la série est finie.</li>
            <li>Douleur (pas une courbature) : prends l&apos;exercice « Sinon » et ne force pas.</li>
            <li>Séance manquée ? Pas de rattrapage : fais la suivante. Ne jamais manquer deux fois de suite.</li>
          </ul>
        </section>

        <section className="mda-card-flush">
          <div className="mda-card-head">
            <h2 className="mda-h2">La semaine</h2>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: "8px 20px 14px", display: "grid", gap: 10 }}>
            {GYM.map((s) => (
              <li key={s.key} style={{ fontSize: "0.88rem" }}>
                <strong>
                  {s.dayLabel} 7 h 45 · {s.title}
                </strong>
                <br />
                <span style={{ color: "var(--adm-text-3)" }}>
                  {s.exercises.map((e) => `${e.name} ${e.sets}×${e.repsMin === e.repsMax ? e.repsMax : `${e.repsMin}-${e.repsMax}`}${e.unit === "s" ? " s" : ""}`).join(" · ")}
                  {s.finisher ? " · cardio 6 min" : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
