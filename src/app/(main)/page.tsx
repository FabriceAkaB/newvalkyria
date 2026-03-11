import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/container";
import { MethodRows } from "@/components/method-rows";
import { SectionTitle } from "@/components/section-title";
import { getCapacityData } from "@/lib/capacity";
import { faqItems, hero, seasonalOffer } from "@/lib/site-content";
import joueuseA from "@/content/image/joueuseImage/joueuseA.jpg";
import joueuseB from "@/content/image/joueuseImage/joueuseB.jpg";
import joueuseC from "@/content/image/joueuseImage/joueuseC.jpg";
import joueuseE from "@/content/image/joueuseImage/joueuseE.jpg";
import joueuseG from "@/content/image/joueuseImage/joueuseG.jpg";

const academyStats = [
  { metric: "150+", label: "Joueuses formées" },
  { metric: "3 villes", label: "Laurentides" },
  { metric: "C CONCACAF", label: "Certification coach" },
  { metric: "4.9 ★", label: "Note parentale" }
];

const clubProblems = [
  {
    id: "01",
    title: "Encadrement instable",
    text: "En club, une joueuse peut avoir plusieurs coachs dans le même cycle, sans continuité claire.",
    image: joueuseA
  },
  {
    id: "02",
    title: "Exercices trop génériques",
    text: "Les séances manquent souvent d'intensité et d'adaptation réelle au développement des filles.",
    image: joueuseC
  },
  {
    id: "03",
    title: "Peu de suivi individuel",
    text: "Les parents n'obtiennent pas toujours un plan précis sur les forces et faiblesses à corriger.",
    image: joueuseE
  },
  {
    id: "04",
    title: "Progression floue",
    text: "Beaucoup de familles paient longtemps sans preuve claire de progression technique.",
    image: joueuseG
  }
];

const methodDifferentiators = [
  {
    title: "Groupes limités",
    metric: "10 joueuses max",
    text: "Chaque joueuse reçoit de vraies corrections techniques pendant la séance."
  },
  {
    title: "Spécialisation féminine",
    metric: "Coach certifié C CONCACAF",
    text: "Le contenu est conçu pour le foot féminin, pas copié d'un modèle standard."
  },
  {
    title: "Suivi vidéo + routine maison",
    metric: "Terrain + hors terrain",
    text: "Les progrès continuent entre les séances grâce à un plan simple et concret."
  },
  {
    title: "Bilans structurés",
    metric: "7e et 15e séance",
    text: "Parents et joueuses savent exactement où elles avancent et quoi améliorer ensuite."
  }
];

const methodPrinciples = [
  "Opposition réelle pour développer les décisions sous pression",
  "Discipline claire pour protéger la qualité et l'intensité",
  "Progression mesurée, pas juste ressentie"
];

const parentReviews = [
  {
    id: "review-1",
    parentName: "Natasha Gosselin",
    role: "Mère d'une joueuse (gardienne)",
    quote:
      "J'ai remarqué une belle progression, particulièrement au niveau du jeu de pied. Les entraînements sont toujours structurés, motivants et adaptés. Je le recommande sincèrement à tout parent qui souhaite voir son enfant progresser dans un environnement sérieux, positif et passionné.",
    rating: 5,
    detail: "Progression jeu de pied · Professionnalisme"
  },
  {
    id: "review-2",
    parentName: "Bianca Giroux",
    role: "Mère d'une joueuse",
    quote:
      "Notre fille a acquis beaucoup de technique sur le ballon depuis ses débuts. Le coach JP a su lui donner confiance en ses habiletés — elle est devenue plus menaçante pour ses adversaires. La rétroaction faite de façon assidue est très pertinente pour son avancement.",
    rating: 5,
    detail: "Technique · Confiance · Feedback"
  },
  {
    id: "review-3",
    parentName: "Benoit Cousineau",
    role: "Père d'une joueuse",
    quote:
      "Tout le mérite te revient avec tes entraînements, tes motivations, ton support envers les joueuses et nous les parents. Tu fais plus que de former des joueuses de soccer, tu formes des futures femmes. Lâche pas JP.",
    rating: 5,
    detail: "Support · Développement · Impact humain"
  }
];

