"use client";

import { useEffect, useState } from "react";

interface TrialSession {
  dateId: string;
  date: string;
  start: string;
  end: string;
  location: string;
  remaining: number;
}

/** Essai gratuit sur une pratique du MARDI — sans paiement, places limitées par pratique. */
export function BoysTrialSection({ slug, eligibleYears }: { slug: string; eligibleYears: string[] }) {
  const [sessions, setSessions] = useState<TrialSession[] | null>(null);
  const [dateId, setDateId] = useState("");
  const [form, setForm] = useState({ playerFirstName: "", playerLastName: "", birthYear: "", parentName: "", parentEmail: "", parentPhone: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ date: string; start: string; end: string; location: string } | null>(null);

  useEffect(() => {
    fetch(`/api/prive/essais?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((j) => setSessions(j.sessions ?? []))
      .catch(() => setSessions([]));
  }, [slug]);

  const card: React.CSSProperties = { background: "#100e17", border: "1px solid #3a2f4d", borderRadius: "12px", padding: "1rem 1.1rem", marginBottom: "1.25rem" };
  if (sessions === null || sessions.length === 0) return null;

  const years = eligibleYears.length ? eligibleYears : ["2018", "2015", "2014"];

  const submit = async () => {
    setError(null);
    if (!dateId) return setError("Choisissez une pratique du mardi.");
    if (!form.playerFirstName || !form.playerLastName || !form.birthYear || !form.parentName || !form.parentEmail || !form.parentPhone) return setError("Merci de remplir tous les champs obligatoires.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/prive/essais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, dateId, ...form, birthYear: Number(form.birthYear) })
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Erreur de réservation");
      setDone({ date: json.date, start: json.start, end: json.end, location: json.location });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div style={{ ...card, borderColor: "#8fce9f" }}>
        <p style={{ color: "#8fce9f", fontWeight: 700, margin: "0 0 0.3rem" }}>✓ Essai gratuit confirmé</p>
        <p style={{ color: "#c3c2c8", fontSize: "0.85rem", margin: 0 }}>
          {new Date(done.date + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })} · {done.start.slice(0, 5)}–{done.end.slice(0, 5)} · {done.location}. Un courriel de confirmation vous a été envoyé.
        </p>
      </div>
    );
  }

  return (
    <div style={card}>
      <p style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff", margin: "0 0 0.2rem" }}>Essai gratuit le mardi</p>
      <p style={{ fontSize: "0.82rem", color: "#9d9da0", margin: "0 0 0.9rem" }}>Votre garçon peut essayer une pratique du mardi, sans engagement et sans paiement.</p>
      <div className="nv27-form-fields">
        <label className="insc-field">
          <span>Pratique du mardi *</span>
          <select className="insc-input" value={dateId} onChange={(e) => setDateId(e.target.value)}>
            <option value="">Choisir…</option>
            {sessions.map((s) => (
              <option key={s.dateId} value={s.dateId} disabled={s.remaining === 0}>
                {new Date(s.date + "T12:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })} · {s.start.slice(0, 5)} · {s.remaining === 0 ? "complet" : `${s.remaining} place${s.remaining > 1 ? "s" : ""}`}
              </option>
            ))}
          </select>
        </label>
        <div className="nv27-grid2">
          <label className="insc-field"><span>Prénom de l&apos;enfant *</span><input className="insc-input" value={form.playerFirstName} onChange={(e) => setForm({ ...form, playerFirstName: e.target.value })} /></label>
          <label className="insc-field"><span>Nom de l&apos;enfant *</span><input className="insc-input" value={form.playerLastName} onChange={(e) => setForm({ ...form, playerLastName: e.target.value })} /></label>
        </div>
        <label className="insc-field">
          <span>Année de naissance *</span>
          <select className="insc-input" value={form.birthYear} onChange={(e) => setForm({ ...form, birthYear: e.target.value })}>
            <option value="">Choisir…</option>
            {Array.from({ length: 12 }, (_, i) => 2023 - i).map((y) => <option key={y} value={y}>{y}{years.includes(String(y)) ? "" : ""}</option>)}
          </select>
        </label>
        <label className="insc-field"><span>Nom du parent *</span><input className="insc-input" value={form.parentName} onChange={(e) => setForm({ ...form, parentName: e.target.value })} /></label>
        <div className="nv27-grid2">
          <label className="insc-field"><span>Courriel *</span><input type="email" className="insc-input" value={form.parentEmail} onChange={(e) => setForm({ ...form, parentEmail: e.target.value })} /></label>
          <label className="insc-field"><span>Téléphone *</span><input type="tel" className="insc-input" value={form.parentPhone} onChange={(e) => setForm({ ...form, parentPhone: e.target.value })} /></label>
        </div>
        {error && <p className="nv27-pay-error">{error}</p>}
        <button type="button" className="nv27-btn-primary" onClick={submit} disabled={submitting} style={{ padding: "0.7rem", marginTop: "0.7rem" }}>
          {submitting ? "..." : "Réserver mon essai gratuit"}
        </button>
      </div>
    </div>
  );
}
