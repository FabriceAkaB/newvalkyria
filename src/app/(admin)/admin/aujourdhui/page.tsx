import Link from "next/link";

import { AdminTopbar } from "@/components/admin-topbar";
import { requireAdmin } from "@/lib/admin-auth";
import { getTodayActions, type TodaySection } from "@/lib/admin-today";

export const metadata = { title: "Aujourd'hui — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

const LEVEL: Record<TodaySection["level"], { color: string; bg: string; border: string }> = {
  rouge: { color: "#ff9999", bg: "rgba(255,153,153,0.12)", border: "#4a2626" },
  orange: { color: "#f0c878", bg: "rgba(240,200,120,0.12)", border: "#4a3c22" },
  info: { color: "#a0c8ff", bg: "rgba(160,200,255,0.12)", border: "#251f30" }
};
const card: React.CSSProperties = { background: "#100e17", border: "1px solid #251f30", borderRadius: 12, padding: "1rem", marginBottom: "1rem" };
const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: "0.75rem", padding: "0.55rem 0", borderTop: "1px solid #1f1d25", fontSize: "0.8rem" };

export default async function AdminTodayPage() {
  const role = await requireAdmin();
  const sections = await getTodayActions(role);
  const todo = sections.filter((s) => s.items.length > 0);
  const done = sections.filter((s) => s.items.length === 0);
  const dateLabel = new Date().toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Toronto" });

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Aujourd&apos;hui · {dateLabel}</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1rem" }}>
            Ce qui demande une action, recalculé à chaque visite. Une fois la tâche faite dans sa section, elle disparaît d&apos;ici.
          </p>

          <div className="admin-stats" style={{ marginBottom: "1.2rem" }}>
            {todo.map((s) => (
              <a key={s.key} href={`#${s.key}`} className={`admin-stat-card${s.level === "rouge" || s.level === "orange" ? " admin-stat-card-warn" : ""}`} style={{ textDecoration: "none" }}>
                <p className="admin-stat-value" style={{ color: LEVEL[s.level].color }}>{s.count}</p>
                <p className="admin-stat-label">{s.title}</p>
              </a>
            ))}
            {todo.length === 0 && (
              <div className="admin-stat-card admin-stat-card-accent"><p className="admin-stat-value">✓</p><p className="admin-stat-label">Rien à faire aujourd&apos;hui</p></div>
            )}
          </div>

          {todo.map((s) => {
            const lvl = LEVEL[s.level];
            return (
              <div key={s.key} id={s.key} style={{ ...card, borderColor: lvl.border, scrollMarginTop: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.4rem", flexWrap: "wrap" }}>
                  <p style={{ fontWeight: 700, color: "#fff", margin: 0 }}>
                    {s.title}{" "}
                    <span style={{ display: "inline-block", padding: "0.1rem 0.5rem", borderRadius: 999, fontSize: "0.72rem", fontWeight: 700, color: lvl.color, background: lvl.bg }}>{s.count}</span>
                  </p>
                  <Link href={s.href} className="admin-btn-ghost" style={{ fontSize: "0.72rem", padding: "0.3rem 0.7rem", textDecoration: "none" }}>
                    {s.hrefLabel} →
                  </Link>
                </div>
                {s.items.map((item, i) => (
                  <div key={i} style={row}>
                    <div style={{ minWidth: 0 }}>
                      {item.href ? (
                        <Link href={item.href} style={{ color: "#fff", fontWeight: 600, textDecoration: "none" }}>{item.title}</Link>
                      ) : (
                        <span style={{ color: "#fff", fontWeight: 600 }}>{item.title}</span>
                      )}
                      {item.detail ? <span style={{ display: "block", color: "#9d9da0", marginTop: 2 }}>{item.detail}</span> : null}
                    </div>
                    {item.meta ? <span style={{ color: "#6d6b71", whiteSpace: "nowrap", flexShrink: 0, textAlign: "right" }}>{item.meta}</span> : null}
                  </div>
                ))}
                {s.more ? (
                  <p style={{ fontSize: "0.75rem", color: "#6d6b71", margin: "0.5rem 0 0" }}>
                    + {s.more} autre(s) — <Link href={s.href} style={{ color: "#c3a6ff" }}>tout voir</Link>
                  </p>
                ) : null}
              </div>
            );
          })}

          {done.length > 0 && (
            <div style={{ ...card, background: "transparent" }}>
              <p style={{ fontWeight: 700, color: "#8a8791", margin: "0 0 0.4rem", fontSize: "0.8rem" }}>À jour</p>
              {done.map((s) => (
                <p key={s.key} style={{ fontSize: "0.78rem", color: "#6d6b71", margin: "0.25rem 0" }}>
                  <span style={{ color: "#8fce9f" }}>✓</span> {s.emptyText}{" "}
                  <Link href={s.href} style={{ color: "#8a8791" }}>{s.hrefLabel}</Link>
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