export default async function HomePage() {
  const capacity = await getCapacityData();
  const { isFull, taken, remaining, percentage } = capacity.total;
  const totalMax = taken + remaining;

  return (
    <>
      {/* ── Ruban promo — compteur dynamique ── */}
      <section className="promo-ribbon">
        <Container className="flex flex-wrap items-center justify-between gap-3 py-3">
          {isFull ? (
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-300/90">
              ⚠ Session complète — liste d&apos;attente ouverte
            </p>
          ) : (
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/80">
              Académie locale forte · Inscriptions ouvertes 2026
            </p>
          )}
          <Link href="/inscription" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-soft hover:text-white">
            {isFull ? "Liste d\u2019attente" : "Démarrer l\u2019inscription"}
          </Link>
        </Container>
      </section>

      <section className="hero-shell">
        <Container>
          <div className="hero-inner">

            {/* ── Colonne texte (épurée) ── */}
            <div className="hero-text reveal">
              <p className="hero-overline">Académie · Laurentides</p>

              <h1 className="hero-title">
                Former des<br />joueuses plus<br />confiantes.
              </h1>

              <div className="hero-cta-group">
                <Link href="/inscription" className="hero-btn-primary">
                  {isFull ? "Liste d\u2019attente" : hero.cta}
                </Link>
              </div>
            </div>

            {/* ── Colonne image (plus grande) ── */}
            <div className="hero-media-wrap">
              <Image
                src={joueuseB}
                alt="Joueuse New Valkyria en entraînement"
                className="hero-media"
                priority
              />
              <div className="hero-floating-card hero-floating-top">
                <p className="text-[10px] uppercase tracking-[0.15em] text-accent-soft">Progression</p>
                <p className="mt-1 font-display text-2xl uppercase text-white">6 séances</p>
                <p className="text-xs text-white/70">Premiers résultats visibles</p>
              </div>
              <div className="hero-floating-card hero-floating-bottom">
                <p className="text-[10px] uppercase tracking-[0.15em] text-accent-soft">Qualité</p>
                <p className="mt-1 font-display text-2xl uppercase text-white">1:5</p>
                <p className="text-xs text-white/70">Ratio coach renforcé</p>
              </div>
            </div>

          </div>
        </Container>
      </section>

      <section className="section-band band-muted">
        <Container>
          <div className="stats-grid">
            {academyStats.map((stat) => (
              <div key={stat.label} className="stats-item">
                <p className="font-display text-3xl uppercase tracking-[0.05em] text-accent md:text-4xl whitespace-nowrap">{stat.metric}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/60">{stat.label}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="section-band band-dark">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <SectionTitle
                title="Pourquoi les clubs ne suffisent pas ?"
                description="Ce que les parents nous remontent le plus souvent avant d'arriver chez New Valkyria."
              />

              <div className="rounded-soft border border-accent/35 bg-accent/10 p-5">
                <p className="text-xs uppercase tracking-[0.13em] text-accent-soft">Conséquence terrain</p>
                <p className="mt-2 text-sm text-white/80">
                  Les filles motivées stagnent souvent par manque de cadre constant, de feedback individuel et de plan
                  technique clair.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {clubProblems.map((problem) => (
                <article key={problem.id} className="step-card lift-card">
                  <Image src={problem.image} alt={problem.title} width={1200} height={900} className="step-image" />
                  <div className="step-body">
                    <p className="step-id">{problem.id}</p>
                    <h3 className="font-display text-3xl uppercase tracking-[0.06em] text-white">{problem.title}</h3>
                    <p className="mt-2 text-sm text-white/78">{problem.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section className="section-band band-soft">
        <Container>
          {/* En-tête centré */}
          <div className="method-header">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Méthode New Valkyria</p>
            <h2 className="mt-3 font-display text-4xl uppercase leading-[1.05] tracking-[0.06em] text-white md:text-5xl">
              Un service différent,<br className="hidden sm:block" /> clair et mesurable
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/70">
              Ici, on ne fait pas juste des séances : on construit une progression visible et suivie.
            </p>
          </div>

          {/* Rangées numérotées avec animation au scroll */}
          <MethodRows items={methodDifferentiators} />

          {/* Principes + CTA en pied */}
          <div className="method-footer">
            <ul className="method-principles">
              {methodPrinciples.map((point) => (
                <li key={point}>
                  <span className="method-dot" aria-hidden />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/methode"
              className="flex-shrink-0 rounded-full bg-accent px-7 py-3 text-xs font-semibold uppercase tracking-[0.13em] text-ink transition hover:bg-accent-soft"
            >
              En savoir plus →
            </Link>
          </div>
        </Container>
      </section>

      <section className="section-band band-muted">
        <Container className="max-w-4xl">
          <div className="guarantee-panel">
            <div className="guarantee-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>

            <div className="guarantee-body">
              <p className="text-xs uppercase tracking-[0.18em] text-accent-soft">Garantie New Valkyria</p>
              <h2 className="mt-2 font-display text-3xl uppercase leading-[1.06] tracking-[0.06em] text-white md:text-4xl">
                Progression mesurable<br className="hidden sm:block" /> ou remboursée
              </h2>
              <p className="mt-3 text-sm text-white/78 md:text-base">
                Si à la séance 7 ta joueuse n&apos;a pas progressé techniquement de façon visible et documentée, on rembourse intégralement — sans condition, sans délai.
              </p>

              <div className="guarantee-points">
                {[
                  "Bilan structuré à la séance 7",
                  "Critères objectifs et documentés",
                  "Remboursement intégral si non atteint"
                ].map((point) => (
                  <div key={point} className="guarantee-point">
                    <span className="guarantee-check" aria-hidden>✓</span>
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="section-band band-dark">
        <Container className="max-w-2xl">
          <div className="pricing-card">
            <div className="pricing-top">
              <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Forfait saison</p>
              <h2 className="mt-3 font-display text-4xl uppercase tracking-[0.06em] text-white md:text-5xl">
                {seasonalOffer.title}
              </h2>
              <div className="pricing-price">
                <span className="font-display text-6xl uppercase tracking-[0.04em] text-accent">
                  {seasonalOffer.priceLabel}
                </span>
                <span className="ml-3 text-sm text-white/55">/ saison complète</span>
              </div>
            </div>

            <div className="pricing-specs">
              <div className="pricing-spec">
                <span className="pricing-spec-label">Durée</span>
                <span className="pricing-spec-val">{seasonalOffer.duration}</span>
              </div>
              <div className="pricing-spec">
                <span className="pricing-spec-label">Capacité</span>
                <span className="pricing-spec-val">{seasonalOffer.capacity}</span>
              </div>
            </div>

            <hr className="pricing-hr" />

            <ul className="pricing-includes">
              {seasonalOffer.includes.map((line) => (
                <li key={line} className="pricing-include">
                  <span className="pricing-check" aria-hidden>✓</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            {/* ── Barre de capacité ── */}
            <div className="cap-bar-wrap">
              <div className="cap-bar-header">
                <span className="cap-bar-label">
                  {isFull ? "Session complète" : `${taken} inscription${taken > 1 ? "s" : ""} confirmée${taken > 1 ? "s" : ""}`}
                </span>
                <span className="cap-bar-count">{taken}/{totalMax}</span>
              </div>
              <div className="cap-bar-track">
                <div className="cap-bar-fill" style={{ width: `${percentage}%` }} />
              </div>
            </div>

            <div className="pricing-footer">
              <Link href="/inscription" className={isFull ? "pricing-btn pricing-btn-full" : "pricing-btn"}>
                {isFull ? "Rejoindre la liste d\u2019attente" : "Réserver une place"}
              </Link>
              <p className="pricing-policy">{seasonalOffer.policy}</p>
              <p className="pricing-guarantee-note">
                Progression visible garantie à la 7e séance — ou remboursement intégral.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section className="section-band band-soft">
        <Container>
          <div className="mb-10">
            <p className="text-xs uppercase tracking-[0.17em] text-accent-soft">Retours parents</p>
            <h3 className="mt-2 font-display text-3xl uppercase tracking-[0.06em] text-white md:text-5xl">
              Ce que disent les familles
            </h3>
          </div>

          <div className="reviews-grid">
            {parentReviews.map((review) => (
              <article key={review.id} className="review-card">
                <div className="review-card-quote-mark" aria-hidden>&ldquo;</div>
                <p className="review-card-quote">{review.quote}</p>
                <div className="review-card-footer">
                  <div className="review-card-meta">
                    <span className="review-card-initial" aria-hidden>
                      {review.parentName.charAt(0)}
                    </span>
                    <div>
                      <p className="review-card-name">{review.parentName}</p>
                      <p className="review-card-role">{review.role}</p>
                    </div>
                  </div>
                  <div className="review-card-stars" aria-label={`${review.rating} étoiles`}>
                    {Array.from({ length: review.rating }).map((_, i) => (
                      <span key={i} aria-hidden>★</span>
                    ))}
                  </div>
                </div>
                <p className="review-card-tag">{review.detail}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className="section-band band-dark">
        <Container className="max-w-4xl">
          <div className="mb-10">
            <p className="text-xs uppercase tracking-[0.17em] text-accent-soft">FAQ</p>
            <h3 className="mt-2 font-display text-3xl uppercase tracking-[0.06em] text-white md:text-4xl">
              Questions fréquentes
            </h3>
          </div>

          <div className="faq-list">
            {faqItems.map((faq) => (
              <details key={faq.id} className="faq-row">
                <summary className="faq-row-summary">
                  <span className="faq-row-question">{faq.question}</span>
                  <span className="faq-row-chevron" aria-hidden>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </summary>
                <p className="faq-row-answer">{faq.answer}</p>
              </details>
            ))}
          </div>

          <div className="final-cta">
            <div className="final-cta-badge">
              <span className="final-cta-dot" aria-hidden />
              Inscriptions ouvertes · Session en cours
            </div>
            <p className="final-cta-heading">
              Il reste de la place pour<br className="hidden sm:block" /> votre joueuse
            </p>
            <p className="final-cta-sub">
              Groupe limité à 10 · Suivi individuel · Résultats mesurables dès la 6e séance
            </p>
            <Link href="/inscription" className="final-cta-btn">
              <span>Réserver une place</span>
              <span aria-hidden>→</span>
            </Link>
            <p className="final-cta-footnote">Processus rapide · Paiement sécurisé</p>
          </div>
        </Container>
      </section>
    </>
  );
}
