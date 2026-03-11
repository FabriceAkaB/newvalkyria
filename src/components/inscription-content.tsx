"use client";

import { useEffect, useRef, useState } from "react";

import { Container } from "@/components/container";
import { LeadCaptureForm } from "@/components/lead-capture-form";
import type { AgeCategory } from "@/lib/categories";
import { AGE_CATEGORIES, CATEGORY_LABELS, CATEGORY_SUBLABELS, getCategoryFromYear } from "@/lib/categories";
import type { CapacityData, CategoryCapacity } from "@/lib/capacity";
import type { AddonId } from "@/types/contracts";

const ADDONS = [
  {
    id: "tir",
    name: "Programme Tir",
    info: "7 séances · Groupe de 6 · Vendredi · Fin avril",
    tags: ["Finition", "Tir au but"],
    price: 170
  },
  {
    id: "dribble",
    name: "Programme Dribble",
    info: "7 séances · Groupe de 6 · Vendredi · Fin juin",
    tags: ["Feintes", "Dribbles"],
    price: 170
  },
  {
    id: "analyse",
    name: "Analyse de match",
    info: "2 matchs filmés · 45 min d'analyse · Caméra prêtée",
    tags: ["Vidéo", "Retours perso"],
    price: 75
  }
];

const BASE_PRICE = 550;
const POLL_INTERVAL = 10_000; // 10 secondes

type Props = {
  capacityByCategory: Record<AgeCategory, CategoryCapacity>;
  maxPerCategory: number;
};

export function InscriptionContent({ capacityByCategory: initialCapacity, maxPerCategory }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState<AgeCategory | null>(null);
  const [fromQual, setFromQual] = useState(false);

  // Live capacity — initialisé avec les données serveur, mis à jour par polling
  const [liveCapacity, setLiveCapacity] = useState<Record<AgeCategory, CategoryCapacity>>(initialCapacity);
  const [isLive, setIsLive] = useState(false); // true après le premier poll réussi
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

    // Premier poll immédiat
    void poll();

    // Puis toutes les 10 secondes
    intervalRef.current = setInterval(() => { void poll(); }, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectedAddons = ADDONS.filter((a) => selected.has(a.id));
  const total = BASE_PRICE + selectedAddons.reduce((s, a) => s + a.price, 0);

  const catCap = category ? liveCapacity[category] : null;
  const isFull = catCap?.isFull ?? false;

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
                  onClick={() => { setCategory(null); setFromQual(false); }}
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
                    onClick={() => { setCategory(cat); setFromQual(false); }}
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
                          ? `Les ${maxPerCategory} places pour ce groupe sont réservées. Rejoignez la liste d'attente ci-dessous.`
                          : catCap.remaining <= 3
                          ? `Il reste seulement ${catCap.remaining} place${catCap.remaining > 1 ? "s" : ""} pour ce groupe — réservez maintenant.`
                          : `${catCap.taken} place${catCap.taken > 1 ? "s" : ""} déjà confirmée${catCap.taken > 1 ? "s" : ""} sur ${maxPerCategory}. Groupe semi-privé, fermeture dès complet.`}
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
                    <p className="insc-cap-bar-legend">{catCap.taken}/{maxPerCategory} confirmées</p>
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
                        <p className="insc-base-info">15 séances semi-privées · Groupe de 10 · Lundi ou Mercredi</p>
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
                  {/* ── Étape 1 — Programme de base ── */}
                  <div className="insc-funnel-block">
                    <p className="insc-step-label">
                      <span className="insc-step-num">1</span>
                      Programme de base — toujours inclus
                    </p>
                    <div className="insc-base-card">
                      <div>
                        <span className="insc-included-badge">✓ Inclus</span>
                        <h2 className="insc-base-name">Programme Académique</h2>
                        <p className="insc-base-info">15 séances semi-privées · Groupe de 10 · Lundi ou Mercredi</p>
                        <div className="insc-base-tags">
                          <span>18h – 19h25 ou 19h30 – 20h55</span>
                          <span>Coach C CONCACAF</span>
                          <span>Suivi individualisé</span>
                          <span>Garantie séance 7</span>
                        </div>
                      </div>
                      <div className="insc-base-price">
                        <p className="insc-price-big">550 $</p>
                        <p className="insc-price-sub">/ saison</p>
                      </div>
                    </div>
                  </div>

                  {/* ── Étape 2 — Ajouts optionnels ── */}
                  <div className="insc-funnel-block">
                    <p className="insc-step-label">
                      <span className="insc-step-num">2</span>
                      Ajoutez des spécialisations — optionnel
                    </p>
                    <div className="insc-addons-grid">
                      {ADDONS.map((addon) => {
                        const isOn = selected.has(addon.id);
                        return (
                          <button
                            key={addon.id}
                            type="button"
                            onClick={() => toggle(addon.id)}
                            className={`insc-addon-card${isOn ? " insc-addon-selected" : ""}`}
                            aria-pressed={isOn}
                          >
                            <div className="insc-addon-check" aria-hidden>{isOn ? "✓" : "+"}</div>
                            <div className="insc-addon-body">
                              <p className="insc-addon-name">{addon.name}</p>
                              <p className="insc-addon-info">{addon.info}</p>
                              <div className="insc-addon-tags">
                                {addon.tags.map((t) => <span key={t}>{t}</span>)}
                              </div>
                            </div>
                            <p className="insc-addon-price">+ {addon.price} $</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Étape 3 — Récap + Formulaire ── */}
                  <div className="insc-funnel-block">
                    <p className="insc-step-label">
                      <span className="insc-step-num">3</span>
                      Vos informations et paiement
                    </p>
                    <div className="insc-summary">
                      <div className="insc-summary-lines">
                        <div className="insc-summary-line">
                          <span>Programme Académique</span>
                          <span>550 $</span>
                        </div>
                        {selectedAddons.map((a) => (
                          <div key={a.id} className="insc-summary-line insc-summary-addon">
                            <span>+ {a.name}</span>
                            <span>{a.price} $</span>
                          </div>
                        ))}
                      </div>
                      <div className="insc-summary-total">
                        <span>Total</span>
                        <span>{total} $</span>
                      </div>
                    </div>
                    <LeadCaptureForm
                      addons={Array.from(selected) as AddonId[]}
                      category={category}
                    />
                  </div>
                </>
              )}
            </>
          )}

        </Container>
      </section>
    </>
  );
}
