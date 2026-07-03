import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/container";
import { FaqAccordion } from "@/components/faq-accordion";
import { getCapacityData } from "@/lib/capacity";
import { faqItems, hero, seasonalOffer } from "@/lib/site-content";

import heroImage from "@/content/image/REALHERO.png";
import p1img     from "@/content/image/photos/DSC01851.jpg";
import p2img     from "@/content/image/photos/DSC01885.jpg";
import p3img     from "@/content/image/photos/DSC01900.jpg";
import p4img     from "@/content/image/photos/DSC01969.jpg";
import methodImg from "@/content/image/photos/DSC02043.jpg";
import ctaImg    from "@/content/image/photos/DSC02052.jpg";
import featImg   from "@/content/image/photos/DSC02476.jpg";
import hlt1      from "@/content/image/photos/DSC02155.jpg";
import hlt2      from "@/content/image/photos/DSC02229.jpg";
import hlt3      from "@/content/image/photos/DSC02505.jpg";

const academyStats = [
  { metric: "150+",       label: "Joueuses formées"    },
  { metric: "3 villes",   label: "Laurentides"         },
  { metric: "C CONCACAF", label: "Certification coach" },
  { metric: "4.9 ★",     label: "Note parentale"       },
];

const clubProblems = [
  { id: "01", title: "Encadrement instable",      text: "En club, une joueuse peut avoir plusieurs coachs dans le même cycle, sans continuité claire.",      image: p1img },
  { id: "02", title: "Exercices trop génériques", text: "Les séances manquent souvent d'intensité et d'adaptation réelle au développement des filles.",      image: p2img },
  { id: "03", title: "Peu de suivi individuel",   text: "Les parents n'obtiennent pas toujours un plan précis sur les forces et faiblesses à corriger.",     image: p3img },
  { id: "04", title: "Progression floue",         text: "Beaucoup de familles paient longtemps sans preuve claire de progression technique.",                image: p4img },
];

const methodDifferentiators = [
  { title: "Groupes limités",              metric: "10 joueuses max",           text: "Chaque joueuse reçoit de vraies corrections techniques pendant la séance."             },
  { title: "Spécialisation féminine",      metric: "Coach certifié C CONCACAF", text: "Le contenu est conçu pour le foot féminin, pas copié d'un modèle standard."          },
  { title: "Suivi vidéo + routine maison", metric: "Terrain + hors terrain",    text: "Les progrès continuent entre les séances grâce à un plan simple et concret."         },
  { title: "Bilans structurés",            metric: "7e et 15e séance",          text: "Parents et joueuses savent exactement où elles avancent et quoi améliorer ensuite."  },
];

const methodPrinciples = [
  "Opposition réelle pour développer les décisions sous pression",
  "Discipline claire pour protéger la qualité et l'intensité",
  "Progression mesurée, pas juste ressentie",
];

const parentReviews = [
  {
    id: "r1",
    name: "Natasha Gosselin",
    role: "Mère d'une joueuse (gardienne)",
    quote: "J'ai remarqué une belle progression, particulièrement au niveau du jeu de pied. Les entraînements sont toujours structurés, motivants et adaptés. Je le recommande sincèrement à tout parent qui souhaite voir son enfant progresser dans un environnement sérieux, positif et passionné.",
    rating: 5,
    detail: "Progression jeu de pied · Professionnalisme",
  },
  {
    id: "r2",
    name: "Bianca Giroux",
    role: "Mère d'une joueuse",
    quote: "Notre fille a acquis beaucoup de technique sur le ballon depuis ses débuts. L'équipe a su lui donner confiance en ses habiletés — elle est devenue plus menaçante pour ses adversaires. La rétroaction faite de façon assidue est très pertinente pour son avancement.",
    rating: 5,
    detail: "Technique · Confiance · Feedback",
  },
  {
    id: "r3",
    name: "Benoit Cousineau",
    role: "Père d'une joueuse",
    quote: "Tout le mérite vous revient avec vos entraînements, vos motivations, votre support envers les joueuses et nous les parents. Vous faites plus que former des joueuses de soccer, vous formez des futures femmes. Continuez comme ça.",
    rating: 5,
    detail: "Support · Développement · Impact humain",
  },
];

