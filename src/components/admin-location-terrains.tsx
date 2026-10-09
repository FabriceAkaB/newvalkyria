"use client";

import { useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import { formatMoney } from "@/lib/private-programs";
import type { RentalBlock, RentableTerrain, TerrainRental } from "@/lib/terrain-rentals-repo";
import type { RentalWindow } from "@/lib/terrain-rentals-core";

type Rental = TerrainRental & { terrain_name: string };
interface Data {
  terrains: RentableTerrain[];
  windows: RentalWindow[];
  blocks: RentalBlock[];
  rentals: Rental[];
}

const WEEKDAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const STATUS: Record<string, [string, string]> = { pending: ["En attente", "#f0c878"], paid: ["Payée", "#8fce9f"], cancelled: ["Annulée", "#ff9999"] };

export function AdminLocationTerrains({ initial, origin }: { initial: Data; origin: string }) {
  const [data, setData] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [win, setWin] = useState({ terrainId: initial.terrains[0]?.id ?? "", kind: "weekly", weekday: "6", specificDate: "", startTime: "09:00", endTime: "12:00", slotMinutes: "90", price: "", validFrom: "", validUntil: "" });
  const [block, setBlock] = useState({ terrainId: initial.terrains[0]?.id ?? "", blockDate: "", startTime: "", endTime: "", reason: "" });
  const [desc, setDesc] = useState<Record<string, string>>({});

  const flash = (m: string) => {
    setMessage(m);
    setTimeout(() => setMessage(null), 4500);
  };

  const call = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/location-terrains", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Erreur");
      const fresh = await fetch("/api/admin/location-terrains").then((r) => r.json());
      setData(fresh);
      flash(json.refunded ? `${ok} — remboursée via Stripe.` : ok);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const terrainName = (id: string) => data.terrains.find((t) => t.id === id)?.name ?? "—";
  const card: React.CSSProperties = { background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "1rem", marginBottom: "1.25rem" };
  const cell: React.CSSProperties = { padding: "0.45rem 0.5rem", borderBottom: "1px solid #1f1d25", color: "#c3c2c8", verticalAlign: "top", fontSize: "0.76rem" };
  const paidTotal = data.rentals.filter((r) => r.status === "paid").reduce((s, r) => s + r.price_cents, 0);
  const upcoming = data.rentals.filter((r) => r.status === "paid" && r.rental_date >= new Date().toISOString().slice(0, 10)).length;

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Location de terrains</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1rem" }}>
            Page publique : <a href={`${origin}/location-terrains`} target="_blank" rel="noreferrer" style={{ color: "#c4a4e4" }}>{origin}/location-terrains</a>. Les tarifs, plages et dates ci-dessous sont à valider — rien n&apos;est offert tant qu&apos;un terrain n&apos;est pas marqué « à louer » avec au moins une plage.
          </p>
          {message && <p style={{ fontSize: "0.78rem", color: "#8fce9f" }}>{message}</p>}

          <div className="admin-stats" style={{ marginBottom: "1.25rem" }}>
            <div className="admin-stat-card"><p className="admin-stat-value">{formatMoney(paidTotal)}</p><p className="admin-stat-label">Encaissé (locations)</p></div>
            <div className="admin-stat-card"><p className="admin-stat-value">{upcoming}</p><p className="admin-stat-label">Réservations à venir</p></div>
            <div className="admin-stat-card"><p className="admin-stat-value">{data.terrains.filter((t) => t.rentable).length}</p><p className="admin-stat-label">Terrains à louer</p></div>
          </div>

          {/* ── Terrains ── */}
          <div style={card}>
            <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.7rem" }}>Terrains</p>
            {data.terrains.length === 0 && <p className="admin-empty-text">Aucun terrain. Ajoutez-en dans la section Calendrier → Terrains.</p>}
            {data.terrains.map((t) => (
              <div key={t.id} style={{ borderBottom: "1px solid #1f1d25", padding: "0.6rem 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ color: "#fff", fontWeight: 600 }}>{t.name}<span style={{ color: "#6d6b71", fontWeight: 400 }}>{t.address ? ` — ${t.address}` : ""}</span></span>
                  <label style={{ fontSize: "0.76rem", color: "#c3c2c8", display: "flex", gap: "0.4rem", alignItems: "center" }}>
                    <input type="checkbox" checked={t.rentable} disabled={busy} onChange={(e) => call({ action: "terrain_update", terrainId: t.id, rentable: e.target.checked }, e.target.checked ? "Terrain offert à la location." : "Terrain retiré de la location.")} />
                    À louer
                  </label>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem" }}>
                  <input className="admin-input" style={{ flex: 1 }} placeholder="Description affichée au public (surface, vestiaires, stationnement…)" value={desc[t.id] ?? t.rental_description ?? ""} onChange={(e) => setDesc({ ...desc, [t.id]: e.target.value })} />
                  <button className="admin-btn-ghost" style={{ fontSize: "0.7rem" }} disabled={busy} onClick={() => call({ action: "terrain_update", terrainId: t.id, rental_description: desc[t.id] ?? t.rental_description ?? "" }, "Description enregistrée.")}>Enregistrer</button>
                </div>
              </div>
            ))}
          </div>

          {/* ── Plages ── */}
          <div style={card}>
            <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.7rem" }}>Plages horaires offertes</p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "0.9rem" }}>
              <label style={{ fontSize: "0.66rem", color: "#9d9da0" }}>Terrain
                <select className="admin-group-select" value={win.terrainId} onChange={(e) => setWin({ ...win, terrainId: e.target.value })}>
                  {data.terrains.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              <label style={{ fontSize: "0.66rem", color: "#9d9da0" }}>Type
                <select className="admin-group-select" value={win.kind} onChange={(e) => setWin({ ...win, kind: e.target.value })}>
                  <option value="weekly">Chaque semaine</option>
                  <option value="date">Date précise</option>
                </select>
              </label>
              {win.kind === "weekly" ? (
                <label style={{ fontSize: "0.66rem", color: "#9d9da0" }}>Jour
                  <select className="admin-group-select" value={win.weekday} onChange={(e) => setWin({ ...win, weekday: e.target.value })}>
                    {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                  </select>
                </label>
              ) : (
                <label style={{ fontSize: "0.66rem", color: "#9d9da0" }}>Date<input type="date" className="admin-input" value={win.specificDate} onChange={(e) => setWin({ ...win, specificDate: e.target.value })} /></label>
              )}
              <label style={{ fontSize: "0.66rem", color: "#9d9da0" }}>De<input type="time" className="admin-input" value={win.startTime} onChange={(e) => setWin({ ...win, startTime: e.target.value })} /></label>
              <label style={{ fontSize: "0.66rem", color: "#9d9da0" }}>À<input type="time" className="admin-input" value={win.endTime} onChange={(e) => setWin({ ...win, endTime: e.target.value })} /></label>
              <label style={{ fontSize: "0.66rem", color: "#9d9da0" }}>Durée d&apos;un créneau (min)<input type="number" className="admin-input" style={{ width: "90px" }} value={win.slotMinutes} onChange={(e) => setWin({ ...win, slotMinutes: e.target.value })} /></label>
              <label style={{ fontSize: "0.66rem", color: "#9d9da0" }}>Prix par créneau ($)<input type="number" step="0.01" className="admin-input" style={{ width: "110px" }} value={win.price} onChange={(e) => setWin({ ...win, price: e.target.value })} /></label>
              <label style={{ fontSize: "0.66rem", color: "#9d9da0" }}>Valide du<input type="date" className="admin-input" value={win.validFrom} onChange={(e) => setWin({ ...win, validFrom: e.target.value })} /></label>
              <label style={{ fontSize: "0.66rem", color: "#9d9da0" }}>au<input type="date" className="admin-input" value={win.validUntil} onChange={(e) => setWin({ ...win, validUntil: e.target.value })} /></label>
              <button
                className="admin-btn-primary"
                style={{ fontSize: "0.74rem" }}
                disabled={busy}
                onClick={() => {
                  const price = parseFloat(win.price.replace(",", "."));
                  if (!win.terrainId || !Number.isFinite(price) || price < 0 || (win.kind === "date" && !win.specificDate)) {
                    flash("Terrain, prix et (date ou jour) sont requis.");
                    return;
                  }
                  call(
                    { action: "window_create", terrainId: win.terrainId, weekday: win.kind === "weekly" ? win.weekday : null, specificDate: win.kind === "date" ? win.specificDate : null, startTime: win.startTime, endTime: win.endTime, slotMinutes: win.slotMinutes, priceCents: Math.round(price * 100), validFrom: win.validFrom, validUntil: win.validUntil },
                    "Plage ajoutée."
                  );
                }}
              >
                + Ajouter la plage
              </button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {data.windows.map((w) => (
                  <tr key={w.id} style={{ opacity: w.active ? 1 : 0.5 }}>
                    <td style={cell}>{terrainName(w.terrain_id)}</td>
                    <td style={cell}>{w.specific_date ? `Le ${w.specific_date}` : `Chaque ${WEEKDAYS[w.weekday ?? 0].toLowerCase()}`}{w.valid_from || w.valid_until ? ` (${w.valid_from ?? "…"} → ${w.valid_until ?? "…"})` : ""}</td>
                    <td style={cell}>{w.start_time} – {w.end_time} · créneaux de {w.slot_minutes} min</td>
                    <td style={cell}>{formatMoney(w.price_cents)} / créneau</td>
                    <td style={cell}>
                      <button className="admin-btn-ghost" style={{ fontSize: "0.66rem" }} disabled={busy} onClick={() => call({ action: "window_update", windowId: w.id, active: !w.active }, w.active ? "Plage désactivée." : "Plage activée.")}>{w.active ? "Désactiver" : "Activer"}</button>{" "}
                      <button className="admin-btn-ghost" style={{ fontSize: "0.66rem", color: "#ff9999" }} disabled={busy} onClick={() => confirm("Supprimer cette plage ?") && call({ action: "window_delete", windowId: w.id }, "Plage supprimée.")}>Supprimer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.windows.length === 0 && <p className="admin-empty-text">Aucune plage configurée.</p>}
          </div>

          {/* ── Dates bloquées ── */}
          <div style={card}>
            <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.7rem" }}>Dates bloquées</p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "0.8rem" }}>
              <select className="admin-group-select" value={block.terrainId} onChange={(e) => setBlock({ ...block, terrainId: e.target.value })}>
                {data.terrains.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <input type="date" className="admin-input" value={block.blockDate} onChange={(e) => setBlock({ ...block, blockDate: e.target.value })} />
              <input type="time" className="admin-input" value={block.startTime} onChange={(e) => setBlock({ ...block, startTime: e.target.value })} title="Début (vide = toute la journée)" />
              <input type="time" className="admin-input" value={block.endTime} onChange={(e) => setBlock({ ...block, endTime: e.target.value })} title="Fin (vide = toute la journée)" />
              <input className="admin-input" placeholder="Raison (facultatif)" value={block.reason} onChange={(e) => setBlock({ ...block, reason: e.target.value })} />
              <button className="admin-btn-primary" style={{ fontSize: "0.74rem" }} disabled={busy || !block.blockDate} onClick={() => call({ action: "block_create", ...block }, "Date bloquée.")}>Bloquer</button>
            </div>
            {data.blocks.map((b) => (
              <div key={b.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", color: "#c3c2c8", padding: "0.25rem 0", borderBottom: "1px solid #1f1d25" }}>
                <span>{terrainName(b.terrain_id)} · {b.block_date}{b.start_time ? ` ${b.start_time}–${b.end_time}` : " (journée complète)"}{b.reason ? ` — ${b.reason}` : ""}</span>
                <button className="admin-btn-ghost" style={{ fontSize: "0.66rem", color: "#ff9999" }} disabled={busy} onClick={() => call({ action: "block_delete", blockId: b.id }, "Blocage retiré.")}>Retirer</button>
              </div>
            ))}
          </div>

          {/* ── Réservations et paiements ── */}
          <div style={card}>
            <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.7rem" }}>Réservations et paiements ({data.rentals.length})</p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "820px" }}>
                <thead><tr>{["Date", "Terrain", "Organisation / contact", "Montant", "Statut", ""].map((h) => <th key={h} style={{ ...cell, color: "#9d9da0", fontWeight: 600, textAlign: "left" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {data.rentals.map((r) => (
                    <tr key={r.id} style={{ opacity: r.status === "cancelled" ? 0.5 : 1 }}>
                      <td style={cell}>{r.rental_date}<br />{r.start_time} – {r.end_time}</td>
                      <td style={cell}>{r.terrain_name}</td>
                      <td style={cell}><strong style={{ color: "#fff" }}>{r.organization_name}</strong><br />{r.contact_name} · {r.contact_email} · {r.contact_phone}{r.notes ? <><br /><em>{r.notes}</em></> : null}</td>
                      <td style={cell}>{formatMoney(r.price_cents)}</td>
                      <td style={cell}><span style={{ color: STATUS[r.status][1], fontWeight: 700 }}>{STATUS[r.status][0]}</span>{r.cancelled_reason ? <><br /><span style={{ color: "#6d6b71" }}>{r.cancelled_reason}</span></> : null}</td>
                      <td style={cell}>
                        {r.status === "paid" && (
                          <>
                            <button className="admin-btn-ghost" style={{ fontSize: "0.66rem" }} disabled={busy} onClick={() => call({ action: "rental_resend", rentalId: r.id }, "Confirmation renvoyée.")}>Renvoyer la confirmation</button>{" "}
                            <button className="admin-btn-ghost" style={{ fontSize: "0.66rem", color: "#ff9999" }} disabled={busy} onClick={() => confirm(`Annuler et rembourser ${formatMoney(r.price_cents)} ?`) && call({ action: "rental_cancel", rentalId: r.id, refund: true }, "Réservation annulée")}>Annuler + rembourser</button>
                          </>
                        )}
                        {r.status === "pending" && (
                          <button className="admin-btn-ghost" style={{ fontSize: "0.66rem", color: "#ff9999" }} disabled={busy} onClick={() => confirm("Libérer ce créneau ?") && call({ action: "rental_cancel", rentalId: r.id, refund: false }, "Créneau libéré.")}>Libérer</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.rentals.length === 0 && <p className="admin-empty-text">Aucune réservation pour l&apos;instant.</p>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
