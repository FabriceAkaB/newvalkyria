"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Container } from "@/components/container";
import { formatMoney } from "@/lib/private-programs";

interface Terrain {
  id: string;
  name: string;
  address: string | null;
  rental_description: string | null;
}

interface Slot {
  windowId: string;
  start: string;
  end: string;
  priceCents: number;
  available: boolean;
}

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function monthLabel(year: number, month: number): string {
  const label = new Date(year, month, 1).toLocaleDateString("fr-CA", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function TerrainRentalContent({ terrains, cancelled }: { terrains: Terrain[]; cancelled: boolean }) {
  const today = new Date();
  const [terrainId, setTerrainId] = useState(terrains[0]?.id ?? "");
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [slots, setSlots] = useState<Record<string, Slot[]>>({});
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [form, setForm] = useState({ organizationName: "", contactName: "", contactEmail: "", contactPhone: "", notes: "" });
  const [terms, setTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(cancelled ? "Le paiement a été annulé. Votre créneau n'est pas réservé." : null);

  const terrain = terrains.find((t) => t.id === terrainId);

  const load = useCallback(async () => {
    if (!terrainId) return;
    setLoading(true);
    const from = `${year}-${pad(month + 1)}-01`;
    const last = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${pad(month + 1)}-${pad(last)}`;
    try {
      const res = await fetch(`/api/terrains/disponibilites?terrainId=${terrainId}&from=${from}&to=${to}`);
      const json = await res.json();
      setSlots(json.slots ?? {});
    } finally {
      setLoading(false);
    }
  }, [terrainId, year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const grid = useMemo(() => {
    const first = new Date(year, month, 1);
    const days = new Date(year, month + 1, 0).getDate();
    const blanks = (first.getDay() + 6) % 7;
    const cells: (number | null)[] = [...Array(blanks).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const prev = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); } else setMonth((m) => m - 1);
    setDate(null); setSlot(null);
  };
  const next = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); } else setMonth((m) => m + 1);
    setDate(null); setSlot(null);
  };

  const submit = async () => {
    setError(null);
    if (!slot || !date) return;
    if (!form.organizationName || !form.contactName || !form.contactEmail || !form.contactPhone) {
      setError("Merci de remplir tous les champs obligatoires.");
      return;
    }
    if (!terms) {
      setError("Vous devez accepter les conditions de location.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/terrains/reserver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terrainId, date, start: slot.start, end: slot.end, ...form, termsAccepted: terms })
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        if (json?.code === "slot_unavailable") {
          setSlot(null);
          await load();
        }
        throw new Error(json?.error ?? "Erreur de réservation");
      }
      window.location.href = json.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setSubmitting(false);
    }
  };

  const card: React.CSSProperties = { background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "1rem 1.1rem", marginBottom: "1.25rem" };
  const daySlots = date ? slots[date] ?? [] : [];

  return (
    <>
      <section className="insc-hero se-hero">
        <Container>
          <div className="insc-hero-inner" style={{ textAlign: "center" }}>
            <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Académies, clubs et équipes</p>
            <h1 className="insc-hero-title">Location de terrains</h1>
            <p className="insc-hero-sub">Réservez en ligne une plage horaire pour jouer un match ou vous entraîner. Choisissez le terrain, la date et l&apos;heure, puis payez en ligne.</p>
          </div>
        </Container>
      </section>

      <section className="section-band">
        <Container className="max-w-2xl">
          {terrains.length === 0 ? (
            <div style={card}><p style={{ margin: 0, color: "#c3c2c8" }}>Aucun terrain n&apos;est offert à la location pour le moment. Écrivez-nous à info@newvalkyria.com.</p></div>
          ) : (
            <>
              <div style={card}>
                <label className="insc-field">
                  <span>Terrain</span>
                  <select className="insc-input" value={terrainId} onChange={(e) => { setTerrainId(e.target.value); setDate(null); setSlot(null); }}>
                    {terrains.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </label>
                {terrain?.address && <p style={{ fontSize: "0.82rem", color: "#c3c2c8", margin: "0.4rem 0 0" }}>📍 {terrain.address}</p>}
                {terrain?.rental_description && <p style={{ fontSize: "0.82rem", color: "#9d9da0", margin: "0.4rem 0 0", whiteSpace: "pre-wrap" }}>{terrain.rental_description}</p>}
              </div>

              {/* ── Calendrier ── */}
              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.8rem" }}>
                  <button type="button" onClick={prev} className="admin-btn-ghost" style={{ padding: "0.35rem 0.8rem" }}>←</button>
                  <strong style={{ color: "#fff" }}>{monthLabel(year, month)}</strong>
                  <button type="button" onClick={next} className="admin-btn-ghost" style={{ padding: "0.35rem 0.8rem" }}>→</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.3rem" }}>
                  {WEEKDAYS.map((d) => <div key={d} style={{ textAlign: "center", fontSize: "0.65rem", color: "#6d6b71", fontWeight: 600 }}>{d}</div>)}
                  {grid.map((day, i) => {
                    if (day === null) return <div key={i} />;
                    const key = `${year}-${pad(month + 1)}-${pad(day)}`;
                    const list = slots[key] ?? [];
                    const free = list.filter((s) => s.available).length;
                    const selected = key === date;
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={free === 0}
                        onClick={() => { setDate(key); setSlot(null); }}
                        style={{
                          minHeight: "46px",
                          borderRadius: "8px",
                          border: selected ? "2px solid #c4a4e4" : "1px solid #251f30",
                          background: free > 0 ? "rgba(143,206,159,0.1)" : "transparent",
                          color: free > 0 ? "#fff" : "#4a4852",
                          cursor: free > 0 ? "pointer" : "default",
                          fontSize: "0.85rem",
                          padding: "0.2rem"
                        }}
                      >
                        {day}
                        {free > 0 && <div style={{ fontSize: "0.58rem", color: "#8fce9f" }}>{free} créneau{free > 1 ? "x" : ""}</div>}
                      </button>
                    );
                  })}
                </div>
                {loading && <p style={{ fontSize: "0.72rem", color: "#6d6b71", margin: "0.6rem 0 0" }}>Chargement des disponibilités…</p>}
                {!loading && Object.values(slots).every((l) => l.every((s) => !s.available)) && (
                  <p style={{ fontSize: "0.78rem", color: "#9d9da0", margin: "0.6rem 0 0" }}>Aucune disponibilité ce mois-ci — essayez un autre mois.</p>
                )}
              </div>

              {/* ── Heures ── */}
              {date && (
                <div style={card}>
                  <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.6rem" }}>
                    {new Date(date + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {daySlots.map((s) => {
                      const active = slot?.start === s.start && slot?.end === s.end;
                      return (
                        <button
                          key={s.start}
                          type="button"
                          disabled={!s.available}
                          onClick={() => setSlot(s)}
                          style={{
                            padding: "0.55rem 0.8rem",
                            borderRadius: "8px",
                            border: active ? "2px solid #c4a4e4" : "1px solid #302e36",
                            background: s.available ? "#17151e" : "#0d0b13",
                            color: s.available ? "#fff" : "#4a4852",
                            textDecoration: s.available ? "none" : "line-through",
                            cursor: s.available ? "pointer" : "not-allowed",
                            fontSize: "0.82rem"
                          }}
                        >
                          {s.start} – {s.end}
                          <div style={{ fontSize: "0.7rem", color: s.available ? "#8fce9f" : "#4a4852" }}>{s.available ? formatMoney(s.priceCents) : "Réservé"}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Coordonnées + paiement ── */}
              {slot && date && (
                <div style={card}>
                  <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.2rem" }}>Réserver {slot.start} – {slot.end}</p>
                  <p style={{ fontSize: "0.85rem", color: "#8fce9f", margin: "0 0 0.8rem" }}>Tarif : {formatMoney(slot.priceCents)}</p>
                  <div className="nv27-form-fields">
                    <label className="insc-field"><span>Organisation (académie, club, équipe) *</span><input className="insc-input" value={form.organizationName} onChange={(e) => setForm({ ...form, organizationName: e.target.value })} /></label>
                    <label className="insc-field"><span>Responsable *</span><input className="insc-input" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></label>
                    <div className="nv27-grid2">
                      <label className="insc-field"><span>Courriel *</span><input type="email" className="insc-input" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></label>
                      <label className="insc-field"><span>Téléphone *</span><input type="tel" className="insc-input" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></label>
                    </div>
                    <label className="insc-field"><span>Précisions (facultatif)</span><textarea className="insc-input insc-textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
                    <label className="insc-consent" style={{ marginTop: "0.5rem" }}>
                      <div className="insc-checkbox-wrap"><input type="checkbox" className="insc-checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /><span className="insc-checkbox-custom" aria-hidden /></div>
                      <span>J&apos;accepte les conditions de location du terrain.</span>
                    </label>
                    {error && <p className="nv27-pay-error">{error}</p>}
                    <button type="button" className="nv27-btn-primary" onClick={submit} disabled={submitting} style={{ padding: "0.75rem", marginTop: "0.8rem" }}>
                      {submitting ? "..." : `Payer ${formatMoney(slot.priceCents)} et réserver`}
                    </button>
                    <p style={{ fontSize: "0.7rem", color: "#6d6b71", margin: "0.5rem 0 0" }}>Le créneau est réservé pendant 30 minutes le temps du paiement.</p>
                  </div>
                </div>
              )}
              {!slot && error && <p className="nv27-pay-error">{error}</p>}
            </>
          )}
        </Container>
      </section>
    </>
  );
}
