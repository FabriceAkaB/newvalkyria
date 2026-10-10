"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { BoysTrialSection } from "@/components/boys-trial-section";
import { Container } from "@/components/container";

interface DateRow {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  location: string;
}

function formatSessionDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
}

function fmt(cents: number) {
  return (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
}

interface FormState {
  playerFirstName: string;
  playerLastName: string;
  playerDob: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  city: string;
  comments: string;
  termsAccepted: boolean;
}

const EMPTY_FORM: FormState = {
  playerFirstName: "",
  playerLastName: "",
  playerDob: "",
  parentName: "",
  parentEmail: "",
  parentPhone: "",
  city: "",
  comments: "",
  termsAccepted: false
};

export function SessionProgramContent({
  slug,
  title,
  tagline,
  intro,
  priceCents,
  allowInstallments,
  dates,
  remaining,
  isFull
}: {
  slug: string;
  title: string;
  tagline: string;
  intro: string;
  priceCents: number;
  allowInstallments: boolean;
  dates: DateRow[];
  remaining: number;
  isFull: boolean;
}) {
  const router = useRouter();
  const [installments, setInstallments] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const totalCents = priceCents;
  const firstAmountCents = installments === 1 ? totalCents : Math.ceil(totalCents / installments);

  const submit = async () => {
    if (!form.playerFirstName || !form.playerLastName || !form.parentName || !form.parentEmail || !form.parentPhone) {
      setError("Le nom du joueur et les coordonnées du parent sont requis.");
      return;
    }
    if (!form.termsAccepted) {
      setError("Vous devez accepter les conditions du programme.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/programmes/inscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, programSlug: slug, installments: allowInstallments ? installments : 1 })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Erreur d'inscription");
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        router.push(`/programmes/${slug}/confirmation?registrationId=${data.registrationId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setSubmitting(false);
    }
  };

  return (
    <>
      <section className="insc-hero se-hero">
        <Container>
          <div className="insc-hero-inner" style={{ textAlign: "center" }}>
            <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">{tagline}</p>
            <h1 className="insc-hero-title">{title}</h1>
            <p className="insc-hero-sub">{intro}</p>
          </div>
        </Container>
      </section>

      <section className="section-band">
        <Container className="max-w-2xl">
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", marginBottom: "0.75rem" }}>Les {dates.length} séances</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1.5rem" }}>
            {dates.map((d) => (
              <p key={d.id} style={{ fontSize: "0.82rem", color: "#c3c2c8", margin: 0 }}>
                {formatSessionDate(d.session_date)} · {d.start_time.slice(0, 5)}–{d.end_time.slice(0, 5)} · {d.location}
              </p>
            ))}
          </div>

          {slug === "intensif-garcons" && <BoysTrialSection slug={slug} eligibleYears={["2014", "2015"]} />}

          {isFull ? (
            <p style={{ fontSize: "0.9rem", color: "#ffb464", marginBottom: "1.5rem" }}>Ce programme est complet pour le moment.</p>
          ) : (
            <>
              <p style={{ fontSize: "0.82rem", color: "#6d6b71", marginBottom: "1.5rem" }}>{remaining} place{remaining !== 1 ? "s" : ""} restante{remaining !== 1 ? "s" : ""}.</p>

              {allowInstallments && (
                <div style={{ background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "1rem 1.1rem", marginBottom: "1.5rem" }}>
                  <label className="nv27-radio" style={{ marginBottom: "0.6rem" }}>
                    <input type="radio" name="installments" checked={installments === 1} onChange={() => setInstallments(1)} />
                    <span>Payer en totalité aujourd&apos;hui — {fmt(priceCents)}</span>
                  </label>
                  <label className="nv27-radio">
                    <input type="radio" name="installments" checked={installments === 2} onChange={() => setInstallments(2)} />
                    <span>Payer en 2 versements — une moitié aujourd&apos;hui, l&apos;autre à la moitié du programme</span>
                  </label>
                </div>
              )}

              <div className="nv27-form-fields">
                <p style={{ fontSize: "0.72rem", color: "#9f85ba", textTransform: "uppercase", margin: "0.5rem 0 0" }}>Joueur</p>
                <div className="nv27-grid2">
                  <label className="insc-field"><span>Prénom *</span><input className="insc-input" value={form.playerFirstName} onChange={(e) => set("playerFirstName", e.target.value)} /></label>
                  <label className="insc-field"><span>Nom *</span><input className="insc-input" value={form.playerLastName} onChange={(e) => set("playerLastName", e.target.value)} /></label>
                </div>
                <label className="insc-field"><span>Date de naissance</span><input type="date" className="insc-input" value={form.playerDob} onChange={(e) => set("playerDob", e.target.value)} /></label>

                <p style={{ fontSize: "0.72rem", color: "#9f85ba", textTransform: "uppercase", margin: "1rem 0 0" }}>Parent</p>
                <div className="nv27-grid2">
                  <label className="insc-field"><span>Nom complet *</span><input className="insc-input" value={form.parentName} onChange={(e) => set("parentName", e.target.value)} /></label>
                  <label className="insc-field"><span>Ville</span><input className="insc-input" value={form.city} onChange={(e) => set("city", e.target.value)} /></label>
                </div>
                <div className="nv27-grid2">
                  <label className="insc-field"><span>Courriel *</span><input className="insc-input" value={form.parentEmail} onChange={(e) => set("parentEmail", e.target.value)} /></label>
                  <label className="insc-field"><span>Téléphone *</span><input className="insc-input" value={form.parentPhone} onChange={(e) => set("parentPhone", e.target.value)} /></label>
                </div>
                <label className="insc-field"><span>Commentaires</span><textarea className="insc-input insc-textarea" value={form.comments} onChange={(e) => set("comments", e.target.value)} /></label>

                <label className="insc-consent" style={{ marginTop: "0.75rem" }}>
                  <div className="insc-checkbox-wrap">
                    <input type="checkbox" className="insc-checkbox" checked={form.termsAccepted} onChange={(e) => set("termsAccepted", e.target.checked)} />
                    <span className="insc-checkbox-custom" aria-hidden>
                      {form.termsAccepted && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                          <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                  </div>
                  <span>J&apos;accepte les conditions du programme.</span>
                </label>

                {error && <p className="nv27-pay-error">{error}</p>}

                <button type="button" className="nv27-btn-primary" onClick={submit} disabled={submitting} style={{ padding: "0.7rem", fontSize: "0.9rem", marginTop: "1rem" }}>
                  {submitting ? "..." : installments === 1 ? `S'inscrire — ${fmt(totalCents)}` : `S'inscrire — 1er versement de ${fmt(firstAmountCents)}`}
                </button>
              </div>
            </>
          )}
        </Container>
      </section>
    </>
  );
}
