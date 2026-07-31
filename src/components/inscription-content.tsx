"use client";

import { useEffect, useRef, useState } from "react";

import { Container } from "@/components/container";
import { InscriptionForm, type InscriptionFormData } from "@/components/inscription-form";
import type { BirthYear, LiveAvailability, ProgramCode, SessionPreview } from "@/lib/season-2027";
import {
  BIRTH_YEAR_LABELS,
  PROGRAMS,
  findSlot,
  formatCAD,
  getBirthYearsFor,
  getProgramAvailability,
  getProgramsForYear,
  getSlotsFor
} from "@/lib/season-2027";

type Variant = "public" | "advanced" | "trial";
type SubmitState = "idle" | "loading" | "done";

/** Charge les vraies disponibilités (places prises) depuis la base pour que
 *  le tunnel n'affiche jamais un nombre de places qui ne correspond pas à
 *  la réalité gérée dans l'admin. Retombe brièvement sur les chiffres de
 *  démonstration statiques le temps du chargement. */
function useLiveAvailability(): LiveAvailability | null {
  const [live, setLive] = useState<LiveAvailability | null>(null);
  useEffect(() => {
    fetch("/api/inscription/disponibilites")
      .then((res) => res.json())
      .then((data: LiveAvailability) => setLive(data))
      .catch(() => setLive({ programCategory: {}, slots: {} }));
  }, []);
  return live;
}

interface BagOffer {
  active: boolean;
  productName?: string;
  priceCents?: number;
  free?: boolean;
}

/** Offre de lancement : sac New Valkyria inclus gratuitement pour les 30
 *  premiers clients payants, proposé en option payante ensuite. */
function useBagOffer(): BagOffer | null {
  const [offer, setOffer] = useState<BagOffer | null>(null);
  useEffect(() => {
    fetch("/api/inscription/offre-sac")
      .then((res) => res.json())
      .then((data: BagOffer) => setOffer(data))
      .catch(() => setOffer({ active: false }));
  }, []);
  return offer;
}

interface UniformBundleVariant {
  id: string;
  label: string;
  inventory_count: number;
  active: boolean;
}

interface UniformBundleOffer {
  active: boolean;
  jersey?: { id: string; name: string; priceCents: number; variants: UniformBundleVariant[] };
  short?: { id: string; name: string; priceCents: number; variants: UniformBundleVariant[] };
  socks?: { id: string; name: string; priceCents: number; inventoryCount: number };
}

/** Offre "2e uniforme" — proposée à tous les parents, au même endroit que
 *  l'offre du sac, juste avant le paiement du programme. */
function useUniformBundleOffer(): UniformBundleOffer | null {
  const [offer, setOffer] = useState<UniformBundleOffer | null>(null);
  useEffect(() => {
    fetch("/api/boutique/bundle-uniforme")
      .then((res) => res.json())
      .then((data: UniformBundleOffer) => setOffer(data))
      .catch(() => setOffer({ active: false }));
  }, []);
  return offer;
}

/* ── Espace parent — pré-remplissage depuis un profil enfant enregistré ── */

interface AccountChild {
  id: string;
  first_name: string;
  last_name: string;
  dob: string;
  level: string | null;
}

interface ParentAccount {
  loggedIn: boolean;
  fullName: string;
  email: string;
  children: AccountChild[];
}

function useParentAccount(): ParentAccount | null {
  const [account, setAccount] = useState<ParentAccount | null>(null);
  useEffect(() => {
    fetch("/api/compte/moi")
      .then((res) => res.json())
      .then((data: ParentAccount) => setAccount(data))
      .catch(() => setAccount({ loggedIn: false, fullName: "", email: "", children: [] }));
  }, []);
  return account;
}

function accountInitialData(account: ParentAccount, child?: AccountChild): Partial<InscriptionFormData> {
  const [first, ...rest] = (account.fullName || "").trim().split(" ");
  return {
    accFirst: first || "",
    accLast: rest.join(" "),
    accEmail: account.email || "",
    ...(child ? { plFirst: child.first_name, plLast: child.last_name, plDob: child.dob, plLevel: child.level || "" } : {})
  };
}

