"use client";

import { useEffect, useMemo, useState } from "react";

import { Container } from "@/components/container";
import { BoysTrialSection } from "@/components/boys-trial-section";
import { ShareProgramButtons, type ShareProgram } from "@/components/share-program-buttons";
import { capacityLabel, computePrice, formatMoney, isBirthYearEligible, type PaymentOption } from "@/lib/private-programs";

interface DateRow {
  id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  location: string;
}

interface Presentation {
  intro?: string;
  objectives?: string[];
  advantages?: string[];
  location?: string;
  coaches?: string[];
}

export interface PrivateProgramView {
  slug: string;
  name: string;
  shortName: string;
  birthYearsLabel: string;
  genderLabel: string;
  draft: boolean;
  eligibleBirthYears: string[];
  priceCents: number;
  capacity: number;
  minCapacity: number | null;
  remaining: number;
  isFull: boolean;
  practices: number;
  matches: number;
  installmentFeeCents: number;
  referralDiscountCents: number;
  secondInstallmentDate: string | null;
  dates: DateRow[];
  presentation: Presentation;
  origin: string;
}

/** Nombre de pratiques visibles avant « Voir tout le calendrier » (section trop longue sur téléphone). */
const DATES_PREVIEW = 4;

const REF_STORAGE_KEY = "nv_referral_code";

function formatSessionDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
}

const DEFAULT_OBJECTIVES = [
  "Améliorer le contrôle et la maîtrise du ballon",
  "Développer la première touche, la passe et la conduite",
  "Renforcer la prise de décision et la compréhension du jeu",
  "Progresser en confiance dans un environnement structuré"
];
const DEFAULT_ADVANTAGES = [
  "Groupe limité pour un encadrement plus individualisé",
  "Séances axées sur la technique et la progression",
  "Matchs inclus pour mettre les acquis en pratique",
  "Académie reconnue pour le développement technique"
];

