import { CalendarConnect } from "@/components/jp-space";
import { Bar } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { CATEGORY_COLOR, CATEGORY_LABEL, categorize, type WeekTime } from "@/lib/jp-core";
import { getCalendarView } from "@/lib/jp-repo";

export const metadata = { title: "Mon calendrier — Espace JP", robots: "noindex" };
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const dayHead = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
const short = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { day: "numeric", month: "short", timeZone: "UTC" });

function WeekCard({ title, w }: { title: string; w: WeekTime }) {
  const max = Math.max(1, ...w.byCategory.map((c) => c.hours));
  return (
    <div className="mda-card">
      <h2 className="mda-h2" style={{ marginTop: 0 }}>
        {title} · {w.total} h planifiées
      </h2>
      {w.byCategory.length ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {w.byCategory.map((c) => (
            <li key={c.category} style={{ display: "grid", gap: 4, fontSize: "0.85rem" }}>
              <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span>{CATEGORY_LABEL[c.category]}</span>
                <span className="mda-tnum">{c.hours} h</span>
              </span>
              <Bar value={c.hours / max} thin color={CATEGORY_COLOR[c.category]} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mda-sub" style={{ margin: 0 }}>Rien de planifié.</p>
      )}
    </div>
  );
}

/** Le calendrier de JP (Google Agenda + ses pratiques à l'académie) : où va son temps, catégorie par catégorie. */
export default async function MonCalendrierPage() {
  await requireAdmin({ roles: ["admin"] });
  const v = await getCalendarView();
  const days = Array.from(new Set(v.events.map((e) => e.date))).sort();
  const deep = v.week.byCategory.filter((c) => c.category === "contenu" || c.category === "ventes" || c.category === "formation").reduce((s, c) => s + c.hours, 0);
  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 1000 }}>
        <header>
          <p className="mda-eyebrow">
            Semaine du {short(v.monday)}
          </p>
          <h1 className="mda-h1">Mon calendrier</h1>
          <p className="mda-lead">
            Ton Google Agenda et tes pratiques à l&apos;académie, rangés par catégorie. Un calendrier qui sert tes objectifs a des blocs pour ce qui fait grandir l&apos;académie (ventes, contenu, partenaires), pas seulement pour le terrain.
            {v.connected ? ` Cette semaine : ${Math.round(deep * 10) / 10} h pour la croissance (ventes, contenu, formation).` : ""}
          </p>
        </header>

        {v.error ? (
          <section className="mda-card">
            <p className="mda-sub" style={{ margin: 0, color: "var(--adm-bad)" }}>{v.error}</p>
          </section>
        ) : null}

        <section className="mda-card">
          <h2 className="mda-h2" style={{ marginTop: 0 }}>{v.connected ? "Google Agenda branché" : "Brancher mon Google Agenda"}</h2>
          <CalendarConnect connected={v.connected} />
        </section>

        <section className="mda-cols-2">
          <WeekCard title="Cette semaine" w={v.week} />
          <WeekCard title="Semaine prochaine" w={v.next} />
        </section>

        <section className="mda-card-flush">
          <div className="mda-card-head">
            <h2 className="mda-h2">Les 2 semaines, jour par jour</h2>
          </div>
          {days.length ? (
            <ul className="mda-tasks">
              {days.map((d) => (
                <li key={d} className="mda-task" style={{ display: "block" }}>
                  <p className="mda-task-title" style={{ fontWeight: 600, textTransform: "capitalize" }}>{dayHead(d)}</p>
                  <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0, display: "grid", gap: 4 }}>
                    {v.events
                      .filter((e) => e.date === d)
                      .map((e, i) => (
                        <li key={i} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: "0.86rem" }}>
                          <span style={{ width: 8, height: 8, borderRadius: 4, background: CATEGORY_COLOR[categorize(e.summary)], flex: "none", transform: "translateY(-1px)" }} aria-hidden />
                          <span className="mda-tnum" style={{ color: "var(--adm-text-3)", minWidth: 92 }}>{e.allDay ? "Journée" : `${e.start}–${e.end}`}</span>
                          <span>
                            {e.summary}
                            {e.source === "academie" ? <span style={{ color: "var(--adm-text-3)" }}> · académie</span> : null}
                          </span>
                        </li>
                      ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ padding: "14px 20px", margin: 0, fontSize: "0.88rem", color: "var(--adm-text-3)" }}>Rien au calendrier ces 2 semaines.</p>
          )}
        </section>
      </div>
    </div>
  );
}
