import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/container";
import { keyResults, methodSections, timeline } from "@/lib/site-content";
import dsc05480 from "@/content/image/photos/DSC05480.jpg";
import dsc02155 from "@/content/image/photos/DSC02155.jpg";
import dsc03078 from "@/content/image/photos/DSC03078.jpg";
import methodeHeroImg from "@/content/image/photos/DSC02406.jpg";

const pillarImages = [dsc05480, dsc02155, dsc03078];
const pillarAlts = [
  "Technique — joueuse en frappe",
  "Mental — concentration et focus",
  "Physique — intensité en mouvement"
];

export const metadata: Metadata = {
  title: "Méthode | New Valkyria",
  description: "Approche technique, mentale et physique pour la progression des jeunes joueuses."
};

const heroStats = [
  { val: "90 min", label: "Par séance" },
  { val: "1 : 5",  label: "Ratio renforcé" },
  { val: "S7+S15", label: "Bilans formels" }
];

const philosophyItems = [
  {
    label: "Opposition réelle",
    desc: "Les décisions se développent sous pression, pas dans des exercices statiques. Chaque séance simule les conditions du match."
  },
  {
    label: "Discipline de cadre",
    desc: "Qualité et intensité protégées à chaque séance. Le cadre exigeant est ce qui produit la progression."
  },
  {
    label: "Progression documentée",
    desc: "Rapports remis aux parents à la 7e et 15e séance. Pas juste ressentie — mesurée et communiquée clairement."
  }
];

