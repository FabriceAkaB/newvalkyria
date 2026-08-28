"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Container } from "@/components/container";

interface SessionRow {
  id: string;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string;
  kind: string;
  label: string;
  is_time_tbd: boolean;
}

function formatSessionDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
}

interface FormState {
  playerFirstName: string;
  playerLastName: string;
  playerDob: string;
  playerLevel: string;
  primaryPosition: string;
  secondaryPosition: string;
  currentTeam: string;
  currentClub: string;
  soccerExperience: string;
  playerGoals: string;
  parentAssessedStrengths: string;
  parentAssessedAreasToImprove: string;
  parentFirstName: string;
  parentLastName: string;
  parentEmail: string;
  parentPhone: string;
  parentRelationship: string;
  sportEtudesExperience: string;
  priorEvaluationsDone: string;
  targetSportEtudesProgram: string;
  comments: string;
  importantCoachInfo: string;
  termsAccepted: boolean;
}

const EMPTY_FORM: FormState = {
  playerFirstName: "",
  playerLastName: "",
  playerDob: "",
  playerLevel: "",
  primaryPosition: "",
  secondaryPosition: "",
  currentTeam: "",
  currentClub: "",
  soccerExperience: "",
  playerGoals: "",
  parentAssessedStrengths: "",
  parentAssessedAreasToImprove: "",
  parentFirstName: "",
  parentLastName: "",
  parentEmail: "",
  parentPhone: "",
  parentRelationship: "",
  sportEtudesExperience: "",
  priorEvaluationsDone: "",
  targetSportEtudesProgram: "",
  comments: "",
  importantCoachInfo: "",
  termsAccepted: false
};

