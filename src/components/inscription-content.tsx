"use client";

import { useEffect, useRef, useState } from "react";

import { Container } from "@/components/container";
import { LeadCaptureForm } from "@/components/lead-capture-form";
import type { AgeCategory } from "@/lib/categories";
import { AGE_CATEGORIES, CATEGORY_LABELS, CATEGORY_SUBLABELS, getCategoryFromYear } from "@/lib/categories";
import type { CapacityData, CategoryCapacity } from "@/lib/capacity";

type OfferType = "elite" | "half-season" | "trial";

const POLL_INTERVAL = 10_000; // 10 secondes

/* ── Time slots per category (mirrors qualification-form) ── */
interface TimeSlot {
  id: string;
  day: string;
  horaire: string;
  practices: number;
}

const TIME_SLOTS: Record<AgeCategory, TimeSlot[]> = {
  "2016": [
    { id: "mar-2016", day: "Mardi", horaire: "18h00 à 19h15", practices: 17 }
  ],
  "2015": [
    { id: "lun-2015", day: "Lundi", horaire: "18h00 à 19h30", practices: 15 },
    { id: "mer-2015", day: "Mercredi", horaire: "19h25 à 20h55", practices: 15 },
    { id: "jeu-2015", day: "Jeudi", horaire: "18h00 à 19h15", practices: 17 }
  ],
  "2014-2013": [
    { id: "ven-2014", day: "Vendredi", horaire: "18h00 à 19h15", practices: 17 }
  ]
};

type Props = {
  capacityByCategory: Record<AgeCategory, CategoryCapacity>;
  maxPerCategory: number;
};

