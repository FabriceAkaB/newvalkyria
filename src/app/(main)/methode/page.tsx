import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/container";
import { keyResults, methodSections, timeline } from "@/lib/site-content";
import joueuseD from "@/content/image/joueuseImage/joueuseD.jpg";
import joueuseF from "@/content/image/joueuseImage/joueuseF.jpg";
import joueuseG from "@/content/image/joueuseImage/joueuseG.jpg";

const pillarImages = [joueuseD, joueuseF, joueuseG];
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
  { val: "1 : 5", label: "Ratio renforcé" },
  { val: "S7 + S15", label: "Bilans formels" }
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
      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="mp-hero">
        <Container>
          <div className="mp-hero-inner">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Méthode New Valkyria</p>
            <h1 className="mp-hero-title">
              Entraîner<br className="hidden sm:block" /> différemment.<br className="hidden sm:block" /> Progresser vraiment.
            </h1>
            <p className="mp-hero-desc">
              Chaque séance est construite avec une logique précise : intensité haute, feedback immédiat, progression documentée. Pas d&apos;improvisation. Pas de remplissage.
            </p>
            <div className="mp-hero-pills">
              {heroStats.map((s) => (
                <div key={s.val} className="mp-hero-pill">
                  <span className="font-display text-2xl uppercase tracking-[0.04em] text-accent">{s.val}</span>
                  <span className="text-[10px] uppercase tracking-[0.16em] text-white/45">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ── 3 Piliers (alternating) ──────────────────────────── */}
      <section className="section-band band-dark">
        <Container>
          <div className="mb-16">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Les 3 piliers</p>
            <h2 className="mt-3 font-display text-4xl uppercase tracking-[0.06em] text-white md:text-5xl">
              Ce sur quoi on travaille
            </h2>
          </div>

          <div className="mp-pillars">
            {methodSections.map((section, i) => (
              <div key={section.title} className={`mp-pillar ${i % 2 !== 0 ? "mp-pillar-flip" : ""}`}>
                <div className="mp-pillar-media">
                  <div className="mp-real-img">
                    <Image
                      src={pillarImages[i]}
                      alt={pillarAlts[i]}
                      fill
                      className="object-cover"
                      sizes="(max-width: 900px) 100vw, 50vw"
                    />
                  </div>
                </div>
                <div className="mp-pillar-body">
                  <span className="mp-pillar-num" aria-hidden>0{i + 1}</span>
                  <h3 className="mp-pillar-title">{section.title}</h3>
                  <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/68">{section.description}</p>
                  <ul className="mp-pillar-points">
                    {section.points.map((point) => (
                      <li key={point}>
                        <span className="mp-pillar-dot" aria-hidden />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Philosophie ─────────────────────────────────────── */}
      <section className="section-band band-muted">
        <Container>
          <div className="mp-philosophy">
            <div className="mp-philosophy-label">
              <p className="font-display text-2xl uppercase tracking-[0.08em] text-white/25">Notre<br />philosophie</p>
            </div>
            <div className="mp-philosophy-items">
              {philosophyItems.map((item) => (
                <div key={item.label} className="mp-philosophy-item">
                  <h3 className="font-display text-xl uppercase tracking-[0.06em] text-white">{item.label}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/62">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ── Suivi évaluation ────────────────────────────────── */}
      <section className="section-band band-dark">
        <Container>
          <div className="mp-eval">
            <div className="mp-eval-text">
              <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Suivi structuré</p>
              <h2 className="mt-3 font-display text-4xl uppercase tracking-[0.06em] text-white md:text-5xl">
                Bilans à la 7e<br className="hidden sm:block" /> et 15e séance
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-white/65">
                Les parents reçoivent un rapport structuré à chaque étape clé. Forces, faiblesses, priorités — tout est documenté et communiqué clairement.
              </p>
            </div>

            <div className="mp-eval-cards">
              <div className="mp-eval-card">
                <p className="text-[10px] uppercase tracking-[0.2em] text-accent-soft">Séance 7</p>
                <h3 className="mt-2 font-display text-2xl uppercase tracking-[0.06em] text-white">Bilan intermédiaire</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/65">
                  Rapport technique remis aux parents. Ajustements ciblés pour accélérer la seconde moitié de saison.
                </p>
              </div>
              <div className="mp-eval-card">
                <p className="text-[10px] uppercase tracking-[0.2em] text-accent-soft">Séance 15</p>
                <h3 className="mt-2 font-display text-2xl uppercase tracking-[0.06em] text-white">Synthèse finale</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/65">
                  Bilan complet des acquis et recommandations concrètes pour le prochain cycle de développement.
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ── Parcours 15 séances ──────────────────────────────── */}
      <section className="section-band band-soft">
        <Container>
          <div className="mp-timeline-header">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Parcours d&apos;entraînement</p>
              <h2 className="mt-3 font-display text-4xl uppercase tracking-[0.06em] text-white md:text-5xl">
                15 séances,<br className="hidden sm:block" /> 4 phases
              </h2>
            </div>
            <p className="mp-timeline-intro">
              Chaque bloc a un objectif précis. La progression est documentée et partagée avec les parents à mi-parcours.
            </p>
          </div>

          <div className="mp-timeline">
            {timeline.map((item, i) => (
              <div key={item.step} className="mp-timeline-item">
                <div className="mp-timeline-step-col">
                  <span className="mp-timeline-step">{item.step}</span>
                  {i < timeline.length - 1 && <span className="mp-timeline-connector" aria-hidden />}
                </div>
                <div className="mp-timeline-content">
                  <p className="font-display text-2xl uppercase tracking-[0.06em] text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-white/68">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Résultats mesurables ─────────────────────────────── */}
      <section className="section-band band-dark">
        <Container>
          <div className="mp-results-header">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Ce que vous verrez</p>
              <h2 className="mt-3 font-display text-3xl uppercase tracking-[0.06em] text-white md:text-4xl">
                Résultats mesurables
              </h2>
            </div>
            <p className="mp-results-intro">
              Des données concrètes, pas des promesses vagues. Ce que notre cadre produit séance après séance.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {keyResults.map((result) => (
              <div key={result} className="methode-result-card">
                <span className="methode-result-check" aria-hidden>✓</span>
                <span>{result}</span>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── CTA final ───────────────────────────────────────── */}
      <section className="section-band band-muted">
        <Container className="max-w-3xl">
          <div className="mp-cta">
            <div className="mp-cta-body">
              <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Prêt à commencer</p>
              <h2 className="mt-3 font-display text-3xl uppercase tracking-[0.06em] text-white md:text-4xl">
                Une place pour votre joueuse
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/65">
                Groupe limité à 10 pour maintenir la qualité d&apos;encadrement. Inscription simple, résultats mesurables.
              </p>
              <Link
                href="/inscription"
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-accent px-8 py-3.5 text-xs font-bold uppercase tracking-[0.14em] text-ink transition hover:bg-accent-soft"
              >
                Réserver une place <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
