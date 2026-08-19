"use client";

import { useState } from "react";

import { AdminTopbar } from "@/components/admin-topbar";
import type { Coach } from "@/lib/coaches-repo";
import type { BookingWithSlot, PrivateSessionSlot } from "@/lib/private-sessions-repo";
import type { Terrain } from "@/lib/terrains-repo";

const STATUS_LABELS: Record<string, string> = { open: "Ouvert", booked: "Réservé", closed: "Fermé" };
const STATUS_COLORS: Record<string, string> = { open: "#7fd88f", booked: "#c3a6ff", closed: "#6d6b71" };

function ManualBookingModal({ slot, onClose, onBooked }: { slot: PrivateSessionSlot; onClose: () => void; onBooked: () => void }) {
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!parentName.trim() || !parentEmail.trim()) {
      setError("Nom et courriel du parent requis.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/private-sessions/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId: slot.id, parentName: parentName.trim(), parentEmail: parentEmail.trim(), parentPhone: parentPhone.trim() || null, notes: notes.trim() || null })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Erreur");
      onBooked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal-box">
        <p className="admin-modal-title">Réserver manuellement</p>
        <p style={{ fontSize: "0.75rem", color: "#6d6b71", marginBottom: "1rem" }}>
          {slot.slot_date} · {slot.public_start_time.slice(0, 5)}–{slot.public_end_time.slice(0, 5)}
        </p>
        {error && <p className="admin-error" style={{ marginBottom: "0.75rem" }}>{error}</p>}
        <label className="admin-field" style={{ gap: "0.3rem" }}>
          <span>Nom du parent</span>
          <input className="admin-input" value={parentName} onChange={(e) => setParentName(e.target.value)} />
        </label>
        <label className="admin-field" style={{ gap: "0.3rem", marginTop: "0.6rem" }}>
          <span>Courriel</span>
          <input className="admin-input" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} />
        </label>
        <label className="admin-field" style={{ gap: "0.3rem", marginTop: "0.6rem" }}>
          <span>Téléphone (facultatif)</span>
          <input className="admin-input" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} />
        </label>
        <label className="admin-field" style={{ gap: "0.3rem", marginTop: "0.6rem" }}>
          <span>Notes (facultatif)</span>
          <input className="admin-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.25rem" }}>
          <button onClick={onClose} className="admin-btn-ghost">Annuler</button>
          <button onClick={submit} disabled={saving} className="admin-btn-primary">{saving ? "..." : "Réserver"}</button>
        </div>
      </div>
    </div>
  );
}

