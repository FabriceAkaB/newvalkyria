"use client";

import { useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import { formatMoney } from "@/lib/private-programs";
import type { MatchBooking, MatchSlot } from "@/lib/match-slots-repo";

type Slot = MatchSlot & { available: boolean };
type Booking = MatchBooking & { slot: MatchSlot };
const STATUS: Record<string, [string, string]> = { pending: ["En attente", "#f0c878"], paid: ["Payée", "#8fce9f"], cancelled: ["Annulée", "#ff9999"] };

export function AdminMatchs({ initial, origin }: { initial: { slots: Slot[]; bookings: Booking[] }; origin: string }) {
  const [data, setData] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [ns, setNs] = useState({ date: "", start: "17:30", end: "18:30", location: "Complexe sportif Terrebonne, Centre de soccer multifonctionnel, terrain #4 – 2475, boul. des Entreprises, Terrebonne J6X 4J9", field: "Terrain n° 4", price: "100" });
  const today = new Date().toISOString().slice(0, 10);
  const link = `${origin}/prive/matchs`;

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 4500);
  };

  const call = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/matchs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Erreur");
      setData(await fetch("/api/admin/matchs").then((r) => r.json()));
      flash(json.refunded ? `${ok} — remboursée via Stripe.` : ok);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const takenBy = (slotId: string) => data.bookings.find((b) => b.slot_id === slotId && (b.status === "paid" || b.status === "pending"));
  const slots = data.slots.filter((s) => showPast || s.slot_date >= today);
  const paidCents = data.bookings.filter((b) => b.status === "paid").reduce((n, b) => n + b.price_cents, 0);
  const cell: React.CSSProperties = { padding: "0.45rem 0.5rem", borderBottom: "1px solid #1f1d25", fontSize: "0.76rem", color: "#c3c2c8", verticalAlign: "top" };
  const card: React.CSSProperties = { background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "1rem", marginBottom: "1.25rem" };

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Matchs vendus aux académies</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1rem" }}>
            Page de réservation à envoyer aux équipes extérieures :{" "}
            <a href={link} target="_blank" rel="noreferrer" style={{ color: "#c4a4e4" }}>{link}</a>{" "}
            <button className="admin-btn-ghost" style={{ fontSize: "0.68rem" }} onClick={() => navigator.clipboard.writeText(link).then(() => flash("Lien copié."))}>Copier</button>
            <br />Règles automatiques : 100 $ par plage pour confirmer, 2 plages maximum par équipe (même nom d&apos;académie ou même courriel).
          </p>
          {msg && <p style={{ fontSize: "0.78rem", color: "#8fce9f" }}>{msg}</p>}

          <div className="admin-stats" style={{ marginBottom: "1.2rem" }}>
            <div className="admin-stat-card"><p className="admin-stat-value">{data.slots.filter((s) => s.active && s.slot_date >= today).length}</p><p className="admin-stat-label">Plages à venir</p></div>
            <div className="admin-stat-card"><p className="admin-stat-value">{data.bookings.filter((b) => b.status === "paid" && b.slot.slot_date >= today).length}</p><p className="admin-stat-label">Vendues (à venir)</p></div>
            <div className="admin-stat-card"><p className="admin-stat-value">{formatMoney(paidCents)}</p><p className="admin-stat-label">Encaissé</p></div>
          </div>

          {/* ── Réservations ── */}
          <div style={card}>
            <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.6rem" }}>Réservations ({data.bookings.length})</p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "820px" }}>
                <thead><tr>{["Match", "Académie / équipe", "Contact", "Montant", "Statut", ""].map((h) => <th key={h} style={{ ...cell, color: "#9d9da0", textAlign: "left", fontWeight: 600 }}>{h}</th>)}</tr></thead>
                <tbody>
                  {data.bookings.map((b) => (
                    <tr key={b.id} style={{ opacity: b.status === "cancelled" ? 0.5 : 1 }}>
                      <td style={cell}>{b.slot.slot_date}<br />{b.slot.start_time} – {b.slot.end_time}</td>
                      <td style={cell}><strong style={{ color: "#fff" }}>{b.org_name}</strong><br />{b.team_label}{b.notes ? <><br /><em>{b.notes}</em></> : null}</td>
                      <td style={cell}>{b.contact_name}<br />{b.contact_email}<br />{b.contact_phone}</td>
                      <td style={cell}>{formatMoney(b.price_cents)}</td>
                      <td style={cell}><span style={{ color: STATUS[b.status][1], fontWeight: 700 }}>{STATUS[b.status][0]}</span>{b.cancelled_reason ? <><br /><span style={{ color: "#6d6b71" }}>{b.cancelled_reason}</span></> : null}</td>
                      <td style={cell}>
                        {b.status === "pending" && <button className="admin-btn-ghost" style={{ fontSize: "0.66rem" }} disabled={busy} onClick={() => confirm("Marquer comme payée (paiement reçu hors ligne) ?") && call({ action: "booking_mark_paid", bookingId: b.id }, "Marquée payée.")}>Marquer payée</button>}{" "}
                        {b.status === "paid" && <button className="admin-btn-ghost" style={{ fontSize: "0.66rem" }} disabled={busy} onClick={() => call({ action: "booking_resend", bookingId: b.id }, "Confirmation renvoyée.")}>Renvoyer la confirmation</button>}{" "}
                        {b.status !== "cancelled" && <button className="admin-btn-ghost" style={{ fontSize: "0.66rem", color: "#ff9999" }} disabled={busy} onClick={() => confirm(b.status === "paid" ? `Annuler et rembourser ${formatMoney(b.price_cents)} ?` : "Libérer cette plage ?") && call({ action: "booking_cancel", bookingId: b.id, refund: b.status === "paid" }, "Annulée")}>{b.status === "paid" ? "Annuler + rembourser" : "Libérer"}</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.bookings.length === 0 && <p className="admin-empty-text">Aucune réservation pour l&apos;instant.</p>}
            </div>
          </div>

          {/* ── Plages ── */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.7rem" }}>
              <p style={{ fontWeight: 700, color: "#fff", margin: 0 }}>Plages de match ({slots.length})</p>
              <label style={{ fontSize: "0.72rem", color: "#9d9da0" }}><input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} /> Afficher les plages passées</label>
            </div>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.9rem" }}>
              <input type="date" className="admin-input" value={ns.date} onChange={(e) => setNs({ ...ns, date: e.target.value })} />
              <input type="time" className="admin-input" value={ns.start} onChange={(e) => setNs({ ...ns, start: e.target.value })} />
              <input type="time" className="admin-input" value={ns.end} onChange={(e) => setNs({ ...ns, end: e.target.value })} />
              <input className="admin-input" style={{ flex: 1, minWidth: "180px" }} value={ns.location} onChange={(e) => setNs({ ...ns, location: e.target.value })} />
              <input className="admin-input" style={{ width: "90px" }} title="Prix ($)" value={ns.price} onChange={(e) => setNs({ ...ns, price: e.target.value })} />
              <button className="admin-btn-primary" style={{ fontSize: "0.72rem" }} disabled={busy || !ns.date} onClick={() => call({ action: "slot_create", date: ns.date, start: ns.start, end: ns.end, location: ns.location, field: ns.field, priceCents: Math.round((parseFloat(ns.price.replace(",", ".")) || 100) * 100) }, "Plage ajoutée.")}>+ Ajouter une plage</button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {slots.map((s) => {
                  const b = takenBy(s.id);
                  return (
                    <tr key={s.id} style={{ opacity: s.active ? 1 : 0.5 }}>
                      <td style={cell}>{new Date(s.slot_date + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</td>
                      <td style={cell}>{s.start_time} – {s.end_time}</td>
                      <td style={cell}>{s.field_label ?? s.location.split("–")[0]}</td>
                      <td style={cell}>
                        <input
                          className="admin-input"
                          style={{ width: "80px" }}
                          defaultValue={(s.price_cents / 100).toString()}
                          onBlur={(e) => {
                            const cents = Math.round((parseFloat(e.target.value.replace(",", ".")) || 0) * 100);
                            if (cents !== s.price_cents) call({ action: "slot_update", slotId: s.id, priceCents: cents }, "Prix mis à jour.");
                          }}
                        /> $
                      </td>
                      <td style={cell}>{b ? <span style={{ color: STATUS[b.status][1], fontWeight: 700 }}>{b.status === "paid" ? "Vendue" : "En paiement"} — {b.org_name}</span> : <span style={{ color: "#8fce9f" }}>Libre</span>}</td>
                      <td style={cell}>
                        <button className="admin-btn-ghost" style={{ fontSize: "0.66rem" }} disabled={busy} onClick={() => call({ action: "slot_update", slotId: s.id, active: !s.active }, s.active ? "Plage masquée." : "Plage affichée.")}>{s.active ? "Masquer" : "Afficher"}</button>{" "}
                        {!b && <button className="admin-btn-ghost" style={{ fontSize: "0.66rem", color: "#ff9999" }} disabled={busy} onClick={() => confirm("Supprimer cette plage ?") && call({ action: "slot_delete", slotId: s.id }, "Plage supprimée.")}>Supprimer</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