/** Gère l'étape optionnelle « choisir un profil enregistré » avant le formulaire.
 *  Tant que le compte n'a pas fini de charger ou que le choix n'est pas fait,
 *  `showPicker` reste vrai si des enfants existent ; sinon le formulaire peut
 *  s'afficher immédiatement avec les infos du compte pré-remplies (s'il y en a). */
function useChildQuickPick(account: ParentAccount | null) {
  const [choice, setChoice] = useState<{ child?: AccountChild } | null>(null);

  const autoResolved = account !== null && (!account.loggedIn || account.children.length === 0);
  const resolved = choice !== null || autoResolved;
  const showPicker = Boolean(account?.loggedIn && account.children.length > 0 && !resolved);
  const initialData = resolved && account ? accountInitialData(account, choice?.child) : undefined;

  const handlePick = (child: AccountChild) => setChoice({ child });
  const handleSkip = () => setChoice({});

  return { showPicker, initialData, handlePick, handleSkip };
}

function ChildQuickPick({
  account,
  onPick,
  onSkip
}: {
  account: ParentAccount;
  onPick: (child: AccountChild) => void;
  onSkip: () => void;
}) {
  if (!account.loggedIn || account.children.length === 0) return null;
  return (
    <div className="nv27-recap" style={{ cursor: "default", flexDirection: "column", alignItems: "flex-start", gap: "0.6rem" }}>
      <span className="nv27-recap-label">Continuer avec un profil enregistré</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {account.children.map((child) => (
          <button key={child.id} type="button" className="nv27-source-chip" onClick={() => onPick(child)}>
            {child.first_name} {child.last_name}
          </button>
        ))}
        <button type="button" className="nv27-source-chip" onClick={onSkip}>Nouveau profil</button>
      </div>
    </div>
  );
}

function Check() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2.5 6.2l2.3 2.3L9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SessionCard({ title, session }: { title: string; session: SessionPreview }) {
  return (
    <div className="nv27-incl-card">
      <p className="nv27-incl-title">{title}</p>
      <p className="nv27-incl-count">{session.count}</p>
      <ul className="nv27-incl-list">
        {session.schedule.map((line) => <li key={line}>{line}</li>)}
      </ul>
    </div>
  );
}

async function submitTrial(data: InscriptionFormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/inscription/essai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parentName: `${data.accFirst} ${data.accLast}`.trim(),
        parentEmail: data.accEmail,
        parentPhone: data.accPhone,
        city: data.accCity,
        playerFirstName: data.plFirst,
        playerLastName: data.plLast,
        playerDob: data.plDob || undefined
      })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return { ok: false, error: body?.error ?? "Une erreur est survenue." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Une erreur réseau est survenue. Veuillez réessayer." };
  }
}

async function submitCheckout(input: {
  data: InscriptionFormData;
  programCode: ProgramCode;
  year: BirthYear;
  slotId: string | null;
  variant: "public" | "advanced";
  includeBag: boolean;
  uniformBundle: { jerseyVariantId: string; shortVariantId: string } | null;
}): Promise<{ ok: boolean; checkoutUrl?: string; error?: string }> {
  try {
    const res = await fetch("/api/inscription/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parentName: `${input.data.accFirst} ${input.data.accLast}`.trim(),
        parentEmail: input.data.accEmail,
        parentPhone: input.data.accPhone,
        city: input.data.accCity,
        playerFirstName: input.data.plFirst,
        playerLastName: input.data.plLast,
        playerDob: input.data.plDob || undefined,
        programCode: input.programCode,
        year: input.year,
        slotId: input.slotId ?? undefined,
        variant: input.variant,
        includeBag: input.includeBag,
        uniformBundle: input.uniformBundle ?? undefined
      })
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: body?.error ?? "Une erreur est survenue." };
    }
    return { ok: true, checkoutUrl: body?.checkoutUrl };
  } catch {
    return { ok: false, error: "Une erreur réseau est survenue. Veuillez réessayer." };
  }
}