export function AdminSeancesPrivees({
  initialSlots,
  initialBookings,
  terrains,
  coaches
}: {
  initialSlots: PrivateSessionSlot[];
  initialBookings: BookingWithSlot[];
  terrains: Terrain[];
  coaches: Coach[];
}) {
  const [slots, setSlots] = useState(initialSlots);
  const [bookings, setBookings] = useState(initialBookings);
  const [slotDate, setSlotDate] = useState("");
  const [publicStartTime, setPublicStartTime] = useState("");
  const [location, setLocation] = useState("");
  const [terrainId, setTerrainId] = useState("");
  const [coachId, setCoachId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingModalSlot, setBookingModalSlot] = useState<PrivateSessionSlot | null>(null);

  const refresh = async () => {
    const [slotsRes, bookingsRes] = await Promise.all([
      fetch("/api/admin/private-sessions/slots").then((r) => r.json()),
      fetch("/api/admin/private-sessions/bookings").then((r) => r.json())
    ]);
    setSlots(slotsRes.slots ?? []);
    setBookings(bookingsRes.bookings ?? []);
  };

  const addSlot = async () => {
    if (!slotDate || !publicStartTime) {
      setError("Date et heure de début requises.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/private-sessions/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotDate, publicStartTime, location: location.trim() || null, terrainId: terrainId || null, coachId: coachId || null })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Erreur d'ajout — ce créneau chevauche peut-être un autre bloc de 1h30");
      setSlotDate("");
      setPublicStartTime("");
      setLocation("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const closeSlot = async (id: string) => {
    const reason = prompt("Raison (facultatif) :") ?? "";
    await fetch(`/api/admin/private-sessions/slots/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close", closedReason: reason || null })
    });
    await refresh();
  };

  const reopenSlot = async (id: string) => {
    await fetch(`/api/admin/private-sessions/slots/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reopen" })
    });
    await refresh();
  };

  const cancelBooking = async (id: string) => {
    if (!confirm("Annuler cette réservation ? Le créneau redeviendra disponible.")) return;
    await fetch(`/api/admin/private-sessions/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" })
    });
    await refresh();
  };

  const terrainName = (id: string | null) => terrains.find((t) => t.id === id)?.name ?? null;
  const coachName = (id: string | null) => {
    const c = coaches.find((c) => c.id === id);
    return c ? `${c.first_name} ${c.last_name}` : null;
  };

  const activeBookingBySlot = new Map(bookings.filter((b) => b.status === "reserved").map((b) => [b.slot_id, b]));

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Séances privées / One-on-One</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.25rem" }}>
            Créneaux de réservation individuelle pour l&apos;Espace membre — 1h vendue au parent, 1h30 bloquée en interne (rangement/préparation).
          </p>

          {error && <p className="admin-error" style={{ marginBottom: "1rem" }}>{error}</p>}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.5rem", alignItems: "flex-end" }}>
            <label className="admin-field" style={{ gap: "0.2rem" }}>
              <span style={{ fontSize: "0.68rem" }}>Date</span>
              <input type="date" className="admin-input" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} />
            </label>
            <label className="admin-field" style={{ gap: "0.2rem" }}>
              <span style={{ fontSize: "0.68rem" }}>Heure de début (publique, 1h)</span>
              <input type="time" className="admin-input" value={publicStartTime} onChange={(e) => setPublicStartTime(e.target.value)} />
            </label>
            <label className="admin-field" style={{ gap: "0.2rem" }}>
              <span style={{ fontSize: "0.68rem" }}>Lieu (texte)</span>
              <input className="admin-input" value={location} onChange={(e) => setLocation(e.target.value)} style={{ width: "10rem" }} />
            </label>
            <label className="admin-field" style={{ gap: "0.2rem" }}>
              <span style={{ fontSize: "0.68rem" }}>Terrain</span>
              <select className="admin-input" value={terrainId} onChange={(e) => setTerrainId(e.target.value)}>
                <option value="">—</option>
                {terrains.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label className="admin-field" style={{ gap: "0.2rem" }}>
              <span style={{ fontSize: "0.68rem" }}>Entraîneur</span>
              <select className="admin-input" value={coachId} onChange={(e) => setCoachId(e.target.value)}>
                <option value="">—</option>
                {coaches.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </label>
            <button onClick={addSlot} disabled={saving} className="admin-btn-primary">{saving ? "..." : "+ Créer le créneau"}</button>
          </div>

          {slots.length === 0 && <p className="admin-empty-text">Aucun créneau configuré.</p>}

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {slots.map((s) => {
              const booking = activeBookingBySlot.get(s.id);
              return (
                <div key={s.id} style={{ background: "#100e17", border: "1px solid #1f1d25", borderRadius: "8px", padding: "0.7rem 0.9rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
                    <div>
                      <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "#fff", margin: 0 }}>
                        {s.slot_date} · {s.public_start_time.slice(0, 5)}–{s.public_end_time.slice(0, 5)}
                        <span style={{ fontSize: "0.68rem", color: "#6d6b71", marginLeft: "0.5rem" }}>
                          (bloc admin {s.admin_start_time.slice(0, 5)}–{s.admin_end_time.slice(0, 5)})
                        </span>
                      </p>
                      <p style={{ fontSize: "0.72rem", color: "#6d6b71", margin: "0.15rem 0 0" }}>
                        {[terrainName(s.terrain_id) ?? s.location, coachName(s.coach_id)].filter(Boolean).join(" · ") || "—"}
                      </p>
                      {s.status === "closed" && s.closed_reason && (
                        <p style={{ fontSize: "0.7rem", color: "#ff9999", margin: "0.15rem 0 0" }}>Fermé : {s.closed_reason}</p>
                      )}
                      {booking && (
                        <p style={{ fontSize: "0.75rem", color: "#c3a6ff", margin: "0.4rem 0 0" }}>
                          Réservé par {booking.parent_name} ({booking.parent_email}){booking.notes ? ` — ${booking.notes}` : ""}
                        </p>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                      <span
                        className="admin-badge"
                        style={{ background: `${STATUS_COLORS[s.status]}22`, color: STATUS_COLORS[s.status], borderColor: `${STATUS_COLORS[s.status]}55` }}
                      >
                        {STATUS_LABELS[s.status]}
                      </span>
                      {s.status === "open" && (
                        <>
                          <button onClick={() => setBookingModalSlot(s)} className="admin-btn-ghost" style={{ fontSize: "0.7rem", padding: "0.35rem 0.7rem" }}>
                            Réserver manuellement
                          </button>
                          <button onClick={() => closeSlot(s.id)} className="admin-btn-ghost" style={{ fontSize: "0.7rem", padding: "0.35rem 0.7rem" }}>
                            Fermer
                          </button>
                        </>
                      )}
                      {s.status === "booked" && booking && (
                        <button onClick={() => cancelBooking(booking.id)} style={{ fontSize: "0.7rem", color: "#ff9999", background: "none", border: "1px solid rgba(255,100,100,0.3)", borderRadius: "6px", padding: "0.35rem 0.7rem", cursor: "pointer" }}>
                          Annuler la réservation
                        </button>
                      )}
                      {s.status === "closed" && (
                        <button onClick={() => reopenSlot(s.id)} className="admin-btn-ghost" style={{ fontSize: "0.7rem", padding: "0.35rem 0.7rem" }}>
                          Rouvrir
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {bookingModalSlot && (
        <ManualBookingModal
          slot={bookingModalSlot}
          onClose={() => setBookingModalSlot(null)}
          onBooked={async () => {
            setBookingModalSlot(null);
            await refresh();
          }}
        />
      )}
    </>
  );
}