export function InscriptionContent({ capacityByCategory: initialCapacity, maxPerCategory }: Props) {
  const [category, setCategory] = useState<AgeCategory | null>(null);
  const [fromQual, setFromQual] = useState(false);
  const [offer, setOffer] = useState<OfferType | null>(null);
  const [slotId, setSlotId] = useState<string>("");

  // Live capacity — initialisé avec les données serveur, mis à jour par polling
  const [liveCapacity, setLiveCapacity] = useState<Record<AgeCategory, CategoryCapacity>>(initialCapacity);
  const [isLive, setIsLive] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lecture localStorage (catégorie pré-remplie depuis qualification)
  useEffect(() => {
    const stored = localStorage.getItem("nv_category") as AgeCategory | null;
    if (stored && AGE_CATEGORIES.includes(stored)) {
      setCategory(stored);
      setFromQual(true);
      return;
    }
    const year = localStorage.getItem("nv_birth_year");
    if (year) {
      const cat = getCategoryFromYear(year);
      if (cat) { setCategory(cat); setFromQual(true); }
    }
  }, []);

  // Polling live de la capacité
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/capacity", { cache: "no-store" });
        if (!res.ok) return;
        const data: CapacityData = await res.json() as CapacityData;
        setLiveCapacity(data.byCategory);
        setIsLive(true);
      } catch {
        // silencieux — on garde les données précédentes
      }
    };

    void poll();
    intervalRef.current = setInterval(() => { void poll(); }, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Auto-select default slot when category changes
  useEffect(() => {
    if (!category) { setSlotId(""); return; }
    const slots = TIME_SLOTS[category];
    if (slots.length === 1) setSlotId(slots[0].id);
    else setSlotId("");
  }, [category]);

  const catCap = category ? liveCapacity[category] : null;
  const isFull = catCap?.isFull ?? false;

  const slots = category ? TIME_SLOTS[category] : [];
  const hasSlotChoice = slots.length > 1;
  const selectedSlot = slots.find((s) => s.id === slotId) ?? (slots.length === 1 ? slots[0] : null);
  const timeSlotLabel = selectedSlot ? `${selectedSlot.day} — ${selectedSlot.horaire}` : "";
  const practiceCount = selectedSlot?.practices ?? 15;

  const offerReady = offer !== null && (!hasSlotChoice || slotId !== "");

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="insc-hero">
        <Container>
          <div className="insc-hero-inner">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Inscription 2026</p>
            <h1 className="insc-hero-title">
              Réservez votre<br className="hidden sm:block" /> place
            </h1>
          </div>
        </Container>
      </section>

      <section className="section-band band-dark">
        <Container className="max-w-3xl">

          {/* ── Sélecteur de catégorie ──────────────────────── */}
          <div className="insc-cat-block">
            <div className="insc-cat-header">
              <div className="insc-cat-header-left">
                <p className="insc-cat-title">
                  {fromQual && category
                    ? "Votre catégorie détectée"
                    : "Sélectionnez la catégorie de votre joueuse"}
                </p>
                {isLive && (
                  <span className="insc-live-badge" aria-label="Disponibilité en temps réel">
                    <span className="insc-live-dot" aria-hidden />
                    Live
                  </span>
                )}
              </div>
              {fromQual && category && (
                <button
                  type="button"
                  className="insc-cat-change"
                  onClick={() => { setCategory(null); setFromQual(false); setOffer(null); }}
                >
                  Changer
                </button>
              )}
            </div>

            {/* Chips de catégorie */}
            <div className="insc-cat-chips">
              {AGE_CATEGORIES.map((cat) => {
                const cap = liveCapacity[cat];
                const isSelected = category === cat;
                const locked = fromQual && category !== null && !isSelected;
                return (
                  <button
                    key={cat}
                    type="button"
                    disabled={locked}
                    onClick={() => { setCategory(cat); setFromQual(false); setOffer(null); }}
                    className={[
                      "insc-cat-chip",
                      isSelected ? "insc-cat-chip-active" : "",
                      cap.isFull ? "insc-cat-chip-full" : "",
                      locked ? "insc-cat-chip-locked" : ""
                    ].filter(Boolean).join(" ")}
                    aria-pressed={isSelected}
                  >
                    <span className="insc-cat-chip-label">{CATEGORY_LABELS[cat]}</span>
                    <span className="insc-cat-chip-sub">{CATEGORY_SUBLABELS[cat]}</span>
                    <span className={`insc-cat-chip-badge ${cap.isFull ? "insc-badge-full" : cap.remaining <= 3 ? "insc-badge-urgent" : "insc-badge-ok"}`}>
                      {cap.isFull ? "Complet" : `${cap.remaining} place${cap.remaining > 1 ? "s" : ""}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Rien affiché si aucune catégorie choisie ─────── */}
          {!category && (
            <div className="insc-cat-prompt">
              <p>Sélectionnez une catégorie ci-dessus pour voir la disponibilité et accéder au formulaire.</p>
            </div>
          )}

          {/* ── Catégorie choisie ─────────────────────────────── */}
          {category && (
            <>
              {/* ── Bloc de capacité pour la catégorie choisie ── */}
              {catCap && (
                <div className={`insc-cap-block${catCap.remaining <= 3 && !catCap.isFull ? " insc-cap-urgent" : ""}${catCap.isFull ? " insc-cap-full" : ""}`}>
                  <div className="insc-cap-left">
                    {(catCap.remaining <= 3 || catCap.isFull) && <span className="insc-cap-dot" aria-hidden />}
                    <div>
                      <p className="insc-cap-top-label">
                        {catCap.isFull
                          ? `Groupe ${CATEGORY_LABELS[category]} — complet`
                          : catCap.remaining <= 3
                          ? `⚡ Dernières places — ${CATEGORY_LABELS[category]}`
                          : `Disponibilité — ${CATEGORY_LABELS[category]}`}
                      </p>
                      <p className="insc-cap-desc">
                        {catCap.isFull
                          ? `Les ${catCap.max} places pour ce groupe sont réservées. Rejoignez la liste d'attente ci-dessous.`
                          : catCap.remaining <= 3
                          ? `Il reste seulement ${catCap.remaining} place${catCap.remaining > 1 ? "s" : ""} pour ce groupe — réservez maintenant.`
                          : `${catCap.taken} place${catCap.taken > 1 ? "s" : ""} déjà confirmée${catCap.taken > 1 ? "s" : ""} sur ${catCap.max}. Groupe semi-privé, fermeture dès complet.`}
                      </p>
                    </div>
                  </div>
                  <div className="insc-cap-right">
                    <div className="insc-cap-big-num">
                      <span className={`insc-cap-num${catCap.isFull ? " insc-cap-num-full" : ""}`}>
                        {catCap.remaining}
                      </span>
                      <span className="insc-cap-num-label">
                        place{catCap.remaining > 1 ? "s" : ""}<br />
                        restante{catCap.remaining > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="insc-cap-bar-track">
                      <div
                        className={`insc-cap-bar-fill${catCap.remaining <= 3 ? " insc-cap-bar-urgent" : ""}`}
                        style={{ width: `${catCap.percentage}%` }}
                      />
                    </div>
                    <p className="insc-cap-bar-legend">{catCap.taken}/{catCap.max} confirmées</p>
                  </div>
                </div>
              )}

              {/* ── COMPLET → funnel liste d'attente ─────────── */}
              {isFull ? (
                <>
                  <div className="insc-funnel-block">
                    <p className="insc-step-label">
                      <span className="insc-step-num">1</span>
                      Place réservée — liste d&apos;attente
                    </p>
                    <div className="insc-base-card">
                      <div>
                        <span className="insc-included-badge insc-waitlist-badge">⏳ Liste d&apos;attente</span>
                        <h2 className="insc-base-name">Programme Académique</h2>
                        <p className="insc-base-info">15 séances semi-privées · Groupe de 10</p>
                        <div className="insc-base-tags">
                          <span>Priorité garantie si désistement</span>
                          <span>Remboursé si aucune place</span>
                          <span>Coach C CONCACAF</span>
                        </div>
                      </div>
                      <div className="insc-base-price">
                        <p className="insc-price-big">550 $</p>
                        <p className="insc-price-sub">/ saison</p>
                      </div>
                    </div>
                  </div>

                  <div className="insc-funnel-block">
                    <p className="insc-step-label">
                      <span className="insc-step-num">2</span>
                      Vos informations et paiement
                    </p>
                    <LeadCaptureForm
                      addons={[]}
                      category={category}
                      isWaitlist={true}
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* ── Étape 1 — Créneau horaire (uniquement si plusieurs) ── */}
                  {hasSlotChoice && (
                    <div className="insc-funnel-block">
                      <p className="insc-step-label">
                        <span className="insc-step-num">1</span>
                        Choisissez votre créneau horaire
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {slots.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSlotId(s.id)}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "0.85rem 1.1rem",
                              background: slotId === s.id ? "rgba(196,164,228,0.2)" : "rgba(255,255,255,0.03)",
                              border: slotId === s.id ? "2px solid rgba(196,164,228,0.7)" : "1px solid rgba(255,255,255,0.1)",
                              borderRadius: "10px",
                              cursor: "pointer",
                              color: "#fff",
                              textAlign: "left",
                            }}
                          >
                            <div>
                              <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>{s.day}</span>
                              <span style={{ marginLeft: "0.6rem", fontSize: "0.85rem", color: "rgba(255,255,255,0.6)" }}>{s.horaire}</span>
                            </div>
                            <span style={{ fontSize: "0.75rem", color: "rgba(196,164,228,0.8)" }}>{s.practices} pratiques</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Étape — Choisir l'offre ── */}
                  <div className="insc-funnel-block">
                    <p className="insc-step-label">
                      <span className="insc-step-num">{hasSlotChoice ? 2 : 1}</span>
                      Choisissez votre offre
                    </p>

                    <div style={{ display: "grid", gap: "0.85rem" }}>
                      {/* Élite */}
                      <button
                        type="button"
                        onClick={() => setOffer("elite")}
                        className={`insc-base-card${offer === "elite" ? " insc-cat-chip-active" : ""}`}
                        style={{
                          textAlign: "left",
                          cursor: "pointer",
                          width: "100%",
                          border: offer === "elite" ? "2px solid rgba(196,164,228,0.7)" : "1px solid rgba(255,255,255,0.08)",
                          background: offer === "elite" ? "rgba(196,164,228,0.08)" : "rgba(255,255,255,0.02)",
                        }}
                      >
                        <div>
                          <span className="insc-included-badge">Saison complète</span>
                          <h2 className="insc-base-name">Programme Élite</h2>
                          <p className="insc-base-info">{practiceCount} séances · Groupe de 10 · Suivi individualisé</p>
                          <div className="insc-base-tags">
                            <span>Coach C CONCACAF</span>
                            <span>Garantie séance 7</span>
                            <span>Bonus tir &amp; dribble dimanche</span>
                          </div>
                        </div>
                        <div className="insc-base-price">
                          <p className="insc-price-big">550 $</p>
                          <p className="insc-price-sub">/ saison</p>
                        </div>
                      </button>

                      {/* Demi-saison */}
                      <button
                        type="button"
                        onClick={() => setOffer("half-season")}
                        className={`insc-base-card${offer === "half-season" ? " insc-cat-chip-active" : ""}`}
                        style={{
                          textAlign: "left",
                          cursor: "pointer",
                          width: "100%",
                          border: offer === "half-season" ? "2px solid rgba(196,164,228,0.7)" : "1px solid rgba(255,255,255,0.08)",
                          background: offer === "half-season" ? "rgba(196,164,228,0.08)" : "rgba(255,255,255,0.02)",
                        }}
                      >
                        <div>
                          <span className="insc-included-badge">Demi-saison</span>
                          <h2 className="insc-base-name">Demi-saison</h2>
                          <p className="insc-base-info">7 séances · Groupe semi-privé · Sans engagement long</p>
                          <div className="insc-base-tags">
                            <span>Idéal pour découvrir</span>
                            <span>Coach C CONCACAF</span>
                          </div>
                        </div>
                        <div className="insc-base-price">
                          <p className="insc-price-big">275 $</p>
                          <p className="insc-price-sub">/ 7 séances</p>
                        </div>
                      </button>

                      {/* Essai gratuit */}
                      <button
                        type="button"
                        onClick={() => setOffer("trial")}
                        className={`insc-base-card${offer === "trial" ? " insc-cat-chip-active" : ""}`}
                        style={{
                          textAlign: "left",
                          cursor: "pointer",
                          width: "100%",
                          border: offer === "trial" ? "2px solid rgba(196,164,228,0.7)" : "1px solid rgba(255,255,255,0.08)",
                          background: offer === "trial" ? "rgba(196,164,228,0.08)" : "rgba(255,255,255,0.02)",
                        }}
                      >
                        <div>
                          <span className="insc-included-badge insc-waitlist-badge">Gratuit</span>
                          <h2 className="insc-base-name">Essai gratuit — 3 séances</h2>
                          <p className="insc-base-info">Découvrez le programme sans engagement.</p>
                          <div className="insc-base-tags">
                            <span>0 $ aujourd&apos;hui</span>
                            <span>Carte requise pour valider</span>
                            <span>Aucun prélèvement</span>
                          </div>
                        </div>
                        <div className="insc-base-price">
                          <p className="insc-price-big">0 $</p>
                          <p className="insc-price-sub">Essai gratuit</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* ── Étape — Récap + Formulaire ── */}
                  {offerReady && (
                    <div className="insc-funnel-block">
                      <p className="insc-step-label">
                        <span className="insc-step-num">{hasSlotChoice ? 3 : 2}</span>
                        Vos informations {offer === "trial" ? "" : "et paiement"}
                      </p>
                      <div className="insc-summary">
                        <div className="insc-summary-lines">
                          <div className="insc-summary-line">
                            <span>
                              {offer === "elite" && "Programme Élite"}
                              {offer === "half-season" && "Demi-saison (7 séances)"}
                              {offer === "trial" && "Essai gratuit — 3 séances"}
                            </span>
                            <span>
                              {offer === "elite" && "550 $"}
                              {offer === "half-season" && "275 $"}
                              {offer === "trial" && "0 $"}
                            </span>
                          </div>
                          {selectedSlot && (
                            <div className="insc-summary-line insc-summary-addon">
                              <span>{selectedSlot.day} — {selectedSlot.horaire}</span>
                              <span>{selectedSlot.practices} pratiques</span>
                            </div>
                          )}
                        </div>
                        <div className="insc-summary-total">
                          <span>Total</span>
                          <span>
                            {offer === "elite" && "550 $"}
                            {offer === "half-season" && "275 $"}
                            {offer === "trial" && "0 $"}
                          </span>
                        </div>
                      </div>
                      <LeadCaptureForm
                        addons={[]}
                        category={category}
                        checkoutType={offer}
                        timeSlot={timeSlotLabel || undefined}
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}

        </Container>
      </section>
    </>
  );
}
