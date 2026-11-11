import Link from "next/link";

import { AddTask, DayList, DelegatedRow, type DayEntryItem } from "@/components/jp-space";
import { requireAdmin } from "@/lib/admin-auth";
import { dayMet } from "@/lib/jp-core";
import { nextAction } from "@/lib/jp-plan";
import { getCalendarView, getHabitsView, getPlanChecks } from "@/lib/jp-repo";
import { getLiveTasks } from "@/lib/mandalart-repo";
import { getJpDay } from "@/lib/team-tasks-repo";

export const metadata = { title: "Ma journée — Espace JP", robots: "noindex" };
export const dynamic = "force-dynamic";

const longDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** Espace JP — Ma journée : ce qui me revient aujourd'hui et cette semaine (Mandalart + ma liste), mon horaire du jour,
 *  mes habitudes du jour et ce que j'ai confié aux autres. */
export default async function MaJourneePage() {
  await requireAdmin({ roles: ["admin"] });
  const [day, habits, cal, planChecks, live] = await Promise.all([getJpDay(), getHabitsView(), getCalendarView().catch(() => null), getPlanChecks().catch(() => ({})), getLiveTasks().catch(() => [])]);
  const planNext = nextAction(day.today, planChecks, new Set(live.filter((t) => t.status === "fait").map((t) => t.code)));
  const toItem = (e: (typeof day.mine)[number]): DayEntryItem => ({ ...e, late: e.bucket === "retard" });
  const now = day.mine.filter((e) => e.bucket === "retard" || e.bucket === "aujourdhui").map(toItem);
  const week = day.mine.filter((e) => e.bucket === "semaine").map(toItem);
  const later = day.mine.filter((e) => e.bucket === "plus-tard" || e.bucket === "sans-date").map(toItem);
  const openDelegated = day.delegated.filter((t) => t.status === "a_faire" || t.status === "en_cours");
  const lateDelegated = openDelegated.filter((t) => t.bucket === "retard");
  const todayEvents = cal?.events.filter((e) => e.date === day.today && !e.allDay) ?? [];
  const todayHabits = habits.weeks.map((w) => ({ name: w.habit.name, met: dayMet(w.habit, w.days.find((d) => d.day === day.today)?.value) }));
  const habitsDone = todayHabits.filter((h) => h.met).length;

  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 1000 }}>
        <header>
          <p className="mda-eyebrow">{longDay(day.today)}</p>
          <h1 className="mda-h1">{now.length ? `${now.length} chose${now.length > 1 ? "s" : ""} à faire aujourd'hui` : "Rien d'urgent aujourd'hui"}</h1>
          <p className="mda-lead">Tes tâches du Mandalart dont tu es responsable et ta propre liste. « Confier » envoie une tâche à Christine, à Annie, à un éducateur ou à n&apos;importe qui, avec un lien pour te dire où elle en est.</p>
        </header>

        {planNext ? (
          <Link href="/admin/moi/plan" className="mda-card" style={{ display: "grid", gap: 4, borderColor: "var(--adm-accent)", textDecoration: "none", color: "inherit" }}>
            <span className="mda-label">{planNext.late ? "Mon plan · à rattraper d'abord" : "Mon plan · ta prochaine action"}</span>
            <span style={{ fontSize: "1.05rem", fontWeight: 600, lineHeight: 1.35 }}>👉 {planNext.step.text}</span>
            <span className="mda-sub" style={{ margin: 0 }}>{planNext.piece.title} · voir le plan →</span>
          </Link>
        ) : null}

        <section className="mda-cols-3">
          <div className="mda-card">
            <p className="mda-num" style={{ color: now.some((e) => e.late) ? "var(--adm-warn)" : undefined }}>{now.length}</p>
            <p className="mda-label">Aujourd&apos;hui ou en retard · {week.length} d&apos;ici dimanche</p>
          </div>
          <div className="mda-card">
            <p className="mda-num" style={{ color: lateDelegated.length ? "var(--adm-warn)" : undefined }}>{openDelegated.length}</p>
            <p className="mda-label">Confiée{openDelegated.length > 1 ? "s" : ""} en cours{lateDelegated.length ? ` · ${lateDelegated.length} en retard` : ""}</p>
          </div>
          <div className="mda-card">
            <p className="mda-num">{day.doneThisWeek}</p>
            <p className="mda-label">Faites cette semaine (toi et ton équipe)</p>
          </div>
        </section>

        <section className="mda-card-flush">
          <div className="mda-card-head">
            <h2 className="mda-h2">Aujourd&apos;hui</h2>
          </div>
          <DayList entries={now} empty="Rien de prévu ni en retard. Prends une tâche de la semaine ou avance ton bloc de travail profond." />
          <div className="mda-card-head" style={{ borderTop: "1px solid var(--adm-line)" }}>
            <h2 className="mda-h2">Ajouter</h2>
          </div>
          <AddTask today={day.today} />
        </section>

        <section className="mda-cols-2">
          <div className="mda-card">
            <h2 className="mda-h2" style={{ marginTop: 0 }}>Mon horaire du jour</h2>
            {!cal?.connected ? (
              <p className="mda-sub" style={{ margin: 0 }}>
                <Link href="/admin/moi/calendrier">Branche ton Google Agenda</Link> pour voir ta journée ici.
              </p>
            ) : todayEvents.length ? (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
                {todayEvents.map((e, i) => (
                  <li key={i} style={{ fontSize: "0.88rem" }}>
                    <span className="mda-tnum" style={{ color: "var(--adm-text-3)" }}>
                      {e.start}–{e.end}
                    </span>{" "}
                    {e.summary}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mda-sub" style={{ margin: 0 }}>Rien à l&apos;agenda aujourd&apos;hui : bloque ton temps (travail profond, contenu, sommeil).</p>
            )}
          </div>
          <div className="mda-card">
            <h2 className="mda-h2" style={{ marginTop: 0 }}>
              Mes habitudes du jour · {habitsDone}/{todayHabits.length}
            </h2>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
              {todayHabits.map((h) => (
                <li key={h.name} style={{ fontSize: "0.88rem", color: h.met ? "var(--adm-good)" : "var(--adm-text-2)" }}>
                  {h.met ? "✓" : "○"} {h.name}
                </li>
              ))}
            </ul>
            <p style={{ margin: "10px 0 0" }}>
              <Link href="/admin/moi/habitudes">Noter mes habitudes</Link>
            </p>
          </div>
        </section>

        <section className="mda-card-flush">
          <div className="mda-card-head">
            <h2 className="mda-h2">Cette semaine</h2>
          </div>
          <DayList entries={week} empty="Rien d'autre d'ici dimanche." />
          {later.length ? (
            <>
              <div className="mda-card-head" style={{ borderTop: "1px solid var(--adm-line)" }}>
                <h2 className="mda-h2">Les 2 prochaines semaines et sans date</h2>
              </div>
              <DayList entries={later} empty="" />
            </>
          ) : null}
        </section>

        <section className="mda-card-flush">
          <div className="mda-card-head">
            <h2 className="mda-h2">Ce que j&apos;ai confié</h2>
            <Link href="/admin/moi/confiees" className="admin-btn-ghost">
              Tout voir
            </Link>
          </div>
          {openDelegated.length ? (
            <ul className="mda-tasks">
              {openDelegated.map((t) => (
                <DelegatedRow
                  key={t.id}
                  t={{ id: t.id, title: t.title, assignee: t.assignee, due: t.due, status: t.status, late: t.bucket === "retard", seen: !!t.seen_at, doneNote: t.done_note, evidenceUrl: t.evidence_url, code: t.mandalart_code, doneAt: t.done_at }}
                />
              ))}
            </ul>
          ) : (
            <p style={{ padding: "14px 20px", margin: 0, fontSize: "0.88rem", color: "var(--adm-text-3)" }}>Rien de confié en ce moment. Touche « Confier » sur une tâche pour t&apos;enlever un poids.</p>
          )}
        </section>
      </div>
    </div>
  );
}
