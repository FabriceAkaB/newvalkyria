"use client";

import { useState } from "react";

import { formatMoney } from "@/lib/private-programs";

export function CompleteRegistrationForm({
  token,
  programLabel,
  amountCents,
  defaultParentName,
  parentEmail,
  defaultCity
}: {
  token: string;
  programLabel: string;
  amountCents: number;
  defaultParentName: string;
  parentEmail: string;
  defaultCity: string;
}) {
  const [form, setForm] = useState({ playerFirstName: "", playerLastName: "", playerDob: "", parentName: defaultParentName, parentPhone: "", city: defaultCity, comments: "" });
  const [terms, setTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setError(null);
    if (!form.playerFirstName || !form.playerLastName || !form.playerDob || !form.parentName || !form.parentPhone) {
      return setError("Merci de remplir tous les champs obligatoires.");
    }
    if (!terms) return setError("Vous devez accepter les conditions du programme.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/prive/completer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...form, termsAccepted: terms })
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Erreur d'envoi");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff" }}>✓ Inscription confirmée</h1>
        <p style={{ color: "#c3c2c8", lineHeight: 1.6 }}>
          Merci ! Votre fils est maintenant inscrit au <strong>{programLabel}</strong>. Un courriel de confirmation vous est envoyé. Nous vous écrirons avec les détails des pratiques et des matchs.
        </p>
      </>
    );
  }

  return (
    <>
      <p style={{ fontSize: "0.72rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#c4a4e4", margin: "0 0 0.4rem" }}>Dernière étape</p>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#fff", margin: "0 0 0.6rem" }}>Compléter l&apos;inscription</h1>
      <p style={{ color: "#c3c2c8", fontSize: "0.9rem", lineHeight: 1.6, margin: "0 0 1.2rem" }}>
        Votre paiement de <strong>{formatMoney(amountCents)}</strong> pour le <strong>{programLabel}</strong> est bien reçu. Il ne manque que les informations du joueur : aucun nouveau paiement n&apos;est demandé.
      </p>

      <div className="nv27-form-fields">
        <p style={{ fontSize: "0.72rem", color: "#9f85ba", textTransform: "uppercase", margin: "0.5rem 0 0" }}>Joueur</p>
        <div className="nv27-grid2">
          <label className="insc-field"><span>Prénom *</span><input className="insc-input" value={form.playerFirstName} onChange={(e) => set("playerFirstName", e.target.value)} /></label>
          <label className="insc-field"><span>Nom *</span><input className="insc-input" value={form.playerLastName} onChange={(e) => set("playerLastName", e.target.value)} /></label>
        </div>
        <label className="insc-field"><span>Date de naissance *</span><input type="date" className="insc-input" value={form.playerDob} onChange={(e) => set("playerDob", e.target.value)} /></label>

        <p style={{ fontSize: "0.72rem", color: "#9f85ba", textTransform: "uppercase", margin: "1rem 0 0" }}>Parent</p>
        <div className="nv27-grid2">
          <label className="insc-field"><span>Nom complet *</span><input className="insc-input" value={form.parentName} onChange={(e) => set("parentName", e.target.value)} /></label>
          <label className="insc-field"><span>Téléphone *</span><input type="tel" className="insc-input" value={form.parentPhone} onChange={(e) => set("parentPhone", e.target.value)} /></label>
        </div>
        <div className="nv27-grid2">
          <label className="insc-field"><span>Courriel</span><input className="insc-input" value={parentEmail} readOnly /></label>
          <label className="insc-field"><span>Ville</span><input className="insc-input" value={form.city} onChange={(e) => set("city", e.target.value)} /></label>
        </div>
        <label className="insc-field"><span>Commentaires (allergies, blessures, autre)</span><textarea className="insc-input insc-textarea" value={form.comments} onChange={(e) => set("comments", e.target.value)} /></label>

        <label className="insc-consent" style={{ marginTop: "0.75rem" }}>
          <div className="insc-checkbox-wrap">
            <input type="checkbox" className="insc-checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
            <span className="insc-checkbox-custom" aria-hidden />
          </div>
          <span>J&apos;accepte les conditions du programme.</span>
        </label>

        {error && <p className="nv27-pay-error">{error}</p>}
        <button type="button" className="nv27-btn-primary" onClick={submit} disabled={submitting} style={{ padding: "0.75rem", marginTop: "1rem" }}>
          {submitting ? "..." : "Confirmer l'inscription"}
        </button>
      </div>
    </>
  );
}
