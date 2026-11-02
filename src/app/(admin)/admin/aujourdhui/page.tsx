import Link from "next/link";

import { AdminTopbar } from "@/components/admin-topbar";
import { Bar } from "@/components/mandalart/ui";
import { requireAdmin } from "@/lib/admin-auth";
import { getTodayActions, type TodaySection } from "@/lib/admin-today";
import { KIND_LABEL, addDays, getAgenda, getStepProjects, todayIso, type AgendaItem } from "@/lib/agenda";

export const metadata = { title: "Aujourd'hui — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Couleur d'un état : rouge = urgent, orange = à surveiller, info = à traiter quand possible. */
const LEVEL: Record<TodaySection["level"], { color: string; soft: string; label: string; order: number }> = {
  rouge: { color: "var(--adm-bad)", soft: "var(--adm-bad-soft)", label: "Urgent", order: 0 },
  orange: { color: "var(--adm-warn)", soft: "var(--adm-warn-soft)", label: "À surveiller", order: 1 },
  info: { color: "var(--adm-info)", soft: "var(--adm-info-soft)", label: "À traiter", order: 2 }
};

const DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const dayOf = (iso: string) => new Date(`${iso}T12:00:00Z`);
const STATE_LABEL: Record<AgendaItem["state"], { label: string; color: string }> = {
  retard: { label: "En retard", color: "var(--adm-bad)" },
  attention: { label: "À surveiller", color: "var(--adm-warn)" },
  a_faire: { label: "À faire", color: "var(--adm-info)" },
  fait: { label: "Prêt", color: "var(--adm-good)" }
};

export default async function AdminTodayPage({ searchParams }: { searchParams: Promise<{ semaine?: string }> }) {
  const role = await requireAdmin();
  const offset = Math.max(-8, Math.min(26, Number((await searchParams).semaine ?? 0) || 0));
  const today = todayIso();
  const monday = addDays(today, -((dayOf(today).getUTCDay() + 6) % 7) + offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const [sections, agenda, projects] = await Promise.all([getTodayActions(role), getAgenda(days[0], days[6], role).catch(() => []), getStepProjects(role).catch(() => [])]);
  const byDay = (d: string) => agenda.filter((i) => i.date === d);
  const openProjects = projects.filter((p) => p.done < p.total);
  const todo = sections.filter((s) => s.items.length > 0).sort((a, b) => LEVEL[a.level].order - LEVEL[b.level].order);
  const done = sections.filter((s) => s.items.length === 0);
  const urgent = todo.filter((s) => s.level !== "info").length;
  const rawDate = new Date().toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Toronto" });
  const dateLabel = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section" style={{ maxWidth: 1100 }}>
          {/* Héros : la réponse à « qu'est-ce que je dois faire aujourd'hui ? » */}
          <p style={{ fontSize: "0.9rem", color: "var(--adm-text-3)", margin: 0 }}>{dateLabel}</p>
          <h1 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.02em", margin: "0.2rem 0 0.4rem", color: "var(--adm-text)" }}>
            {todo.length === 0 ? "Tout est à jour." : `${todo.length} sujet${todo.length > 1 ? "s" : ""} demande${todo.length > 1 ? "nt" : ""} ton attention`}
          </h1>
          <p style={{ fontSize: "0.95rem", color: "var(--adm-text-2)", margin: "0 0 1.4rem" }}>
            {todo.length === 0
              ? "Rien à faire pour l'instant. Cette page se met à jour toute seule."
              : urgent > 0
                ? `Commence par ${urgent === 1 ? "le sujet marqué" : `les ${urgent} sujets marqués`} en couleur. Une fois une tâche faite dans sa section, elle disparaît d'ici.`
                : "Rien d'urgent. Une fois une tâche faite dans sa section, elle disparaît d'ici."}
          </p>

          {/* La semaine en calendrier : quoi, quand */}
          <section style={{ marginBottom: "1.4rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0, color: "var(--adm-text)" }}>
                {offset === 0 ? "Ma semaine" : `Semaine du ${dayOf(days[0]).getUTCDate()} ${MONTHS[dayOf(days[0]).getUTCMonth()]}`}
              </h2>
              <span style={{ display: "inline-flex", gap: 8 }}>
                <Link href={`/admin/aujourdhui?semaine=${offset - 1}`} className="admin-btn-ghost" style={{ padding: "6px 12px", textDecoration: "none" }}>← Semaine d'avant</Link>
                {offset !== 0 ? <Link href="/admin/aujourdhui" className="admin-btn-ghost" style={{ padding: "6px 12px", textDecoration: "none" }}>Cette semaine</Link> : null}
                <Link href={`/admin/aujourdhui?semaine=${offset + 1}`} className="admin-btn-ghost" style={{ padding: "6px 12px", textDecoration: "none" }}>Semaine suivante →</Link>
              </span>
            </div>
            <div className="agd-week">
              {days.map((d) => {
                const items = byDay(d);
                const late = items.filter((i) => i.state === "retard").length;
                return (
                  <a key={d} href={`#jour-${d}`} className="agd-day" data-today={d === today ? "true" : undefined}>
                    <span className="agd-day-head">
                      <span>{DAY_NAMES[dayOf(d).getUTCDay()]}</span>
                      <span className="agd-day-num">{dayOf(d).getUTCDate()}</span>
                    </span>
                    {items.slice(0, 5).map((i, k) => (
                      <span key={k} className="agd-chip">
                        <span className="agd-dot" data-s={i.state} aria-hidden />
                        <span>
                          {i.time ? `${i.time} ` : ""}
                          {KIND_LABEL[i.kind].icon} {i.title}
                        </span>
                      </span>
                    ))}
                    {items.length > 5 ? <span className="agd-chip" style={{ color: "var(--adm-text-3)" }}>+ {items.length - 5} autre{items.length - 5 > 1 ? "s" : ""}</span> : null}
                    {items.length === 0 ? <span className="agd-chip" style={{ color: "var(--adm-text-3)" }}>Rien de prévu</span> : null}
                    {late ? <span style={{ fontSize: "0.72rem", color: "var(--adm-bad)", fontWeight: 600 }}>{late} en retard</span> : null}
                  </a>
                );
              })}
            </div>
          </section>

          {/* Le détail jour par jour, étape par étape */}
          <section style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: "1.6rem" }}>
            {days.map((d) => {
              const items = byDay(d);
              if (!items.length) return null;
              const isToday = d === today;
              return (
                <details key={d} id={`jour-${d}`} open={isToday || (offset !== 0 && d === days[0])} style={{ background: "var(--adm-surface)", border: `1px solid ${isToday ? "rgba(180,155,242,0.5)" : "var(--adm-line)"}`, borderRadius: 14, overflow: "hidden", scrollMarginTop: 16 }}>
                  <summary style={{ cursor: "pointer", padding: "14px 20px", display: "flex", justifyContent: "space-between", gap: 12, listStyle: "none" }}>
                    <span style={{ fontWeight: 600, color: "var(--adm-text)" }}>
                      {isToday ? "Aujourd'hui · " : ""}
                      {DAY_NAMES[dayOf(d).getUTCDay()]} {dayOf(d).getUTCDate()} {MONTHS[dayOf(d).getUTCMonth()]}
                    </span>
                    <span style={{ fontSize: "0.82rem", color: "var(--adm-text-3)" }}>
                      {items.length} élément{items.length > 1 ? "s" : ""}
                      {items.some((i) => i.state === "retard") ? <span style={{ color: "var(--adm-bad)" }}> · {items.filter((i) => i.state === "retard").length} en retard</span> : null}
                    </span>
                  </summary>
                  {items.map((i, k) => (
                    <Link key={k} href={i.href} className="agd-item">
                      <span className="agd-time">{i.time ?? "—"}</span>
                      <span>
                        <span style={{ display: "block", fontWeight: 600, fontSize: "0.92rem" }}>
                          {KIND_LABEL[i.kind].icon} {i.title}
                        </span>
                        {i.detail ? <span style={{ display: "block", fontSize: "0.8rem", color: "var(--adm-text-2)", marginTop: 2 }}>{i.detail}</span> : null}
                      </span>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: STATE_LABEL[i.state].color, whiteSpace: "nowrap" }}>{STATE_LABEL[i.state].label}</span>
                    </Link>
                  ))}
                </details>
              );
            })}
          </section>

          {/* Projets en plusieurs étapes, suivis jusqu'au bout */}
          {openProjects.length > 0 && (
            <section style={{ marginBottom: "1.6rem" }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 10px", color: "var(--adm-text)" }}>Projets en cours, étape par étape</h2>
              <div className="agd-projects">
                {openProjects.map((p) => (
                  <Link key={p.key} href={p.href} style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-line)", borderRadius: 14, padding: 16, textDecoration: "none", color: "var(--adm-text)", display: "flex", flexDirection: "column", gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: "0.92rem", lineHeight: 1.3 }}>{p.title}</span>
                    <Bar value={p.total ? p.done / p.total : 0} thin color="var(--adm-good)" />
                    <span style={{ fontSize: "0.8rem", color: "var(--adm-text-2)" }}>
                      <strong style={{ color: "var(--adm-text)" }}>
                        {p.done}/{p.total}
                      </strong>{" "}
                      · Prochaine étape : {p.next}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 10px", color: "var(--adm-text)" }}>Suivis à faire</h2>
          {/* Sommaire : une pastille par sujet */}
          {todo.length > 0 && (
            <nav aria-label="Sommaire" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.6rem" }}>
              {todo.map((s) => (
                <a
                  key={s.key}
                  href={`#${s.key}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.45rem 0.8rem", borderRadius: 999, background: "var(--adm-surface)", border: "1px solid var(--adm-line)", color: "var(--adm-text)", fontSize: "0.85rem", textDecoration: "none" }}
                >
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: LEVEL[s.level].color }} />
                  {s.title}
                  <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: LEVEL[s.level].color }}>{s.count}</span>
                </a>
              ))}
            </nav>
          )}

          {/* Un bloc par sujet, du plus urgent au moins urgent */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {todo.map((s) => {
              const lvl = LEVEL[s.level];
              return (
                <section
                  key={s.key}
                  id={s.key}
                  style={{ background: "var(--adm-surface)", border: "1px solid var(--adm-line)", borderRadius: 14, overflow: "hidden", scrollMarginTop: "1rem" }}
                >
                  <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", padding: "0.95rem 1.1rem", borderBottom: "1px solid var(--adm-line)", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", minWidth: 0 }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 600, color: lvl.color, background: lvl.soft, padding: "0.2rem 0.55rem", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0 }}>{lvl.label}</span>
                      <h2 style={{ fontSize: "1.02rem", fontWeight: 600, margin: 0, color: "var(--adm-text)" }}>
                        {s.title} <span style={{ color: "var(--adm-text-3)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>· {s.count}</span>
                      </h2>
                    </div>
                    <Link href={s.href} className="admin-btn-ghost" style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", textDecoration: "none" }}>
                      {s.hrefLabel}
                    </Link>
                  </header>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {s.items.map((item, i) => (
                      <li key={i} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", padding: "0.75rem 1.1rem", borderTop: i === 0 ? "none" : "1px solid var(--adm-line)" }}>
                        <div style={{ minWidth: 0 }}>
                          {item.href ? (
                            <Link href={item.href} style={{ color: "var(--adm-text)", fontWeight: 600, fontSize: "0.92rem", textDecoration: "none" }}>{item.title}</Link>
                          ) : (
                            <span style={{ color: "var(--adm-text)", fontWeight: 600, fontSize: "0.92rem" }}>{item.title}</span>
                          )}
                          {item.detail ? <span style={{ display: "block", color: "var(--adm-text-2)", fontSize: "0.84rem", marginTop: 2 }}>{item.detail}</span> : null}
                        </div>
                        {item.meta ? <span style={{ color: "var(--adm-text-3)", fontSize: "0.82rem", whiteSpace: "nowrap", flexShrink: 0, textAlign: "right" }}>{item.meta}</span> : null}
                      </li>
                    ))}
                  </ul>
                  {s.more ? (
                    <p style={{ fontSize: "0.82rem", color: "var(--adm-text-3)", margin: 0, padding: "0.65rem 1.1rem", borderTop: "1px solid var(--adm-line)" }}>
                      Et {s.more} autre{s.more > 1 ? "s" : ""} ·{" "}
                      <Link href={s.href} style={{ color: "var(--adm-accent)", textDecoration: "none" }}>tout voir</Link>
                    </p>
                  ) : null}
                </section>
              );
            })}
          </div>

          {/* Ce qui est à jour : discret */}
          {done.length > 0 && (
            <details style={{ marginTop: "1.6rem" }}>
              <summary style={{ cursor: "pointer", color: "var(--adm-text-3)", fontSize: "0.88rem" }}>
                <span style={{ color: "var(--adm-good)" }}>✓</span> {done.length} sujet{done.length > 1 ? "s" : ""} à jour
              </summary>
              <ul style={{ listStyle: "none", margin: "0.6rem 0 0", padding: 0, display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                {done.map((s) => (
                  <li key={s.key} style={{ fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
                    {s.emptyText}{" "}
                    <Link href={s.href} style={{ color: "var(--adm-text-3)" }}>{s.hrefLabel}</Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </>
  );
}