export function SportEtudesContent({ sessions, remaining, isFull }: { sessions: SessionRow[]; remaining: number; isFull: boolean }) {
  const router = useRouter();
  const [option, setOption] = useState<"diagnostic_only" | "full_program">(isFull ? "diagnostic_only" : "full_program");
  const [paymentPlan, setPaymentPlan] = useState<"full" | "installments">("full");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const diagnostic = sessions.find((s) => s.kind === "diagnostic_gratuit");
  const paidSessions = sessions.filter((s) => s.kind !== "diagnostic_gratuit");

  const submit = async () => {
    if (!form.playerFirstName || !form.playerLastName || !form.parentFirstName || !form.parentLastName || !form.parentEmail || !form.parentPhone) {
      setError("Prénom et nom du joueur, ainsi que les coordonnées du parent, sont requis.");
      return;
    }
    if (!form.termsAccepted) {
      setError("Vous devez accepter les conditions du programme.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/sport-etudes/inscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, optionChosen: option, paymentPlan: option === "full_program" ? paymentPlan : undefined })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Erreur d'inscription");
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        router.push(`/sport-etudes/confirmation?registrationId=${data.registrationId}`);
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
            <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Programme masculin</p>
            <h1 className="insc-hero-title">Programme technique de préparation aux évaluations du Sport-Études</h1>
            <p className="insc-hero-sub">
              Même si New Valkyria est une académie principalement axée sur le développement du soccer féminin, nous avons décidé
              d&apos;offrir un coup de main aux garçons qui souhaitent bénéficier d&apos;un encadrement supplémentaire afin de mieux
              préparer leur entrée dans un programme Sport-Études. Ce programme est conçu pour offrir un encadrement technique
              intensif permettant d&apos;identifier les forces et les points à améliorer du jeune, puis de travailler spécifiquement
              les éléments nécessaires à sa préparation. Le programme comprend 6 séances intensives ainsi qu&apos;une séance
              diagnostique gratuite permettant d&apos;évaluer le niveau actuel du joueur.
            </p>
            <p className="insc-hero-sub">
              Le programme est divisé en deux types de séances. Le vendredi, les séances sont axées sur la technique. La fin de
              semaine (samedi/dimanche), ce sont des séances match, structurées en atelier technique, échauffement, puis match.
            </p>
          </div>
        </Container>
      </section>

      <section className="section-band">
        <Container className="max-w-2xl">
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", marginBottom: "0.75rem" }}>Séance diagnostique gratuite</h2>
          {diagnostic && (
            <p style={{ fontSize: "0.85rem", color: "#c3c2c8", marginBottom: "1.5rem" }}>
              {formatSessionDate(diagnostic.session_date)}
              {diagnostic.start_time && !diagnostic.is_time_tbd ? ` · ${diagnostic.start_time.slice(0, 5)}–${diagnostic.end_time?.slice(0, 5) ?? ""}` : " · heure à confirmer"}
              {" · "}
              {diagnostic.location}
            </p>
          )}

          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", marginBottom: "0.75rem" }}>Les 6 séances intensives</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1.5rem" }}>
            {paidSessions.map((s) => (
              <p key={s.id} style={{ fontSize: "0.82rem", color: "#c3c2c8", margin: 0 }}>
                {formatSessionDate(s.session_date)}
                {s.start_time && !s.is_time_tbd ? ` · ${s.start_time.slice(0, 5)}–${s.end_time?.slice(0, 5) ?? ""}` : " · heure à confirmer"}
                {" · "}
                {s.location}
                {s.kind === "diagnostic_final" && <span style={{ color: "#9f85ba" }}> — {s.label}</span>}
              </p>
            ))}
          </div>

          <div style={{ background: "#17151e", border: "1px solid #251f30", borderRadius: "10px", padding: "0.9rem 1.1rem", marginBottom: "1.5rem" }}>
            <p style={{ fontSize: "0.82rem", color: "#c3c2c8", margin: 0, lineHeight: 1.6 }}>
              Tous les entraîneurs qui encadreront et évalueront votre garçon détiennent une licence C. L&apos;évaluation de votre
              garçon vous sera envoyée, et chaque évaluation sera filmée afin de mieux vous faire comprendre les éléments manquants
              ou à travailler.
            </p>
          </div>

          <p style={{ fontSize: "0.9rem", color: "#fff", fontWeight: 600, marginBottom: "0.4rem" }}>
            Prix du programme complet : 315,95 $ — payable en un seul versement ou en 2 versements (moitié aujourd&apos;hui, moitié 2 semaines plus tard).
          </p>
          <p style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "1.5rem", color: isFull ? "#f0c878" : "#c3a6ff" }}>
            {isFull ? "Le programme complet est présentement complet." : `${remaining} place${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""} pour le programme complet.`}
          </p>

          <div style={{ display: "flex", gap: "0.6rem", marginBottom: "1.5rem" }}>
            <button
              type="button"
              onClick={() => setOption("full_program")}
              disabled={isFull}
              className={option === "full_program" ? "nv27-btn-primary" : "nv27-btn-ghost"}
              style={{ flex: 1, padding: "0.6rem", fontSize: "0.8rem", opacity: isFull ? 0.5 : 1 }}
            >
              Programme complet — 315,95 $
            </button>
            <button
              type="button"
              onClick={() => setOption("diagnostic_only")}
              className={option === "diagnostic_only" ? "nv27-btn-primary" : "nv27-btn-ghost"}
              style={{ flex: 1, padding: "0.6rem", fontSize: "0.8rem" }}
            >
              Séance diagnostique gratuite seulement
            </button>
          </div>

          {option === "full_program" && !isFull && (
            <div style={{ background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "1rem 1.1rem", marginBottom: "1.5rem" }}>
              <label className="nv27-radio" style={{ marginBottom: "0.6rem" }}>
                <input type="radio" name="paymentPlan" checked={paymentPlan === "full"} onChange={() => setPaymentPlan("full")} />
                <span>Payer en totalité aujourd&apos;hui — 315,95 $</span>
              </label>
              <label className="nv27-radio">
                <input type="radio" name="paymentPlan" checked={paymentPlan === "installments"} onChange={() => setPaymentPlan("installments")} />
                <span>Payer en 2 versements — 157,98 $ aujourd&apos;hui, 157,97 $ dans 2 semaines</span>
              </label>
            </div>
          )}

          <div className="nv27-form-fields">
            <p style={{ fontSize: "0.72rem", color: "#9f85ba", textTransform: "uppercase", margin: "0.5rem 0 0" }}>Joueur</p>
            <div className="nv27-grid2">
              <label className="insc-field"><span>Prénom *</span><input className="insc-input" value={form.playerFirstName} onChange={(e) => set("playerFirstName", e.target.value)} /></label>
              <label className="insc-field"><span>Nom *</span><input className="insc-input" value={form.playerLastName} onChange={(e) => set("playerLastName", e.target.value)} /></label>
            </div>
            <div className="nv27-grid2">
              <label className="insc-field"><span>Date de naissance</span><input type="date" className="insc-input" value={form.playerDob} onChange={(e) => set("playerDob", e.target.value)} /></label>
              <label className="insc-field"><span>Niveau de jeu</span><input className="insc-input" value={form.playerLevel} onChange={(e) => set("playerLevel", e.target.value)} /></label>
            </div>
            <div className="nv27-grid2">
              <label className="insc-field"><span>Position principale</span><input className="insc-input" value={form.primaryPosition} onChange={(e) => set("primaryPosition", e.target.value)} /></label>
              <label className="insc-field"><span>Position secondaire</span><input className="insc-input" value={form.secondaryPosition} onChange={(e) => set("secondaryPosition", e.target.value)} /></label>
            </div>
            <div className="nv27-grid2">
              <label className="insc-field"><span>Équipe actuelle</span><input className="insc-input" value={form.currentTeam} onChange={(e) => set("currentTeam", e.target.value)} /></label>
              <label className="insc-field"><span>Club actuel</span><input className="insc-input" value={form.currentClub} onChange={(e) => set("currentClub", e.target.value)} /></label>
            </div>
            <label className="insc-field"><span>Expérience en soccer</span><textarea className="insc-input insc-textarea" value={form.soccerExperience} onChange={(e) => set("soccerExperience", e.target.value)} /></label>
            <label className="insc-field"><span>Objectifs du joueur</span><textarea className="insc-input insc-textarea" value={form.playerGoals} onChange={(e) => set("playerGoals", e.target.value)} /></label>
            <div className="nv27-grid2">
              <label className="insc-field"><span>Forces selon le parent</span><textarea className="insc-input insc-textarea" value={form.parentAssessedStrengths} onChange={(e) => set("parentAssessedStrengths", e.target.value)} /></label>
              <label className="insc-field"><span>Éléments à améliorer selon le parent</span><textarea className="insc-input insc-textarea" value={form.parentAssessedAreasToImprove} onChange={(e) => set("parentAssessedAreasToImprove", e.target.value)} /></label>
            </div>

            <p style={{ fontSize: "0.72rem", color: "#9f85ba", textTransform: "uppercase", margin: "1rem 0 0" }}>Parent</p>
            <div className="nv27-grid2">
              <label className="insc-field"><span>Prénom *</span><input className="insc-input" value={form.parentFirstName} onChange={(e) => set("parentFirstName", e.target.value)} /></label>
              <label className="insc-field"><span>Nom *</span><input className="insc-input" value={form.parentLastName} onChange={(e) => set("parentLastName", e.target.value)} /></label>
            </div>
            <div className="nv27-grid2">
              <label className="insc-field"><span>Courriel *</span><input className="insc-input" value={form.parentEmail} onChange={(e) => set("parentEmail", e.target.value)} /></label>
              <label className="insc-field"><span>Téléphone *</span><input className="insc-input" value={form.parentPhone} onChange={(e) => set("parentPhone", e.target.value)} /></label>
            </div>
            <label className="insc-field"><span>Relation avec le joueur</span><input className="insc-input" value={form.parentRelationship} onChange={(e) => set("parentRelationship", e.target.value)} /></label>

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
              {submitting
                ? "..."
                : option === "diagnostic_only"
                  ? "Réserver la séance diagnostique gratuite"
                  : paymentPlan === "installments"
                    ? "S'inscrire au programme complet — 1er versement de 157,98 $"
                    : "S'inscrire au programme complet — 315,95 $"}
            </button>
          </div>
        </Container>
      </section>
    </>
  );
}