export default async function HomePage() {
  const capacity = await getCapacityData();
  const { isFull, taken, remaining, percentage } = capacity.total;
  const totalMax = taken + remaining;

  return (
    <>
      {/* ═══ 1. HERO — full screen ════════════════════════════════ */}
      <section className="nv-hero">
        <Image
          src={heroImage}
          alt=""
          fill
          priority
          className="object-cover object-center"
          aria-hidden
        />
        <div className="nv-hero-overlay" />
        <div className="nv-hero-inner w-full">
          <Container>
            <span className="nv-hero-tag">Académie féminine · Laurentides, Québec</span>
            <h1 className="nv-hero-title">
              New<br />Valkyria
            </h1>
            <p className="nv-hero-desc">{hero.title}</p>
            <div className="nv-hero-actions">
              <Link href="/inscription" className="nv-cta-solid">
                {isFull ? "Liste d'attente" : "Réserver une place"}
              </Link>
              <Link href="/methode" className="nv-cta-outline">
                Découvrir la méthode →
              </Link>
            </div>
          </Container>
        </div>
      </section>

      {/* ═══ 2. STATS — full-width band ══════════════════════════ */}
      <section className="nv-stats" aria-label="Chiffres clés">
        <div className="nv-stats-grid">
          {academyStats.map((stat) => (
            <div key={stat.label} className="nv-stat">
              <span className="nv-stat-num">{stat.metric}</span>
              <span className="nv-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FEATURES — photo left / 2×2 cards right ════════════ */}
      <section className="barca-features">

        {/* Photo half */}
        <div className="barca-features-photo">
          <Image
            src={featImg}
            alt="Joueuse New Valkyria à l'entraînement"
            fill
            className="object-cover"
            sizes="50vw"
          />
        </div>

        {/* Content half */}
        <div className="barca-features-panel">
          <header className="barca-features-header">
            <span className="barca-features-label">Pourquoi New Valkyria</span>
            <h2 className="barca-features-title">Ce qui nous distingue</h2>
          </header>
          <div className="barca-features-grid">

            <div className="barca-feature-card">
              <div className="barca-feature-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <h3 className="barca-feature-title">Groupes limités</h3>
              <p className="barca-feature-desc">Maximum 10 joueuses par groupe. Corrections techniques vraiment individualisées à chaque séance.</p>
              <span className="barca-feature-metric">10 joueuses max</span>
            </div>

            <div className="barca-feature-card">
              <div className="barca-feature-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <h3 className="barca-feature-title">Coach certifié</h3>
              <p className="barca-feature-desc">Certification C CONCACAF. Méthode bâtie spécifiquement pour le foot féminin jeune.</p>
              <span className="barca-feature-metric">Certification C CONCACAF</span>
            </div>

            <div className="barca-feature-card">
              <div className="barca-feature-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                </svg>
              </div>
              <h3 className="barca-feature-title">Suivi & progression</h3>
              <p className="barca-feature-desc">Analyse vidéo et bilans formels à la 7e et 15e séance. La progression se mesure.</p>
              <span className="barca-feature-metric">Bilans S7 + S15</span>
            </div>

            <div className="barca-feature-card">
              <div className="barca-feature-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <h3 className="barca-feature-title">Résultats garantis</h3>
              <p className="barca-feature-desc">Progression visible à la 7e séance — ou remboursement intégral. Sans condition.</p>
              <span className="barca-feature-metric">Garantie complète</span>
            </div>

          </div>
        </div>

      </section>


      {/* ═══ ENTRAÎNEMENT DE HAUT NIVEAU (Barça-style) ══════════ */}
      <section className="hlt-section">
        <Container>
          {/* Pitch icon */}
          <div className="hlt-icon" aria-hidden>
            <svg viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              {/* Pitch outline */}
              <rect x="4" y="10" width="48" height="36" rx="1" />
              {/* Centre line */}
              <line x1="28" y1="10" x2="28" y2="46" />
              {/* Centre circle */}
              <circle cx="28" cy="28" r="7" />
              {/* Centre dot */}
              <circle cx="28" cy="28" r="1" fill="currentColor" stroke="none" />
              {/* Left penalty box */}
              <rect x="4" y="19" width="10" height="18" />
              {/* Right penalty box */}
              <rect x="42" y="19" width="10" height="18" />
              {/* Left goal */}
              <rect x="4" y="23" width="4" height="10" />
              {/* Right goal */}
              <rect x="48" y="23" width="4" height="10" />
            </svg>
          </div>

          <span className="hlt-eyebrow">New Valkyria · Laurentides</span>
          <h2 className="hlt-title">
            Entraînement<br />de haut niveau
          </h2>
          <p className="hlt-desc">
            Que ta joueuse ait 9 ou 16 ans, chaque séance est conçue pour la pousser
            au-delà de sa zone de confort — avec un encadrement rigoureux, un feedback
            immédiat et une progression documentée que les clubs ne peuvent pas offrir.
          </p>
        </Container>

        {/* Full-bleed 3-image strip */}
        <div className="hlt-images">
          <div className="hlt-image-item">
            <Image src={hlt1} alt="Technique" fill className="object-cover object-top" sizes="34vw" />
            <div className="hlt-image-overlay" />
            <div className="hlt-image-label">
              <span className="hlt-image-label-title">Technique</span>
              <span className="hlt-image-label-sub">Contrôle · Frappe · Passes</span>
            </div>
          </div>
          <div className="hlt-image-item">
            <Image src={hlt2} alt="Mental" fill className="object-cover object-center" sizes="34vw" />
            <div className="hlt-image-overlay" />
            <div className="hlt-image-label">
              <span className="hlt-image-label-title">Mental</span>
              <span className="hlt-image-label-sub">Décision · Pression · Focus</span>
            </div>
          </div>
          <div className="hlt-image-item">
            <Image src={hlt3} alt="Physique" fill className="object-cover object-center" sizes="34vw" />
            <div className="hlt-image-overlay" />
            <div className="hlt-image-label">
              <span className="hlt-image-label-title">Physique</span>
              <span className="hlt-image-label-sub">Vitesse · Endurance · Explosivité</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 4. POURQUOI LES CLUBS NE SUFFISENT PAS ═════════════ */}
      <section className="nv-problems">
        <Container>
          <div className="nv-problems-head">
            <span className="nv-label">Le constat</span>
            <h2 className="nv-heading">
              Pourquoi les clubs<br />ne suffisent pas ?
            </h2>
            <p className="nv-body">
              Ce que les parents nous demandent le plus souvent avant d&apos;arriver chez New Valkyria.
            </p>
          </div>

          <div className="nv-problems-grid">
            {clubProblems.map((problem) => (
              <article key={problem.id} className="nv-problem-card">
                <div className="nv-problem-photo">
                  <Image
                    src={problem.image}
                    alt={problem.title}
                    fill
                    className="object-cover object-top"
                    sizes="(max-width:600px) 100vw, 50vw"
                  />
                </div>
                <div className="nv-problem-overlay" />
                <div className="nv-problem-content">
                  <span className="nv-problem-num">{problem.id}</span>
                  <h3 className="nv-problem-title">{problem.title}</h3>
                  <p className="nv-problem-text">{problem.text}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="nv-consequence">
            <div className="nv-consequence-bar" />
            <div>
              <span className="nv-consequence-label">Cela fait que...</span>
              <p className="nv-consequence-text">
                Les filles motivées stagnent souvent par manque de cadre constant, de feedback individuel et de plan technique clair.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* ═══ 5. MÉTHODE — photo split ════════════════════════════ */}
      <section className="nv-method">
          <div className="nv-method-split">
            {/* Photo */}
            <div className="nv-method-photo">
              <Image
                src={methodImg}
                alt=""
                fill
                className="object-cover object-center"
                sizes="(max-width:1024px) 100vw, 50vw"
              />
            </div>

            {/* Content */}
            <div className="nv-method-body">
              <span className="nv-label">Méthode New Valkyria</span>
              <h2 className="nv-heading">
                Un service différent,<br />clair et mesurable
              </h2>
              <p className="nv-body" style={{ marginBottom: 0 }}>
                Ici, on ne fait pas juste des séances : on construit une progression visible et suivie.
              </p>

              <div className="nv-method-rows">
                {methodDifferentiators.map((m) => (
                  <div key={m.title} className="nv-method-row">
                    <span className="nv-method-dot" />
                    <div>
                      <p className="nv-method-row-title">{m.title}</p>
                      <p className="nv-method-row-sub">{m.metric}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="nv-method-principles">
                {methodPrinciples.map((p) => (
                  <span key={p} className="nv-method-principle">{p}</span>
                ))}
              </div>

              <Link href="/methode" className="nv-cta-solid" style={{ alignSelf: "flex-start" }}>
                En savoir plus →
              </Link>
            </div>
          </div>
      </section>

      {/* ═══ 6. GARANTIE ════════════════════════════════════════ */}
      <section className="nv-guarantee">
        <Container className="max-w-4xl">
          <div className="nv-guarantee-inner">
            <div className="nv-guarantee-shield" aria-hidden>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <span className="nv-label">Garantie New Valkyria</span>
              <h2 className="nv-heading" style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)" }}>
                Progression visible<br />ou remboursée
              </h2>
              <p className="nv-body">
                Si à la séance 7 ta joueuse n&apos;a pas progressé techniquement de façon visible et documentée, on rembourse intégralement — sans condition, sans délai.
              </p>
              <div className="nv-guarantee-checks">
                {["Bilan structuré à la séance 7", "Critères objectifs et documentés", "Remboursement intégral si non atteint"].map((point) => (
                  <div key={point} className="nv-guarantee-check-item">
                    <span className="nv-guarantee-check-badge" aria-hidden>✓</span>
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ═══ CTA BAR — full-width purple ════════════════════════ */}
      <section className="barca-cta-bar">
        <div className="barca-cta-bar-inner">
          <h2 className="barca-cta-bar-title">Prête à progresser vraiment ?</h2>
          <p className="barca-cta-bar-sub">
            Places limitées — 10 joueuses par groupe, inscriptions ouvertes pour la session en cours.
            Ne laissez pas votre joueuse attendre.
          </p>
          <Link href="/inscription" className="barca-cta-bar-btn">
            Réserver une place →
          </Link>
        </div>
      </section>

      {/* ═══ 7. TARIFICATION ════════════════════════════════════ */}
      <section className="nv-pricing">
        <Container>
          <div className="text-center">
            <span className="nv-label">Tarification</span>
            <h2 className="nv-heading">
              Investissez dans la progression<br />de votre enfant
            </h2>
          </div>

          <div className="nv-pricing-card">
            {/* Top — gradient header */}
            <div className="nv-pricing-top">
              <span className="nv-label">Session en cours</span>
              <h3 className="nv-pricing-title">{seasonalOffer.title}</h3>
              <div className="nv-pricing-amount">
                <span className="nv-pricing-num">{seasonalOffer.priceLabel}</span>
                <span className="nv-pricing-period">/ saison complète</span>
              </div>
            </div>

            {/* Body */}
            <div className="nv-pricing-body">
              <div className="nv-pricing-specs">
                <div>
                  <span className="nv-spec-label">Durée</span>
                  <span className="nv-spec-val">{seasonalOffer.duration}</span>
                </div>
                <div>
                  <span className="nv-spec-label">Capacité</span>
                  <span className="nv-spec-val">{seasonalOffer.capacity}</span>
                </div>
              </div>

              <hr className="nv-pricing-divider" />

              <ul className="nv-pricing-includes">
                {seasonalOffer.includes.map((line) => (
                  <li key={line} className="nv-pricing-include">
                    <span className="nv-pricing-check" aria-hidden>✓</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              {/* Capacity bar */}
              <div className="nv-cap-wrap">
                <div className="nv-cap-header">
                  <span>
                    {isFull
                      ? "Session complète"
                      : `${taken} inscription${taken > 1 ? "s" : ""} confirmée${taken > 1 ? "s" : ""}`}
                  </span>
                  <span>{taken}/{totalMax}</span>
                </div>
                <div className="nv-cap-track">
                  <div className="nv-cap-fill" style={{ width: `${percentage}%` }} />
                </div>
              </div>

              <Link
                href="/inscription"
                className={isFull ? "nv-pricing-btn nv-pricing-btn-full" : "nv-pricing-btn"}
              >
                {isFull ? "Rejoindre la liste d'attente" : "Réserver une place"}
              </Link>
              <p className="nv-pricing-policy">{seasonalOffer.policy}</p>
              <p className="nv-pricing-guarantee">
                Progression visible garantie à la 7e séance — ou remboursement intégral.
              </p>
            </div>
          </div>
        </Container>
      </section>

      {/* ═══ 8. AVIS PARENTS ════════════════════════════════════ */}
      <section className="nv-reviews">
        <Container>
          <h2 className="nv-heading">Ce que disent les familles</h2>
          <div className="nv-reviews-grid">
            {parentReviews.map((review) => (
              <article key={review.id} className="nv-review-card">
                <span className="nv-review-qmark" aria-hidden>&ldquo;</span>
                <p className="nv-review-text">{review.quote}</p>
                <div className="nv-review-footer">
                  <div className="nv-review-meta">
                    <span className="nv-review-avatar" aria-hidden>
                      {review.name.charAt(0)}
                    </span>
                    <div>
                      <p className="nv-review-name">{review.name}</p>
                      <p className="nv-review-role">{review.role}</p>
                    </div>
                  </div>
                  <div className="nv-review-stars" aria-label={`${review.rating} étoiles`}>
                    {Array.from({ length: review.rating }).map((_, i) => (
                      <span key={i} aria-hidden>★</span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Container>
      </section>

      {/* ═══ 9. FAQ ════════════════════════════════════════════ */}
      <section className="nv-faq">
        <Container className="max-w-4xl">
          <span className="nv-label">FAQ</span>
          <h2 className="nv-heading">Questions fréquentes</h2>
          <FaqAccordion items={faqItems} />
        </Container>
      </section>

      {/* ═══ 10. FINAL CTA — full bleed ════════════════════════ */}
      <section className="nv-final-cta">
        <Image
          src={ctaImg}
          alt=""
          fill
          className="object-cover object-center"
          aria-hidden
        />
        <div className="nv-final-overlay" />
        <Container>
          <div className="nv-final-inner">
            <span className="nv-label">Rejoindre l&apos;académie</span>
            <h2 className="nv-heading">
              Réservez la place<br />de votre joueuse
            </h2>
            <p className="nv-body" style={{ marginBottom: "2.5rem" }}>
              Places limitées à 10 joueuses. Session en cours — inscriptions ouvertes.
            </p>
            <Link href="/inscription" className="nv-cta-solid">
              {isFull ? "Liste d'attente" : "Réserver une place"}
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