export default function MethodePage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="page-hero" style={{ minHeight: "600px" }}>
        <Image src={methodeHeroImg} alt="" fill priority className="object-cover object-center" aria-hidden />
        <div className="page-hero-overlay" />
        <div className="page-hero-content w-full">
          <Container>
            <span className="nv-label">Méthode New Valkyria</span>
            <h1 className="page-hero-title">
              Entraîner<br />différemment
            </h1>
            <p className="page-hero-sub">
              Chaque séance est construite avec une logique précise : intensité haute, feedback immédiat, progression documentée.
            </p>
            {/* Stat pills */}
            <div style={{ display: "flex", gap: "1px", background: "rgba(255,255,255,0.06)", borderRadius: "1rem", overflow: "hidden", marginTop: "2.5rem", width: "fit-content" }}>
              {heroStats.map((s) => (
                <div key={s.val} style={{ display: "flex", flexDirection: "column", gap: "0.25rem", padding: "1.25rem 2.25rem", background: "rgba(9,7,14,0.7)" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-accent-soft)", lineHeight: 1 }}>{s.val}</span>
                  <span style={{ fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "0.2em", color: "rgba(255,255,255,0.38)" }}>{s.label}</span>
                </div>
              ))}
            </div>
          </Container>
        </div>
      </section>

      {/* ── 3 Piliers (alternating) ──────────────────────────── */}
      <section className="nv-section-band-dark">
        <Container>
          <span className="nv-label">Les 3 piliers</span>
          <h2 className="nv-heading">Ce sur quoi on travaille</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "6rem", marginTop: "4rem" }}>
            {methodSections.map((section, i) => (
              <div key={section.title} style={{
                display: "grid",
                gap: "4rem",
                alignItems: "start",
                gridTemplateColumns: "1fr 1fr",
              }} className={`nv-pillar-row${i % 2 !== 0 ? " mp-pillar-flip" : ""}`}>
                <div className={`nv-pillar-img${i === 1 ? " nv-pillar-img--landscape" : ""}`}>
                  <Image
                    src={pillarImages[i]}
                    alt={pillarAlts[i]}
                    fill
                    className="object-contain"
                    sizes="(max-width: 900px) 100vw, 50vw"
                  />
                </div>
                <div>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "3rem", color: "rgba(176,144,200,0.15)", lineHeight: 1, display: "block", marginBottom: "0.5rem" }}>0{i + 1}</span>
                  <h3 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 4vw, 3.5rem)", textTransform: "uppercase", letterSpacing: "0.04em", color: "#fff", margin: "0 0 1rem", lineHeight: "0.96" }}>{section.title}</h3>
                  <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.62)", lineHeight: 1.7, margin: "0 0 1.5rem", maxWidth: "40ch" }}>{section.description}</p>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {section.points.map((point) => (
                      <li key={point} style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.875rem", color: "rgba(255,255,255,0.65)" }}>
                        <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "var(--color-accent)", flexShrink: 0 }} />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Philosophie ──────────────────────────────────────── */}
      <section className="nv-section-band-mid">
        <Container>
          <div style={{ display: "grid", gap: "4rem", alignItems: "start" }} className="mp-philosophy">
            <div>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "2rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.18)", lineHeight: 1.1 }}>Notre<br />philosophie</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {philosophyItems.map((item) => (
                <div key={item.label} style={{ padding: "1.75rem 0", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", margin: "0 0 0.5rem" }}>{item.label}</h3>
                  <p style={{ fontSize: "0.88rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.68, margin: 0 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ── Suivi évaluation ─────────────────────────────────── */}
      <section className="nv-section-band-dark">
        <Container>
          <div style={{ display: "grid", gap: "4rem", alignItems: "center" }} className="mp-eval">
            <div>
              <span className="nv-label">Suivi structuré</span>
              <h2 className="nv-heading">Bilans à la 7e<br className="hidden sm:block" /> et 15e séance</h2>
              <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.58)", lineHeight: 1.7, maxWidth: "44ch" }}>
                Les parents reçoivent un rapport structuré à chaque étape clé. Forces, faiblesses, priorités — tout est documenté et communiqué clairement.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {[
                { tag: "Séance 7", title: "Bilan intermédiaire", desc: "Rapport technique remis aux parents. Ajustements ciblés pour accélérer la seconde moitié de saison." },
                { tag: "Séance 15", title: "Synthèse finale", desc: "Bilan complet des acquis et recommandations concrètes pour le prochain cycle de développement." }
              ].map((card) => (
                <div key={card.title} className="nv-eval-card">
                  <p style={{ fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "0.22em", color: "var(--color-accent-soft)", margin: "0 0 0.5rem" }}>{card.tag}</p>
                  <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#fff", margin: "0 0 0.75rem", lineHeight: 1 }}>{card.title}</h3>
                  <p style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.62)", lineHeight: 1.65, margin: 0 }}>{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ── 15 séances ───────────────────────────────────────── */}
      <section className="nv-section-band-mid">
        <Container>
          <div style={{ display: "grid", gap: "4rem", alignItems: "start" }} className="mp-timeline-header">
            <div>
              <span className="nv-label">Parcours d&apos;entraînement</span>
              <h2 className="nv-heading">15 séances,<br className="hidden sm:block" /> 4 phases</h2>
            </div>
            <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
              Chaque bloc a un objectif précis. La progression est documentée et partagée avec les parents à mi-parcours.
            </p>
          </div>
          <div className="nv-timeline" style={{ marginTop: "3rem" }}>
            {timeline.map((item) => (
              <div key={item.step} className="nv-timeline-item">
                <div className="nv-timeline-period">{item.step}</div>
                <div>
                  <h3 className="nv-timeline-title">{item.title}</h3>
                  <p className="nv-timeline-desc">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Résultats ────────────────────────────────────────── */}
      <section className="nv-section-band-dark">
        <Container>
          <span className="nv-label">Ce que vous verrez</span>
          <h2 className="nv-heading">Résultats mesurables</h2>
          <div style={{ display: "grid", gap: "1rem", marginTop: "3rem" }} className="sm:grid-cols-2">
            {keyResults.map((result) => (
              <div key={result} className="nv-result-card">
                <span className="nv-result-check" aria-hidden>✓</span>
                <span>{result}</span>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="nv-section-band-mid">
        <Container className="max-w-3xl">
          <div className="text-center">
            <span className="nv-label">Prêt à commencer</span>
            <h2 className="nv-heading">Une place pour votre joueuse</h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.95rem", lineHeight: 1.7, marginBottom: "2rem", maxWidth: "42ch", marginLeft: "auto", marginRight: "auto" }}>
              Groupe limité à 10 pour maintenir la qualité d&apos;encadrement. Inscription simple, résultats mesurables.
            </p>
            <Link href="/inscription" className="nv-cta-solid">
              Réserver une place →
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
