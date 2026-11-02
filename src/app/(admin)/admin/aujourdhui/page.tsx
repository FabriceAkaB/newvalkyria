import Link from "next/link";

import { AdminTopbar } from "@/components/admin-topbar";
import { requireAdmin } from "@/lib/admin-auth";
import { getTodayActions, type TodaySection } from "@/lib/admin-today";

export const metadata = { title: "Aujourd'hui — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Couleur d'un état : rouge = urgent, orange = à surveiller, info = à traiter quand possible. */
const LEVEL: Record<TodaySection["level"], { color: string; soft: string; label: string; order: number }> = {
  rouge: { color: "var(--adm-bad)", soft: "var(--adm-bad-soft)", label: "Urgent", order: 0 },
  orange: { color: "var(--adm-warn)", soft: "var(--adm-warn-soft)", label: "À surveiller", order: 1 },
  info: { color: "var(--adm-info)", soft: "var(--adm-info-soft)", label: "À traiter", order: 2 }
};

export default async function AdminTodayPage() {
  const role = await requireAdmin();
  const sections = await getTodayActions(role);
  const todo = sections.filter((s) => s.items.length > 0).sort((a, b) => LEVEL[a.level].order - LEVEL[b.level].order);
  const done = sections.filter((s) => s.items.length === 0);
  const urgent = todo.filter((s) => s.level !== "info").length;
  const rawDate = new Date().toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Toronto" });
  const dateLabel = rawDate.charAt(0).toUpperCase() + rawDate.slice(1);

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section" style={{ maxWidth: 880 }}>
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
