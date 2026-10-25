import { AdminTopbar } from "@/components/admin-topbar";
import { buildAcademySnapshot, COACH_RATE_CENTS, COACHES_PER_HOUR, NARRATIVE, NARRATIVE_REVISED_ON, type Count } from "@/lib/academy-history";
import { requireAdmin } from "@/lib/admin-auth";

export const metadata = { title: "Historique de l'académie — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

const money = (cents: number | null) => (cents == null ? "—" : (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" }));
const dateFr = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
const monthFr = (ym: string) => new Date(`${ym}-15T12:00:00`).toLocaleDateString("fr-CA", { month: "long", year: "numeric" });

const card: React.CSSProperties = { background: "#100e17", border: "1px solid #251f30", borderRadius: 12, padding: "1.1rem 1.2rem", marginBottom: "1.25rem" };
const h2: React.CSSProperties = { fontSize: "1.05rem", fontWeight: 700, color: "#fff", margin: "0 0 0.8rem" };
const p: React.CSSProperties = { fontSize: "0.88rem", lineHeight: 1.65, color: "#c9c6d0", margin: "0 0 0.7rem" };
const cell: React.CSSProperties = { padding: "0.45rem 0.5rem", borderBottom: "1px solid #1f1d25", fontSize: "0.82rem", color: "#c3c2c8", textAlign: "left" };
const th: React.CSSProperties = { ...cell, color: "#8a8791", fontWeight: 600 };

function Bars({ items, total }: { items: Count[]; total?: number }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  const sum = total ?? items.reduce((s, i) => s + i.count, 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((i) => (
        <div key={i.label} style={{ display: "grid", gridTemplateColumns: "minmax(120px, 38%) 1fr 64px", gap: 8, alignItems: "center", fontSize: "0.82rem" }}>
          <span style={{ color: "#c9c6d0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.label}</span>
          <span style={{ background: "#1c1828", borderRadius: 4, height: 10 }}>
            <span style={{ display: "block", width: `${(i.count / max) * 100}%`, height: 10, borderRadius: 4, background: "#9b7ddb" }} />
          </span>
          <span style={{ color: "#fff", textAlign: "right" }}>
            {i.count} <span style={{ color: "#6d6b71" }}>({Math.round((i.count / Math.max(1, sum)) * 100)} %)</span>
          </span>
        </div>
      ))}
      {items.length === 0 && <span style={{ color: "#6d6b71", fontSize: "0.82rem" }}>Aucune donnée pour l&apos;instant.</span>}
    </div>
  );
}

export default async function AcademyHistoryPage() {
  // Données financières et personnelles : administrateur seulement.
  await requireAdmin({ roles: ["admin"] });
  const s = await buildAcademySnapshot();
  const generated = new Date(s.generatedAt).toLocaleString("fr-CA", { timeZone: "America/Toronto", dateStyle: "long", timeStyle: "short" });

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Historique de l&apos;académie</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.2rem" }}>
            Tout ce qu&apos;il faut savoir sur New Valkyria, sur une seule page. Les chiffres, la clientèle, les programmes, les enjeux détectés et la chronologie sont recalculés automatiquement à chaque ouverture (données du {generated}). Le récit a été révisé le {dateFr(NARRATIVE_REVISED_ON)}.
          </p>

          {/* Chiffres clés */}
          <div className="admin-stats" style={{ marginBottom: "1.25rem" }}>
            {s.keyFigures.map((k) => (
              <div key={k.label} className="admin-stat-card">
                <p className="admin-stat-value">{k.value}</p>
                <p className="admin-stat-label">
                  {k.label}
                  {k.hint ? ` · ${k.hint}` : ""}
                </p>
              </div>
            ))}
          </div>

          {/* Récit */}
          {NARRATIVE.map((section) => (
            <div key={section.title} style={card}>
              <p style={h2}>{section.title}</p>
              {section.paragraphs.map((t) => (
                <p key={t.slice(0, 40)} style={p}>{t}</p>
              ))}
            </div>
          ))}

          {/* Enjeux détectés */}
          <div style={card}>
            <p style={h2}>Enjeux en ce moment (détectés automatiquement)</p>
            {s.issues.length === 0 && <p style={p}>Rien à signaler.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {s.issues.map((i) => (
                <div key={i.text} style={{ display: "flex", gap: 10, fontSize: "0.86rem", color: "#ddd", lineHeight: 1.5 }}>
                  <span style={{ flex: "0 0 10px", height: 10, marginTop: 6, borderRadius: 5, background: i.level === "rouge" ? "#ff6b6b" : i.level === "orange" ? "#f0c878" : "#78a8f0" }} />
                  <span>{i.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Programmes et prix */}
          <div style={card}>
            <p style={h2}>Nos programmes et nos prix</p>
            {[
              ["Filles — saison en cours", s.programs.girls],
              ["Programmes garçons", s.programs.boys],
              ["Autres sources de revenus", s.programs.other]
            ].map(([title, lines]) => (
              <div key={title as string} className="admin-table-wrap" style={{ marginBottom: "1rem" }}>
                <p style={{ fontSize: "0.8rem", color: "#9b7ddb", margin: "0 0 0.4rem", fontWeight: 700 }}>{title as string}</p>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
                  <thead>
                    <tr>
                      <th style={th}>Programme</th>
                      <th style={th}>Pour qui</th>
                      <th style={{ ...th, textAlign: "right" }}>Prix</th>
                      <th style={{ ...th, textAlign: "right" }}>Inscrits / vendus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(lines as typeof s.programs.girls).map((l) => (
                      <tr key={l.name}>
                        <td style={{ ...cell, color: "#fff" }}>{l.name}</td>
                        <td style={cell}>{l.audience}</td>
                        <td style={{ ...cell, textAlign: "right" }}>
                          {money(l.priceCents)}
                          {l.priceNote ? <span style={{ display: "block", color: "#6d6b71", fontSize: "0.75rem" }}>{l.priceNote}</span> : null}
                        </td>
                        <td style={{ ...cell, textAlign: "right", color: "#fff" }}>
                          {l.enrolled}
                          {l.capacity ? <span style={{ color: "#6d6b71" }}> / {l.capacity}</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {/* Clientèle */}
          <div style={card}>
            <p style={h2}>Notre clientèle</p>
            <p style={p}>
              {s.clientele.families} familles actives, dont {s.clientele.siblingFamilies} avec plus d&apos;un enfant inscrit.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.4rem" }}>
              <div>
                <p style={{ fontSize: "0.8rem", color: "#9b7ddb", fontWeight: 700 }}>Filles par année de naissance</p>
                <Bars items={s.clientele.girlsByYear} />
              </div>
              <div>
                <p style={{ fontSize: "0.8rem", color: "#9b7ddb", fontWeight: 700 }}>Garçons par année de naissance</p>
                <Bars items={s.clientele.boysByYear} />
              </div>
              <div>
                <p style={{ fontSize: "0.8rem", color: "#9b7ddb", fontWeight: 700 }}>D&apos;où viennent nos familles (villes)</p>
                <Bars items={s.clientele.cities} />
              </div>
              <div>
                <p style={{ fontSize: "0.8rem", color: "#9b7ddb", fontWeight: 700 }}>Clubs d&apos;origine des joueuses</p>
                <Bars items={s.clientele.clubs} />
              </div>
              <div>
                <p style={{ fontSize: "0.8rem", color: "#9b7ddb", fontWeight: 700 }}>Comment les familles nous ont connus (été 2026)</p>
                <Bars items={s.clientele.sources} />
              </div>
            </div>
          </div>

          {/* Groupes */}
          <div style={card}>
            <p style={h2}>Remplissage des groupes (saison en cours)</p>
            <Bars items={s.groups.map((g) => ({ label: `${g.label} (${g.taken}/${g.max})`, count: g.taken }))} total={s.groups.reduce((t, g) => t + g.taken, 0)} />
          </div>

          {/* Finances */}
          {s.revenue && (
            <div style={card}>
              <p style={h2}>Finances</p>
              <div className="admin-table-wrap">
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                  <thead>
                    <tr>
                      <th style={th}>Saison</th>
                      <th style={{ ...th, textAlign: "right" }}>Revenus</th>
                      <th style={{ ...th, textAlign: "right" }}>Dépenses</th>
                      <th style={{ ...th, textAlign: "right" }}>Profit</th>
                      <th style={{ ...th, textAlign: "right" }}>Objectif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.revenue.seasons.map((r) => (
                      <tr key={r.label}>
                        <td style={{ ...cell, color: "#fff" }}>{r.label}</td>
                        <td style={{ ...cell, textAlign: "right" }}>{money(r.totalCents)}</td>
                        <td style={{ ...cell, textAlign: "right" }}>{money(r.expenseCents)}</td>
                        <td style={{ ...cell, textAlign: "right", color: r.profitCents >= 0 ? "#8fce9f" : "#ff9999" }}>{money(r.profitCents)}</td>
                        <td style={{ ...cell, textAlign: "right" }}>{r.goalCents ? money(r.goalCents) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {s.revenue.months.length > 0 && (
                <>
                  <p style={{ fontSize: "0.8rem", color: "#9b7ddb", fontWeight: 700, margin: "1rem 0 0.4rem" }}>Revenus par mois</p>
                  <Bars items={s.revenue.months.map((m) => ({ label: `${monthFr(m.month)} · ${money(m.revenueCents)}`, count: Math.round(m.revenueCents / 100) }))} />
                </>
              )}
            </div>
          )}

          {/* Marges */}
          {s.margins.length > 0 && (
            <div style={card}>
              <p style={h2}>Marges par saison</p>
              <p style={p}>
                Revenus encaissés moins les terrains et gymnases loués, l&apos;encadrement ({COACHES_PER_HOUR} entraîneurs à {money(COACH_RATE_CENTS)}/h sur chaque heure de terrain) et les autres dépenses (équipement, assurance…). Se recalcule à chaque nouveau paiement.
              </p>
              {s.margins.map((m) => (
                <div key={m.key} style={{ marginBottom: "1.3rem" }}>
                  <p style={{ fontSize: "0.9rem", color: "#fff", fontWeight: 700, margin: "0 0 0.5rem" }}>
                    {m.label}{" "}
                    <span style={{ color: m.marginCents >= 0 ? "#8fce9f" : "#ff9999" }}>
                      · marge {money(m.marginCents)}
                      {m.marginPct != null ? ` (${m.marginPct.toLocaleString("fr-CA")} %)` : ""}
                    </span>
                  </p>
                  <div className="admin-table-wrap">
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                      <tbody>
                        {[
                          ["Revenus encaissés", m.revenueCents, m.revenueNote],
                          [`Terrains et gymnases (${m.hours.toLocaleString("fr-CA")} h)`, -m.terrainCents, m.hours ? `${money(Math.round(m.terrainCents / m.hours))}/h en moyenne` : null],
                          [`Entraîneurs (${COACHES_PER_HOUR} × ${m.hours.toLocaleString("fr-CA")} h × ${money(COACH_RATE_CENTS)})`, -m.coachCents, "estimation selon l'horaire réservé"],
                          ["Autres dépenses", -m.otherCents, null],
                          ["Marge", m.marginCents, m.hours ? `coût total ${money(Math.round((m.terrainCents + m.coachCents) / m.hours))} par heure de terrain` : null]
                        ].map(([label, cents, note]) => (
                          <tr key={label as string}>
                            <td style={{ ...cell, color: label === "Marge" ? "#fff" : cell.color, fontWeight: label === "Marge" ? 700 : 400 }}>
                              {label as string}
                              {note ? <span style={{ display: "block", color: "#6d6b71", fontSize: "0.75rem" }}>{note as string}</span> : null}
                            </td>
                            <td style={{ ...cell, textAlign: "right", color: (cents as number) < 0 ? "#ff9999" : label === "Marge" ? "#8fce9f" : "#fff", fontWeight: label === "Marge" ? 700 : 400 }}>
                              {money(cents as number)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: "0.6rem", display: "flex", flexDirection: "column", gap: 4 }}>
                    {m.venues.map((v) => (
                      <p key={v.venue} style={{ fontSize: "0.78rem", color: "#8a8791", margin: 0 }}>
                        <strong style={{ color: "#c9c6d0" }}>{v.venue}</strong>
                        {v.space ? ` (${v.space})` : ""} · {v.period} · {v.schedule} · {v.hours.toLocaleString("fr-CA")} h · {money(v.total_cents)}
                        {v.tax_included ? " taxes incluses" : ""}
                        {v.payments ? ` · ${v.payments}` : ""}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Équipe et partenaires */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "1.25rem" }}>
            <div style={card}>
              <p style={h2}>L&apos;équipe</p>
              {s.team.map((t) => (
                <p key={t.name} style={{ ...p, margin: "0 0 0.5rem" }}>
                  <strong style={{ color: "#fff" }}>{t.name}</strong> — {t.role}
                  {t.contract ? <span style={{ color: "#6d6b71" }}> · contrat {t.contract === "signed" ? "signé" : t.contract === "sent" ? "à signer" : t.contract}</span> : null}
                </p>
              ))}
            </div>
            <div style={card}>
              <p style={h2}>Partenaires et commanditaires</p>
              {s.partners.length === 0 && <p style={p}>Aucun pour l&apos;instant.</p>}
              {s.partners.map((x) => (
                <p key={x.name} style={{ ...p, margin: "0 0 0.5rem" }}>
                  <strong style={{ color: "#fff" }}>{x.name}</strong> — {x.status}
                  {x.detail ? <span style={{ color: "#6d6b71" }}> · {x.detail}</span> : null}
                </p>
              ))}
            </div>
          </div>

          {/* Chronologie */}
          <div style={card}>
            <p style={h2}>Chronologie</p>
            <div style={{ borderLeft: "2px solid #2c2540", paddingLeft: "1rem", display: "flex", flexDirection: "column", gap: "0.55rem" }}>
              {s.timeline.map((t) => (
                <div key={`${t.date}-${t.text}`} style={{ fontSize: "0.84rem", color: "#c9c6d0" }}>
                  <span style={{ color: "#9b7ddb", fontWeight: 700, marginRight: 8 }}>{dateFr(t.date)}</span>
                  {t.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
