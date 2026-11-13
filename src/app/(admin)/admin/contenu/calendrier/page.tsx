import Link from "next/link";

import { ShootForm } from "@/components/jp-shoots";
import { requireAdmin } from "@/lib/admin-auth";
import { addDaysIso, ANGLES, calendarWeeks, NETWORK_LINKS, POST_KINDS, postKindLabel, weekStart } from "@/lib/content-core";
import { shortDate } from "@/lib/content-format";
import { getCalendarItems } from "@/lib/content-repo";
import { fmtInt } from "@/lib/marketing-posts-core";

export const metadata = { title: "Calendrier de publication — Création de contenu", robots: "noindex" };
export const dynamic = "force-dynamic";

const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
const KIND_COLOR: Record<string, string> = { organique: "#5fd38a", essai: "#f0c878", pub: "#ff9f6e" };

/** Espace Contenu › Calendrier de publication (P3.2.06) : 4 semaines, ce qui est prévu (tournages avec un jour de
 *  publication) et ce qui est publié (Réseaux sociaux), organique, reel d'essai ou publicité, avec son angle. */
export default async function CalendrierPage({ searchParams }: { searchParams: Promise<{ depuis?: string }> }) {
  const role = await requireAdmin();
  const sp = await searchParams;
  const today = todayIso();
  const from = weekStart(/^\d{4}-\d{2}-\d{2}$/.test(sp.depuis ?? "") ? sp.depuis! : addDaysIso(today, -7));
  const weeks = calendarWeeks(await getCalendarItems(from, addDaysIso(from, 27)), from, 4);

  return (
    <div className="admin-content">
      <div className="admin-section mda" style={{ maxWidth: 1200 }}>
        <header>
          <p className="mda-eyebrow">Tenu chaque semaine, sans trou</p>
          <h1 className="mda-h1">Calendrier de publication</h1>
          <p className="mda-lead">
            Ce qui sort, quel jour, sur quel réseau, et pourquoi (l&apos;angle). Un reel d&apos;essai teste une accroche avant d&apos;y mettre de l&apos;argent ; une publicité se mesure en
            inscriptions{role === "admin" ? <> dans <Link href="/admin/reseaux">Réseaux sociaux</Link></> : null}.
          </p>
        </header>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: "0.82rem", alignItems: "center" }}>
          {POST_KINDS.map((k) => (
            <span key={k.id} title={k.help} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ width: 10, height: 10, borderRadius: 99, background: KIND_COLOR[k.id] }} />
              {k.label}
            </span>
          ))}
          <span style={{ color: "var(--adm-text-3)" }}>Contour plein = prévu · pâle = publié</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
            <Link href={`/admin/contenu/calendrier?depuis=${addDaysIso(from, -28)}`}>← Avant</Link>
            <Link href="/admin/contenu/calendrier">Aujourd&apos;hui</Link>
            <Link href={`/admin/contenu/calendrier?depuis=${addDaysIso(from, 28)}`}>Après →</Link>
          </span>
        </div>

        {weeks.map((w) => (
          <section key={w.start} className="mda-card" style={{ padding: 12 }}>
            <h2 className="mda-h2" style={{ margin: "0 0 8px", fontSize: "0.95rem" }}>
              Semaine du {shortDate(w.start)}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 6 }}>
              {w.days.map((d) => (
                <div key={d.date} style={{ minHeight: 70, border: "1px solid var(--adm-line)", borderRadius: 10, padding: 6, background: d.date === today ? "rgba(180,155,242,0.08)" : "transparent" }}>
                  <div style={{ fontSize: "0.72rem", color: d.date === today ? "var(--adm-accent-strong, #8b5cf6)" : "var(--adm-text-3)", fontWeight: 600 }}>{shortDate(d.date)}</div>
                  <div style={{ display: "grid", gap: 4, marginTop: 4 }}>
                    {d.items.map((it, i) => (
                      <div
                        key={i}
                        title={`${postKindLabel(it.postKind)}${it.angle ? ` · ${it.angle}` : ""}${it.networks.length ? ` · ${it.networks.join(", ")}` : ""}`}
                        style={{ fontSize: "0.74rem", lineHeight: 1.3, padding: "4px 6px", borderRadius: 6, borderLeft: `3px solid ${KIND_COLOR[it.postKind] ?? KIND_COLOR.organique}`, background: it.kind === "prevu" ? "var(--adm-surface)" : "transparent", opacity: it.kind === "publie" ? 0.7 : 1, color: "var(--adm-text)" }}
                      >
                        {it.kind === "publie" ? "✓ " : ""}
                        {it.title}
                        {it.kind === "publie" && it.views ? <span style={{ color: "var(--adm-text-3)" }}> · {fmtInt(it.views)} vues</span> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="mda-card">
          <h2 className="mda-h2" style={{ marginTop: 0 }}>Ajouter au calendrier</h2>
          <p style={{ margin: "0 0 10px", fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
            Chaque publication prévue est un tournage avec un jour de publication. Angles suggérés : {ANGLES.join(" · ")}.
          </p>
          <ShootForm endpoint="/api/admin/contenu" calendar />
        </section>

        <section className="mda-card">
          <h2 className="mda-h2" style={{ marginTop: 0 }}>🔌 Brancher nos réseaux (à venir)</h2>
          <p style={{ margin: "0 0 10px", fontSize: "0.85rem", color: "var(--adm-text-2)" }}>
            Pour l&apos;instant les vues et les abonnés s&apos;entrent à la main. Une fois les comptes reliés, la portée de chaque publication arrivera toute seule ici.
          </p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Réseau</th>
                  <th>Ce qu&apos;on irait chercher</th>
                  <th>Ce qu&apos;il faut</th>
                </tr>
              </thead>
              <tbody>
                {NETWORK_LINKS.map((n) => (
                  <tr key={n.network}>
                    <td>
                      <strong>{n.network}</strong>
                    </td>
                    <td style={{ fontSize: "0.84rem" }}>{n.how}</td>
                    <td style={{ fontSize: "0.84rem" }}>{n.needs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
