"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Container } from "@/components/container";
import { formatMoney } from "@/lib/private-programs";

interface Slot {
  id: string;
  date: string;
  start: string;
  end: string;
  location: string;
  field: string | null;
  priceCents: number;
  available: boolean;
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("fr-CA", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function MatchSlotsContent({ cancelled }: { cancelled: boolean }) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [max, setMax] = useState(2);
  const [selected, setSelected] = useState<string[]>([]);
  const [form, setForm] = useState({ orgName: "", teamLabel: "", contactName: "", contactEmail: "", contactPhone: "", notes: "" });
  const [terms, setTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(cancelled ? "Le paiement a été annulé. Vos plages ne sont pas réservées." : null);

  const load = useCallback(async () => {
    const res = await fetch("/api/prive/matchs");
    const json = await res.json();
    setSlots(json.slots ?? []);
    setMax(json.maxPerTeam ?? 2);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const byMonth = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots ?? []) {
      const k = monthKey(s.date);
      map.set(k, [...(map.get(k) ?? []), s]);
    }
    return Array.from(map.entries());
  }, [slots]);

  const toggle = (slot: Slot) => {
    if (!slot.available) return;
    setError(null);
    setSelected((prev) => {
      if (prev.includes(slot.id)) return prev.filter((id) => id !== slot.id);
      if (prev.length >= max) {
        setError(`Une équipe peut réserver au maximum ${max} plages.`);
        return prev;
      }
      return [...prev, slot.id];
    });
  };

  const chosen = (slots ?? []).filter((s) => selected.includes(s.id));
  const total = chosen.reduce((n, s) => n + s.priceCents, 0);

  const submit = async () => {
    setError(null);
    if (chosen.length === 0) return setError("Choisissez au moins une plage.");
    if (!form.orgName || !form.teamLabel || !form.contactName || !form.contactEmail || !form.contactPhone) return setError("Merci de remplir tous les champs obligatoires.");
    if (!terms) return setError("Vous devez accepter les conditions de réservation.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/prive/matchs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotIds: selected, ...form, termsAccepted: terms })
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        if (json?.code === "conflict") {
          setSelected([]);
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

  return (
    <>
      <section className="insc-hero se-hero">
        <Container>
          <div className="insc-hero-inner" style={{ textAlign: "center" }}>
            <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Académies, clubs et équipes</p>
            <h1 className="insc-hero-title">Réservez votre match</h1>
            <p className="insc-hero-sub">Jouez contre New Valkyria au Complexe sportif de Terrebonne. Choisissez vos plages, remplissez vos informations et confirmez chaque plage avec un paiement de {formatMoney(slots?.[0]?.priceCents ?? 10000)}.</p>
          </div>
        </Container>
      </section>

      <section className="section-band">
        <Container className="max-w-2xl">
          <div style={{ ...card, borderColor: "#3a2f4d" }}>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#c3c2c8", lineHeight: 1.6 }}>
              <strong style={{ color: "#fff" }}>Comment ça marche :</strong> 1) choisissez jusqu'à <strong>{max} plages</strong> (maximum par équipe), 2) remplissez les informations de votre équipe, 3) payez <strong>{formatMoney(slots?.[0]?.priceCents ?? 10000)} par plage</strong> pour confirmer. Une plage n'est réservée qu'une fois le paiement reçu.
            </p>
          </div>

          {slots === null && <p style={{ color: "#9d9da0" }}>Chargement des plages…</p>}
          {slots !== null && slots.length === 0 && (
            <div style={card}><p style={{ margin: 0, color: "#c3c2c8" }}>Aucune plage n'est offerte pour le moment. Écrivez-nous à info@newvalkyria.com.</p></div>
          )}

          {byMonth.map(([key, list]) => (
            <div key={key} style={{ marginBottom: "1.2rem" }}>
              <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "#c4a4e4", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 0.5rem" }}>{monthLabel(key)}</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "0.5rem" }}>
                {list.map((s) => {
                  const active = selected.includes(s.id);
                  const disabled = !s.available;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggle(s)}
                      style={{
                        textAlign: "left",
                        padding: "0.7rem 0.8rem",
                        borderRadius: "10px",
                        border: active ? "2px solid #c4a4e4" : "1px solid #302e36",
                        background: disabled ? "#0d0b13" : active ? "#2a1f3a" : "#17151e",
                        color: disabled ? "#4a4852" : "#fff",
                        cursor: disabled ? "not-allowed" : "pointer"
                      }}
                    >
                      <span style={{ display: "block", fontWeight: 700, fontSize: "0.85rem", textDecoration: disabled ? "line-through" : "none" }}>
                        {new Date(s.date + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}
                      </span>
                      <span style={{ display: "block", fontSize: "0.8rem", marginTop: "0.15rem" }}>{s.start} – {s.end}</span>
                      <span style={{ display: "block", fontSize: "0.7rem", marginTop: "0.25rem", color: disabled ? "#4a4852" : "#8fce9f" }}>{disabled ? "Réservée" : active ? `✓ Sélectionnée · ${formatMoney(s.priceCents)}` : formatMoney(s.priceCents)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {slots && slots.length > 0 && (
            <div style={card}>
              <p style={{ fontWeight: 700, color: "#fff", margin: "0 0 0.2rem" }}>Votre équipe</p>
              <p style={{ fontSize: "0.8rem", color: "#9d9da0", margin: "0 0 0.9rem" }}>
                {chosen.length}/{max} plage{max > 1 ? "s" : ""} choisie{chosen.length > 1 ? "s" : ""}{chosen.length > 0 ? ` · total ${formatMoney(total)}` : ""}
              </p>
              <div className="nv27-form-fields">
                <label className="insc-field"><span>Académie / club *</span><input className="insc-input" value={form.orgName} onChange={(e) => setForm({ ...form, orgName: e.target.value })} /></label>
                <label className="insc-field"><span>Catégorie et âge de l&apos;équipe *</span><input className="insc-input" placeholder="ex. U12 féminin, 2014" value={form.teamLabel} onChange={(e) => setForm({ ...form, teamLabel: e.target.value })} /></label>
                <label className="insc-field"><span>Responsable (nom complet) *</span><input className="insc-input" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></label>
                <div className="nv27-grid2">
                  <label className="insc-field"><span>Courriel *</span><input type="email" className="insc-input" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></label>
                  <label className="insc-field"><span>Téléphone *</span><input type="tel" className="insc-input" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></label>
                </div>
                <label className="insc-field"><span>Précisions (niveau, nombre de joueuses…)</span><textarea className="insc-input insc-textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
                <label className="insc-consent" style={{ marginTop: "0.5rem" }}>
                  <div className="insc-checkbox-wrap"><input type="checkbox" className="insc-checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /><span className="insc-checkbox-custom" aria-hidden /></div>
                  <span>J&apos;accepte les conditions de réservation (paiement non remboursable après confirmation, sauf annulation par New Valkyria).</span>
                </label>
                {error && <p className="nv27-pay-error">{error}</p>}
                <button type="button" className="nv27-btn-primary" onClick={submit} disabled={submitting || chosen.length === 0} style={{ padding: "0.75rem", marginTop: "0.8rem" }}>
                  {submitting ? "..." : chosen.length === 0 ? "Choisissez une plage" : `Confirmer et payer ${formatMoney(total)}`}
                </button>
                <p style={{ fontSize: "0.7rem", color: "#6d6b71", margin: "0.5rem 0 0" }}>Vos plages sont gardées 30 minutes le temps du paiement.</p>
              </div>
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