export function PrivateProgramContent({ program, initialRef }: { program: PrivateProgramView; initialRef: string | null }) {
  const [option, setOption] = useState<PaymentOption>("full");
  const [referralAnswer, setReferralAnswer] = useState<"oui" | "non">("non");
  const [refCodeOrEmail, setRefCodeOrEmail] = useState("");
  const [referrerName, setReferrerName] = useState("");
  const [referrerPlayer, setReferrerPlayer] = useState("");
  const [form, setForm] = useState({ playerFirstName: "", playerLastName: "", birthYear: "", parentFirstName: "", parentLastName: "", parentEmail: "", parentPhone: "", city: "", comments: "" });
  const [terms, setTerms] = useState(false);
  const [autoDebit, setAutoDebit] = useState(false);
  const [useCredit, setUseCredit] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);
  const [myCode, setMyCode] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitlisted, setWaitlisted] = useState(false);
  const [showAllDates, setShowAllDates] = useState(false);

  // Le code de référencement est conservé pendant toute la procédure (même si
  // le parent change de page ou recharge) : lien ?ref= → stockage local.
  useEffect(() => {
    try {
      if (initialRef) window.localStorage.setItem(REF_STORAGE_KEY, JSON.stringify({ code: initialRef, slug: program.slug, at: Date.now() }));
      const stored = window.localStorage.getItem(REF_STORAGE_KEY);
      const parsed = stored ? (JSON.parse(stored) as { code?: string; at?: number }) : null;
      const fresh = parsed?.at && Date.now() - parsed.at < 1000 * 60 * 60 * 24 * 30;
      const code = initialRef ?? (fresh ? parsed?.code : null);
      if (code) {
        setRefCodeOrEmail(code);
        setReferralAnswer("oui");
      }
    } catch {
      if (initialRef) {
        setRefCodeOrEmail(initialRef);
        setReferralAnswer("oui");
      }
    }
  }, [initialRef, program.slug]);

  // Parent connecté : on pré-remplit pour ne pas redemander les mêmes infos.
  useEffect(() => {
    (async () => {
      try {
        const me = await fetch("/api/compte/moi").then((r) => r.json());
        if (!me?.loggedIn || prefilled) return;
        const parts = String(me.fullName ?? "").trim().split(/\s+/);
        setForm((f) => ({
          ...f,
          parentFirstName: f.parentFirstName || parts[0] || "",
          parentLastName: f.parentLastName || parts.slice(1).join(" "),
          parentEmail: f.parentEmail || me.email || ""
        }));
        setPrefilled(true);
        const rec = await fetch("/api/compte/recommandations").then((r) => (r.ok ? r.json() : null));
        if (rec?.summary) {
          setMyCode(rec.summary.code);
          setCreditBalance(rec.summary.creditBalanceCents ?? 0);
        }
      } catch {
        /* non connecté : rien à faire */
      }
    })();
  }, [prefilled]);

  const set = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const birthYearNum = form.birthYear ? Number(form.birthYear) : null;
  const ineligible = birthYearNum != null && !isBirthYearEligible(birthYearNum, program.eligibleBirthYears);
  const referralApplies = referralAnswer === "oui" && Boolean(refCodeOrEmail.trim());
  const creditCents = useCredit ? creditBalance : 0;

  const priceFull = useMemo(
    () => computePrice({ listCents: program.priceCents, option: "full", installmentFeeCents: program.installmentFeeCents, referralDiscountCents: referralApplies ? program.referralDiscountCents : 0, creditCents }),
    [program, referralApplies, creditCents]
  );
  const priceTwo = useMemo(
    () => computePrice({ listCents: program.priceCents, option: "two_installments", installmentFeeCents: program.installmentFeeCents, referralDiscountCents: referralApplies ? program.referralDiscountCents : 0, creditCents }),
    [program, referralApplies, creditCents]
  );
  const price = option === "full" ? priceFull : priceTwo;

  const submit = async () => {
    setError(null);
    if (!form.playerFirstName || !form.playerLastName || !form.birthYear || !form.parentFirstName || !form.parentLastName || !form.parentEmail || !form.parentPhone) {
      setError("Merci de remplir tous les champs obligatoires.");
      return;
    }
    if (ineligible) {
      setError(`Ce programme est réservé aux garçons nés en ${program.eligibleBirthYears.join(" et ")}.`);
      return;
    }
    if (!terms) {
      setError("Vous devez accepter les conditions du programme.");
      return;
    }
    if (option === "two_installments" && !autoDebit) {
      setError("Pour payer en 2 versements, autorisez le prélèvement automatique du deuxième versement.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/prive/inscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programSlug: program.slug,
          playerFirstName: form.playerFirstName,
          playerLastName: form.playerLastName,
          birthYear: Number(form.birthYear),
          parentFirstName: form.parentFirstName,
          parentLastName: form.parentLastName,
          parentEmail: form.parentEmail,
          parentPhone: form.parentPhone,
          city: form.city || undefined,
          comments: form.comments || undefined,
          paymentOption: option,
          termsAccepted: terms,
          autoDebitConsent: autoDebit,
          useCredit,
          referral:
            referralAnswer === "oui"
              ? { answer: "oui", codeOrEmail: refCodeOrEmail || undefined, referrerName: referrerName || undefined, referrerPlayer: referrerPlayer || undefined }
              : { answer: "non" }
        })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Erreur d'inscription");
      if (data.waitlisted) {
        setWaitlisted(true);
        setSubmitting(false);
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setSubmitting(false);
    }
  };

  const shareProgram: ShareProgram = {
    slug: program.slug,
    shortName: program.shortName,
    priceCents: program.priceCents,
    practices: program.practices,
    matches: program.matches,
    capacity: program.capacity,
    minCapacity: program.minCapacity,
    feeCents: program.installmentFeeCents,
    referralDiscountCents: program.referralDiscountCents
  };

  const objectives = program.presentation.objectives?.length ? program.presentation.objectives : DEFAULT_OBJECTIVES;
  const advantages = program.presentation.advantages?.length ? program.presentation.advantages : DEFAULT_ADVANTAGES;
  const locations = Array.from(new Set(program.dates.map((d) => d.location)));
  const years = Array.from({ length: 12 }, (_, i) => 2023 - i);

  const card: React.CSSProperties = { background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "1rem 1.1rem", marginBottom: "1.25rem" };
  const h2: React.CSSProperties = { fontSize: "1.05rem", fontWeight: 700, color: "#fff", margin: "0 0 0.6rem" };

  return (
    <>
      <section className="insc-hero se-hero">
        <Container>
          <div className="insc-hero-inner" style={{ textAlign: "center" }}>
            {program.draft && <p style={{ background: "#3a2f10", color: "#f0c878", fontSize: "0.78rem", padding: "0.4rem 0.8rem", borderRadius: "8px", display: "inline-block", marginBottom: "0.6rem" }}>Brouillon — non publié (visible seulement par l'administrateur)</p>}
            <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">{program.genderLabel} en {program.birthYearsLabel}</p>
            <h1 className="insc-hero-title">{program.name}</h1>
            <p className="insc-hero-sub">
              {program.presentation.intro ??
                `Un programme de développement technique de ${program.practices} pratiques et ${program.matches} matchs, en petit groupe de ${capacityLabel(program.minCapacity, program.capacity)} joueurs.`}
            </p>
          </div>
        </Container>
      </section>

      <section className="section-band">
        <Container className="max-w-2xl">
          {/* ── Faits clés ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "0.6rem", marginBottom: "1.25rem" }}>
            {[
              [String(program.practices), "pratiques"],
              [String(program.matches), "matchs inclus"],
              [String(program.practices + program.matches), "activités au total"],
              [capacityLabel(program.minCapacity, program.capacity), program.minCapacity ? "joueurs par groupe" : "joueurs maximum"]
            ].map(([n, l]) => (
              <div key={l} style={{ ...card, marginBottom: 0, textAlign: "center", padding: "0.8rem 0.5rem" }}>
                <p style={{ fontSize: "1.5rem", fontWeight: 800, color: "#c4a4e4", margin: 0 }}>{n}</p>
                <p style={{ fontSize: "0.7rem", color: "#9d9da0", margin: 0 }}>{l}</p>
              </div>
            ))}
          </div>

          <p style={{ fontSize: "0.85rem", color: program.isFull ? "#ffb464" : "#8fce9f", fontWeight: 700, marginBottom: "1.25rem" }}>
            {program.isFull
              ? "Programme complet — vous pouvez vous inscrire sur la liste d'attente."
              : `${program.remaining} place${program.remaining !== 1 ? "s" : ""} restante${program.remaining !== 1 ? "s" : ""} sur ${program.capacity}`}
          </p>

          {/* ── Présentation ── */}
          <div style={card}>
            <h2 style={h2}>Objectifs de progression</h2>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#c3c2c8", fontSize: "0.85rem", lineHeight: 1.7 }}>
              {objectives.map((o) => <li key={o}>{o}</li>)}
            </ul>
          </div>
          <div style={card}>
            <h2 style={h2}>Les avantages</h2>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#c3c2c8", fontSize: "0.85rem", lineHeight: 1.7 }}>
              {advantages.map((o) => <li key={o}>{o}</li>)}
            </ul>
          </div>

          <div style={card}>
            <h2 style={h2}>Calendrier et lieux</h2>
            {program.dates.length > 0 ? (
              <>
                <p style={{ fontSize: "0.78rem", color: "#9d9da0", margin: "0 0 0.5rem" }}>{program.dates.length} pratiques planifiées</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  {(showAllDates ? program.dates : program.dates.slice(0, DATES_PREVIEW)).map((d) => (
                    <p key={d.id} style={{ fontSize: "0.82rem", color: "#c3c2c8", margin: 0 }}>
                      {formatSessionDate(d.session_date)} · {d.start_time.slice(0, 5)}–{d.end_time.slice(0, 5)} · {d.location}
                    </p>
                  ))}
                </div>
                {program.dates.length > DATES_PREVIEW && (
                  <button
                    type="button"
                    onClick={() => setShowAllDates((v) => !v)}
                    aria-expanded={showAllDates}
                    style={{ marginTop: "0.7rem", background: "none", border: "1px solid rgba(255,255,255,0.18)", borderRadius: "999px", color: "#e5e4ea", padding: "0.4rem 0.9rem", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}
                  >
                    {showAllDates ? "Voir moins" : `Voir tout le calendrier (${program.dates.length} pratiques)`}
                  </button>
                )}
                {program.matches > 0 && (
                  <p style={{ fontSize: "0.8rem", color: "#9d9da0", margin: "0.7rem 0 0" }}>
                    + {program.matches} matchs inclus : les dates seront annoncées aux familles inscrites.
                  </p>
                )}
              </>
            ) : (
              <p style={{ fontSize: "0.85rem", color: "#c3c2c8", margin: 0 }}>
                Le calendrier des {program.practices} pratiques et des {program.matches} matchs sera communiqué aux familles inscrites.
              </p>
            )}
            {(program.presentation.location || locations.length > 0) && program.dates.length === 0 && program.presentation.location && (
              <p style={{ fontSize: "0.82rem", color: "#c3c2c8", margin: "0.5rem 0 0" }}>Lieu : {program.presentation.location}</p>
            )}
            {program.presentation.coaches && program.presentation.coaches.length > 0 && (
              <p style={{ fontSize: "0.82rem", color: "#c3c2c8", margin: "0.6rem 0 0" }}>Entraîneurs : {program.presentation.coaches.join(", ")}</p>
            )}
          </div>

          {/* ── Essai gratuit du mardi ── */}
          <BoysTrialSection slug={program.slug} eligibleYears={program.eligibleBirthYears} />

          {/* ── Inscription ── */}
          {waitlisted ? (
            <div style={{ ...card, borderColor: "#8fce9f" }}>
              <p style={{ color: "#8fce9f", fontWeight: 700, margin: "0 0 0.3rem" }}>✓ Vous êtes sur la liste d&apos;attente.</p>
              <p style={{ color: "#c3c2c8", fontSize: "0.85rem", margin: 0 }}>Aucun paiement n&apos;est demandé. Nous vous écrirons si une place se libère.</p>
            </div>
          ) : (
            <div style={card}>
              <h2 style={h2}>{program.isFull ? "Liste d'attente" : "Inscrire mon enfant"}</h2>

              {!program.isFull && (
                <div style={{ marginBottom: "1rem" }}>
                  <p style={{ fontSize: "0.72rem", color: "#9f85ba", textTransform: "uppercase", margin: "0 0 0.4rem" }}>Mode de paiement</p>
                  <label className="nv27-radio" style={{ marginBottom: "0.6rem" }}>
                    <input type="radio" name="payopt" checked={option === "full"} onChange={() => setOption("full")} />
                    <span><strong>Paiement complet</strong> — {formatMoney(priceFull.totalCents)} en un seul paiement</span>
                  </label>
                  <label className="nv27-radio">
                    <input type="radio" name="payopt" checked={option === "two_installments"} onChange={() => setOption("two_installments")} />
                    <span>
                      <strong>2 versements</strong> — {formatMoney(priceTwo.totalCents)} au total ({formatMoney(priceTwo.paymentsCents[0])} aujourd&apos;hui +{" "}
                      {formatMoney(priceTwo.paymentsCents[1])} plus tard)
                    </span>
                  </label>
                  <p style={{ fontSize: "0.75rem", color: "#ffb464", margin: "0.5rem 0 0" }}>
                    Le paiement en 2 versements coûte {formatMoney(program.installmentFeeCents)} de plus au total.
                    {option === "two_installments" && (
                      <> Le 2ᵉ versement est prélevé {program.secondInstallmentDate ? `le ${new Date(program.secondInstallmentDate + "T12:00:00").toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}` : "environ 30 jours après l'inscription (date confirmée par courriel)"}.</>
                    )}
                  </p>
                </div>
              )}

              {/* Récapitulatif du prix */}
              {!program.isFull && (
                <div style={{ background: "#17151e", borderRadius: "8px", padding: "0.7rem 0.9rem", marginBottom: "1rem", fontSize: "0.82rem", color: "#c3c2c8" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Prix du programme</span><span>{formatMoney(price.listCents)}</span></div>
                  {price.referralDiscountCents > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#8fce9f" }}><span>Rabais de référencement</span><span>− {formatMoney(price.referralDiscountCents)}</span></div>
                  )}
                  {price.creditCents > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#8fce9f" }}><span>Crédit familial</span><span>− {formatMoney(price.creditCents)}</span></div>
                  )}
                  {price.installmentFeeCents > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>Supplément 2 versements</span><span>+ {formatMoney(price.installmentFeeCents)}</span></div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: "#fff", borderTop: "1px solid #302e36", marginTop: "0.4rem", paddingTop: "0.4rem" }}>
                    <span>Total à payer</span><span>{formatMoney(price.totalCents)}</span>
                  </div>
                  {option === "two_installments" && (
                    <div style={{ marginTop: "0.3rem", fontSize: "0.75rem" }}>
                      Aujourd&apos;hui : {formatMoney(price.paymentsCents[0])} · Ensuite : {formatMoney(price.paymentsCents[1])}
                    </div>
                  )}
                </div>
              )}

              <div className="nv27-form-fields">
                <p style={{ fontSize: "0.72rem", color: "#9f85ba", textTransform: "uppercase", margin: "0.25rem 0 0" }}>Enfant</p>
                <div className="nv27-grid2">
                  <label className="insc-field"><span>Prénom *</span><input className="insc-input" value={form.playerFirstName} onChange={(e) => set("playerFirstName", e.target.value)} /></label>
                  <label className="insc-field"><span>Nom *</span><input className="insc-input" value={form.playerLastName} onChange={(e) => set("playerLastName", e.target.value)} /></label>
                </div>
                <label className="insc-field">
                  <span>Année de naissance *</span>
                  <select className="insc-input" value={form.birthYear} onChange={(e) => set("birthYear", e.target.value)}>
                    <option value="">Choisir…</option>
                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </label>
                {ineligible && (
                  <p className="nv27-pay-error">
                    Ce programme est réservé aux garçons nés en {program.eligibleBirthYears.join(" et ")}. Cette année de naissance n&apos;est pas admissible.
                  </p>
                )}

                <p style={{ fontSize: "0.72rem", color: "#9f85ba", textTransform: "uppercase", margin: "1rem 0 0" }}>Parent</p>
                <div className="nv27-grid2">
                  <label className="insc-field"><span>Prénom *</span><input className="insc-input" value={form.parentFirstName} onChange={(e) => set("parentFirstName", e.target.value)} /></label>
                  <label className="insc-field"><span>Nom de famille *</span><input className="insc-input" value={form.parentLastName} onChange={(e) => set("parentLastName", e.target.value)} /></label>
                </div>
                <div className="nv27-grid2">
                  <label className="insc-field"><span>Courriel *</span><input type="email" className="insc-input" value={form.parentEmail} onChange={(e) => set("parentEmail", e.target.value)} /></label>
                  <label className="insc-field"><span>Téléphone *</span><input type="tel" className="insc-input" value={form.parentPhone} onChange={(e) => set("parentPhone", e.target.value)} /></label>
                </div>
                <label className="insc-field"><span>Ville</span><input className="insc-input" value={form.city} onChange={(e) => set("city", e.target.value)} /></label>

                {/* ── Référencement ── */}
                <p style={{ fontSize: "0.72rem", color: "#9f85ba", textTransform: "uppercase", margin: "1rem 0 0.2rem" }}>Recommandation</p>
                <p style={{ fontSize: "0.85rem", color: "#fff", margin: "0 0 0.4rem" }}>Une famille ou une personne vous a-t-elle recommandé New Valkyria ?</p>
                <div style={{ display: "flex", gap: "1.2rem", marginBottom: "0.5rem" }}>
                  <label className="nv27-radio"><input type="radio" name="refans" checked={referralAnswer === "oui"} onChange={() => setReferralAnswer("oui")} /><span>Oui</span></label>
                  <label className="nv27-radio"><input type="radio" name="refans" checked={referralAnswer === "non"} onChange={() => setReferralAnswer("non")} /><span>Non</span></label>
                </div>
                {referralAnswer === "oui" && (
                  <div style={{ background: "#17151e", borderRadius: "8px", padding: "0.8rem", marginBottom: "0.5rem" }}>
                    <label className="insc-field"><span>Code ou courriel du parent référent</span><input className="insc-input" value={refCodeOrEmail} onChange={(e) => setRefCodeOrEmail(e.target.value)} placeholder="ex. ABC123" /></label>
                    <label className="insc-field"><span>Nom et prénom du parent référent</span><input className="insc-input" value={referrerName} onChange={(e) => setReferrerName(e.target.value)} /></label>
                    <label className="insc-field"><span>Nom du joueur qui vous a recommandé le programme (si connu)</span><input className="insc-input" value={referrerPlayer} onChange={(e) => setReferrerPlayer(e.target.value)} /></label>
                    <p style={{ fontSize: "0.72rem", color: "#9d9da0", margin: 0 }}>
                      {refCodeOrEmail
                        ? `Le rabais de ${formatMoney(program.referralDiscountCents)} est appliqué si la recommandation est admissible.`
                        : "Indiquez le code ou le nom du parent : nous le validerons avec la famille."}
                    </p>
                  </div>
                )}

                {creditBalance > 0 && !program.isFull && (
                  <label className="insc-consent" style={{ marginTop: "0.5rem" }}>
                    <div className="insc-checkbox-wrap"><input type="checkbox" className="insc-checkbox" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} /><span className="insc-checkbox-custom" aria-hidden /></div>
                    <span>Utiliser mon crédit familial ({formatMoney(creditBalance)} disponible)</span>
                  </label>
                )}

                <label className="insc-field"><span>Commentaires</span><textarea className="insc-input insc-textarea" value={form.comments} onChange={(e) => set("comments", e.target.value)} /></label>

                <label className="insc-consent" style={{ marginTop: "0.75rem" }}>
                  <div className="insc-checkbox-wrap"><input type="checkbox" className="insc-checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /><span className="insc-checkbox-custom" aria-hidden /></div>
                  <span>J&apos;accepte les conditions du programme.</span>
                </label>
                {option === "two_installments" && !program.isFull && (
                  <label className="insc-consent" style={{ marginTop: "0.5rem" }}>
                    <div className="insc-checkbox-wrap"><input type="checkbox" className="insc-checkbox" checked={autoDebit} onChange={(e) => setAutoDebit(e.target.checked)} /><span className="insc-checkbox-custom" aria-hidden /></div>
                    <span>J&apos;autorise New Valkyria à prélever automatiquement le deuxième versement de {formatMoney(priceTwo.paymentsCents[1])} sur la carte utilisée aujourd&apos;hui.</span>
                  </label>
                )}

                {error && <p className="nv27-pay-error">{error}</p>}

                <button type="button" className="nv27-btn-primary" onClick={submit} disabled={submitting || ineligible} style={{ padding: "0.75rem", fontSize: "0.95rem", marginTop: "1rem" }}>
                  {submitting
                    ? "..."
                    : program.isFull
                      ? "Rejoindre la liste d'attente"
                      : option === "full"
                        ? `Inscrire mon enfant — ${formatMoney(price.totalCents)}`
                        : `Inscrire mon enfant — ${formatMoney(price.paymentsCents[0])} aujourd'hui`}
                </button>
              </div>
            </div>
          )}

          {/* ── Partage ── */}
          <div style={card}>
            <h2 style={h2}>Partager ce programme</h2>
            <ShareProgramButtons program={shareProgram} refCode={myCode} origin={program.origin} />
            {!myCode && (
              <p style={{ fontSize: "0.72rem", color: "#6d6b71", margin: "0.6rem 0 0" }}>
                Parent déjà inscrit ? <a href="/compte" style={{ color: "#c4a4e4" }}>Connectez-vous</a> pour partager votre lien personnel et obtenir une récompense.
              </p>
            )}
          </div>
        </Container>
      </section>
    </>
  );
}