export function InscriptionContent({ variant = "public" }: { variant?: Variant }) {
  /* ── Mode Essai gratuit : uniquement le formulaire ── */
  if (variant === "trial") return <TrialFlow />;

  return <FunnelFlow variant={variant} />;
}

/* ════════════════════════════════════════════════════════════
   Essai gratuit — formulaire seul, sans programme/plage/paiement
   ════════════════════════════════════════════════════════════ */
function TrialFlow() {
  const [submit, setSubmit] = useState<SubmitState>("idle");
  const [error, setError] = useState<string | null>(null);
  const account = useParentAccount();
  const { showPicker, initialData, handlePick, handleSkip } = useChildQuickPick(account);

  const handleComplete = async (data: InscriptionFormData) => {
    setSubmit("loading");
    setError(null);
    const result = await submitTrial(data);
    if (!result.ok) {
      setError(result.error ?? "Une erreur est survenue.");
      setSubmit("idle");
      return;
    }
    setSubmit("done");
  };

  return (
    <>
      <section className="insc-hero">
        <Container>
          <div className="insc-hero-inner">
            <InscriptionTabs variant="trial" />
            <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Essai gratuit · Automne–Hiver 2027</p>
            <h1 className="insc-hero-title">Essai gratuit</h1>
            <p className="insc-hero-sub">
              Aucun programme ni horaire à choisir. Remplissez le formulaire : nous vous contacterons pour
              planifier une séance d&apos;essai gratuite adaptée à votre joueuse.
            </p>
            <SectionSwitch variant="trial" />
          </div>
        </Container>
      </section>

      <section className="section-band band-dark">
        <Container className="max-w-2xl">
          {submit === "done" ? (
            <div className="nv27-pay-done">
              <span className="nv27-pay-done-icon">✓</span>
              <p>Votre demande d&apos;essai gratuit a bien été reçue. Notre équipe vous contactera sous peu pour planifier la séance.</p>
            </div>
          ) : (
            <div className="nv27-step">
              <p className="nv27-step-kicker"><span className="nv27-step-n">1</span> Vos informations</p>
              {error && <p className="nv27-pay-error">{error}</p>}
              {showPicker && account ? (
                <ChildQuickPick account={account} onPick={handlePick} onSkip={handleSkip} />
              ) : (
                <InscriptionForm onComplete={handleComplete} finalLabel="Envoyer ma demande →" initialData={initialData} />
              )}
            </div>
          )}
        </Container>
      </section>
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   Tunnel complet — Automne/Hiver (public) et AV (avancé)
   ════════════════════════════════════════════════════════════ */
function FunnelFlow({ variant }: { variant: "public" | "advanced" }) {
  const [year, setYear] = useState<BirthYear | null>(null);
  const [programCode, setProgramCode] = useState<ProgramCode | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [formData, setFormData] = useState<InscriptionFormData | null>(null);
  const [submit, setSubmit] = useState<SubmitState>("idle");
  const [payError, setPayError] = useState<string | null>(null);
  const account = useParentAccount();
  const { showPicker, initialData, handlePick, handleSkip } = useChildQuickPick(account);
  const live = useLiveAvailability();
  const bagOffer = useBagOffer();
  const [includeBag, setIncludeBag] = useState(false);
  const uniformBundleOffer = useUniformBundleOffer();
  const [wantsUniformBundle, setWantsUniformBundle] = useState(false);
  const [uniformJerseySize, setUniformJerseySize] = useState("");
  const [uniformShortSize, setUniformShortSize] = useState("");

  const programRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const payRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (year) programRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [year]);
  useEffect(() => { if (programCode) slotRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [programCode]);
  useEffect(() => { if (slotId) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [slotId]);
  useEffect(() => { if (formData) payRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [formData]);

  const program = programCode ? PROGRAMS[programCode] : null;
  const slot = slotId ? findSlot(slotId) : null;

  const resetFrom = (level: "year" | "program" | "slot") => {
    if (level === "year") { setYear(null); setProgramCode(null); setSlotId(null); setFormData(null); }
    if (level === "program") { setProgramCode(null); setSlotId(null); setFormData(null); }
    if (level === "slot") { setSlotId(null); setFormData(null); }
    setSubmit("idle");
  };

  const wantsBag = Boolean(bagOffer?.active && (bagOffer.free || includeBag));
  const uniformBundleReady = Boolean(wantsUniformBundle && uniformJerseySize && uniformShortSize);

  const handlePay = async () => {
    if (!formData || !program || !year) return;
    if (wantsUniformBundle && !uniformBundleReady) {
      setPayError("Choisissez une taille de chandail et de short pour le 2e uniforme.");
      return;
    }
    setSubmit("loading");
    setPayError(null);
    const result = await submitCheckout({
      data: formData,
      programCode: program.code,
      year,
      slotId,
      variant,
      includeBag: wantsBag,
      uniformBundle: uniformBundleReady ? { jerseyVariantId: uniformJerseySize, shortVariantId: uniformShortSize } : null
    });
    if (!result.ok || !result.checkoutUrl) {
      setPayError(result.error ?? "Une erreur est survenue.");
      setSubmit("idle");
      return;
    }
    window.location.href = result.checkoutUrl;
  };

  const isAdvanced = variant === "advanced";
  const eyebrow = isAdvanced
    ? "✨ Inscription AV · Automne–Hiver 2027"
    : "Inscription · Automne–Hiver 2027";
  const heroTitle = isAdvanced ? "Inscription AV" : "Inscription";
  const heroSub = isAdvanced
    ? "Choisissez votre programme et votre plage — vous avez aussi accès aux plages régulières pour plus de flexibilité."
    : "Quelques questions simples, une étape à la fois. Réservez la place de votre joueuse en moins de deux minutes.";

  const years = getBirthYearsFor(variant);
  const programs = year ? getProgramsForYear(year, variant, live ?? undefined) : [];
  const slots = programCode && year ? getSlotsFor(programCode, year, variant, live ?? undefined) : [];

  return (
    <>
      <section className={`insc-hero${isAdvanced ? " nv27-hero-advanced" : ""}`}>
        <Container>
          <div className="insc-hero-inner">
            {!isAdvanced && <InscriptionTabs variant="public" />}
            {isAdvanced && (
              <div className="nv27-congrats">
                <span className="nv27-congrats-icon">🌟</span>
                <div>
                  <p className="nv27-congrats-title">Félicitations !</p>
                  <p className="nv27-congrats-text">
                    Votre joueuse a été sélectionnée pour le programme avancé de New Valkyria Académie.
                  </p>
                </div>
              </div>
            )}
            <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">{eyebrow}</p>
            <h1 className="insc-hero-title">{heroTitle}</h1>
            <p className="insc-hero-sub">{heroSub}</p>
            <SectionSwitch variant={variant} />
          </div>
        </Container>
      </section>

      <section className={`section-band band-dark${isAdvanced ? " nv27-advanced-zone" : ""}`}>
        <Container className="max-w-2xl">

          {/* ── Étape 1 — Année ── */}
          {year === null ? (
            <div className="nv27-step">
              <p className="nv27-step-kicker"><span className="nv27-step-n">1</span> Votre joueuse</p>
              <h2 className="nv27-step-q">Quelle est l&apos;année de naissance de votre joueuse ?</h2>
              <div className="nv27-year-grid">
                {years.map((y) => (
                  <button key={y} type="button" className={`nv27-year-btn${isAdvanced ? " nv27-year-btn-advanced" : ""}`} onClick={() => setYear(y)}>
                    {BIRTH_YEAR_LABELS[y]}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button type="button" className="nv27-recap" onClick={() => resetFrom("year")}>
              <span className="nv27-recap-label">Année de naissance</span>
              <span className="nv27-recap-value">{BIRTH_YEAR_LABELS[year]}</span>
              <span className="nv27-recap-edit">Modifier</span>
            </button>
          )}

          {/* ── Étape 2 — Programme ── */}
          {year !== null && (
            <div ref={programRef}>
              {programCode === null ? (
                <div className="nv27-step">
                  <p className="nv27-step-kicker"><span className="nv27-step-n">2</span> Le programme</p>
                  <h2 className="nv27-step-q">Choisissez votre programme</h2>
                  <div className="nv27-prog-stack">
                    {programs.map((p) => {
                      const av = getProgramAvailability(p.code, year, live ?? undefined);
                      return (
                        <button
                          key={p.code}
                          type="button"
                          disabled={av.isFull}
                          onClick={() => !av.isFull && setProgramCode(p.code)}
                          className={`nv27-prog-card${av.isFull ? " nv27-prog-full" : ""}${p.badge && !av.isFull ? " nv27-prog-featured" : ""}`}
                        >
                          {p.badge && <span className="nv27-prog-badge">{p.badge}</span>}
                          <div className="nv27-prog-main">
                            <div className="nv27-prog-toprow">
                              <h3 className="nv27-prog-name">{p.name}</h3>
                              {av.isFull
                                ? <span className="nv27-badge nv27-badge-full">Complet</span>
                                : <span className="nv27-availchip">Il reste {av.remaining} place{av.remaining > 1 ? "s" : ""}</span>}
                            </div>
                            <p className="nv27-prog-tagline">{p.tagline}</p>
                            <ul className="nv27-prog-list">
                              {p.includes.map((inc) => (
                                <li key={inc}><span className="nv27-check"><Check /></span>{inc}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="nv27-prog-side">
                            <span className="nv27-prog-price">{p.priceLabel}</span>
                            <span className="nv27-prog-price-sub">/ saison</span>
                            {!av.isFull && <span className="nv27-prog-choose">Choisir →</span>}
                          </div>
                        </button>
                      );
                    })}
                    {programs.length === 0 && (
                      <p className="nv27-empty">Aucun programme n&apos;est disponible pour cette catégorie pour le moment.</p>
                    )}
                  </div>
                </div>
              ) : program && (
                <button type="button" className="nv27-recap" onClick={() => resetFrom("program")}>
                  <span className="nv27-recap-label">Programme</span>
                  <span className="nv27-recap-value">{program.name} · {program.priceLabel}</span>
                  <span className="nv27-recap-edit">Modifier</span>
                </button>
              )}
            </div>
          )}

          {/* ── Étape 3 — Plage horaire ── */}
          {programCode !== null && program && (
            <div ref={slotRef}>
              {slotId === null ? (
                <div className="nv27-step">
                  <p className="nv27-step-kicker"><span className="nv27-step-n">3</span> La plage horaire</p>
                  <h2 className="nv27-step-q">Choisissez votre pratique technique</h2>

                  {/* Aperçu de ce qui est aussi inclus (auto, sans choix) */}
                  {(program.teamPractice || program.soloSession) && (
                    <div className="nv27-incl-wrap">
                      <p className="nv27-incl-intro">Également inclus dans ce programme, sans choix à faire :</p>
                      <div className="nv27-incl-grid">
                        {program.teamPractice && <SessionCard title="Pratiques d'équipe" session={program.teamPractice} />}
                        {program.soloSession && <SessionCard title="Séances individuelles" session={program.soloSession} />}
                      </div>
                    </div>
                  )}

                  <p className="nv27-slot-label">Votre pratique technique de semaine :</p>
                  <div className="nv27-slot-stack">
                    {slots.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        disabled={s.isFull}
                        onClick={() => !s.isFull && setSlotId(s.id)}
                        className={`nv27-slot-card${s.isFull ? " nv27-slot-full" : ""}${s.recommended ? " nv27-slot-reco" : ""}`}
                      >
                        <div className="nv27-slot-info">
                          {s.recommended && <span className="nv27-reco-tag">⭐ Plage réservée — dédiée au groupe avancé</span>}
                          <span className="nv27-slot-day">{s.day}</span>
                          <span className="nv27-slot-meta">{s.time} · {s.location}</span>
                        </div>
                        <div className="nv27-slot-right">
                          {s.isFull
                            ? <span className="nv27-badge nv27-badge-full">Complet</span>
                            : <span className="nv27-availchip">Il reste {s.remaining} place{s.remaining > 1 ? "s" : ""}</span>}
                        </div>
                      </button>
                    ))}
                    {slots.length === 0 && (
                      <p className="nv27-empty">Aucune plage disponible pour ce programme actuellement.</p>
                    )}
                    {slots.length > 0 && slots.every((s) => s.isFull) && (
                      <p className="nv27-empty">Toutes les plages sont complètes — contactez-nous pour la liste d&apos;attente.</p>
                    )}
                  </div>
                </div>
              ) : slot && (
                <button type="button" className="nv27-recap" onClick={() => resetFrom("slot")}>
                  <span className="nv27-recap-label">Plage horaire</span>
                  <span className="nv27-recap-value">{slot.day} — {slot.time} · {slot.location}</span>
                  <span className="nv27-recap-edit">Modifier</span>
                </button>
              )}
            </div>
          )}

          {/* ── Étape 4 — Formulaire ── */}
          {slotId !== null && formData === null && (
            <div ref={formRef} className="nv27-step">
              <p className="nv27-step-kicker"><span className="nv27-step-n">4</span> Vos informations</p>
              {showPicker && account ? (
                <ChildQuickPick account={account} onPick={handlePick} onSkip={handleSkip} />
              ) : (
                <InscriptionForm onComplete={setFormData} initialData={initialData} />
              )}
            </div>
          )}

          {/* ── Étape 5 — Paiement (sans taxes) ── */}
          {formData !== null && program && (
            <div ref={payRef} className="nv27-step">
              <p className="nv27-step-kicker"><span className="nv27-step-n">5</span> Paiement</p>
              <h2 className="nv27-step-q">Résumé de l&apos;inscription</h2>

              {bagOffer?.active && (
                bagOffer.free ? (
                  <div className="nv27-pay-done" style={{ marginBottom: "1rem" }}>
                    <span className="nv27-pay-done-icon">🎁</span>
                    <p>{bagOffer.productName} inclus gratuitement — vous faites partie des 30 premiers clients de la saison !</p>
                  </div>
                ) : (
                  <label className="nv27-radio" style={{ marginBottom: "1rem" }}>
                    <input type="checkbox" checked={includeBag} onChange={(e) => setIncludeBag(e.target.checked)} />
                    <span>Ajouter un {bagOffer.productName} ({formatCAD((bagOffer.priceCents ?? 0) / 100)}) à ma commande</span>
                  </label>
                )
              )}

              {uniformBundleOffer?.active && uniformBundleOffer.jersey && uniformBundleOffer.short && uniformBundleOffer.socks && (
                <div style={{ background: "#100e17", border: "1px solid #251f30", borderRadius: "12px", padding: "1rem 1.1rem", marginBottom: "1rem" }}>
                  <label className="nv27-radio" style={{ marginBottom: wantsUniformBundle ? "0.85rem" : 0 }}>
                    <input type="checkbox" checked={wantsUniformBundle} onChange={(e) => setWantsUniformBundle(e.target.checked)} />
                    <span>
                      🎁 Voulez-vous un 2e uniforme ? {uniformBundleOffer.jersey.name} + {uniformBundleOffer.short.name} au prix régulier
                      — {uniformBundleOffer.socks.name.toLowerCase()} offerts !
                    </span>
                  </label>
                  {wantsUniformBundle && (
                    <div className="nv27-grid2">
                      <label className="admin-field" style={{ gap: "0.35rem" }}>
                        <span style={{ fontSize: "0.68rem", color: "#7a7982", textTransform: "uppercase", letterSpacing: "0.08em" }}>Taille du chandail</span>
                        <select className="shop-size-select" value={uniformJerseySize} onChange={(e) => setUniformJerseySize(e.target.value)}>
                          <option value="" disabled>Choisir…</option>
                          {uniformBundleOffer.jersey.variants.filter((v) => v.active).map((v) => (
                            <option key={v.id} value={v.id} disabled={v.inventory_count <= 0}>
                              {v.label}{v.inventory_count <= 0 ? " — épuisé" : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="admin-field" style={{ gap: "0.35rem" }}>
                        <span style={{ fontSize: "0.68rem", color: "#7a7982", textTransform: "uppercase", letterSpacing: "0.08em" }}>Taille du short</span>
                        <select className="shop-size-select" value={uniformShortSize} onChange={(e) => setUniformShortSize(e.target.value)}>
                          <option value="" disabled>Choisir…</option>
                          {uniformBundleOffer.short.variants.filter((v) => v.active).map((v) => (
                            <option key={v.id} value={v.id} disabled={v.inventory_count <= 0}>
                              {v.label}{v.inventory_count <= 0 ? " — épuisé" : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              )}

              <div className="nv27-pay-summary">
                <div className="nv27-pay-row"><span>Programme choisi</span><span>{program.name}</span></div>
                {slot && <div className="nv27-pay-row"><span>Plage horaire</span><span>{slot.day} — {slot.time}</span></div>}
                {wantsBag && (
                  <div className="nv27-pay-row">
                    <span>{bagOffer?.productName}</span>
                    <span>{bagOffer?.free ? "Gratuit" : formatCAD((bagOffer?.priceCents ?? 0) / 100)}</span>
                  </div>
                )}
                {uniformBundleReady && uniformBundleOffer?.jersey && uniformBundleOffer.short && uniformBundleOffer.socks && (
                  <>
                    <div className="nv27-pay-row"><span>{uniformBundleOffer.jersey.name} (2e)</span><span>{formatCAD(uniformBundleOffer.jersey.priceCents / 100)}</span></div>
                    <div className="nv27-pay-row"><span>{uniformBundleOffer.short.name} (2e)</span><span>{formatCAD(uniformBundleOffer.short.priceCents / 100)}</span></div>
                    <div className="nv27-pay-row"><span>{uniformBundleOffer.socks.name}</span><span>Gratuit</span></div>
                  </>
                )}
                <div className="nv27-pay-total">
                  <span>Montant total</span>
                  <span>
                    {formatCAD(
                      program.price
                      + (wantsBag && !bagOffer?.free ? (bagOffer?.priceCents ?? 0) / 100 : 0)
                      + (uniformBundleReady && uniformBundleOffer?.jersey && uniformBundleOffer.short
                        ? (uniformBundleOffer.jersey.priceCents + uniformBundleOffer.short.priceCents) / 100
                        : 0)
                    )}
                  </span>
                </div>
              </div>

              {payError && <p className="nv27-pay-error">{payError}</p>}
              <button type="button" className="nv27-btn-primary nv27-btn-pay" disabled={submit === "loading"} onClick={handlePay}>
                {submit === "loading" ? "Redirection vers le paiement…" : "Procéder au paiement →"}
              </button>
              <p className="nv27-pay-note">Paiement sécurisé · Aucune donnée de carte n&apos;est stockée par l&apos;académie.</p>
            </div>
          )}

        </Container>
      </section>
    </>
  );
}

/* ── Sous-onglets « Inscription Automne / Hiver » · « Essai gratuit » ── */
function InscriptionTabs({ variant }: { variant: Variant }) {
  return (
    <div className="nv27-tabs" role="tablist" aria-label="Type d'inscription">
      <a
        href="/inscription"
        role="tab"
        aria-selected={variant === "public"}
        className={`nv27-tab${variant === "public" ? " nv27-tab-active" : ""}`}
      >
        Inscription Automne / Hiver
      </a>
      <a
        href="/inscription/essai"
        role="tab"
        aria-selected={variant === "trial"}
        className={`nv27-tab${variant === "trial" ? " nv27-tab-active" : ""}`}
      >
        Essai gratuit
      </a>
    </div>
  );
}

/* ── Lien secondaire vers l'accès sur invitation ── */
function SectionSwitch({ variant }: { variant: Variant }) {
  if (variant === "advanced") {
    return (
      <div className="nv27-switch">
        <a href="/inscription">Inscription régulière</a>
        <a href="/inscription/essai">Essai gratuit</a>
      </div>
    );
  }
  return (
    <div className="nv27-switch">
      <a href="/inscription/invitation">J&apos;ai un code d&apos;accès</a>
    </div>
  );
}
