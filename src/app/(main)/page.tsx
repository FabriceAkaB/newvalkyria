import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/container";
import { FaqAccordion } from "@/components/faq-accordion";
import { FeaturesCarousel } from "@/components/features-carousel";
import { faqItems, hero } from "@/lib/site-content";

import heroImage from "@/content/image/HERO2027.png";
import heroImageMobile from "@/content/image/HERO2027-mobile.png";
import p1img     from "@/content/image/photos/DSC04002.jpg";
import p2img     from "@/content/image/photos/DSC01885.jpg";
import whyLocationsImg from "@/content/image/photos/WHY-locations-map.png";
import methodImg from "@/content/image/photos/DSC02043.jpg";
import featImg   from "@/content/image/photos/homepage-team-huddle.jpg";
import hlt1      from "@/content/image/photos/HLT-technique.png";
import hlt2      from "@/content/image/photos/HLT-mental.jpg";
import hlt3      from "@/content/image/photos/HLT-physique.png";
import ctaTeamImg from "@/content/image/photos/inscription-cta-547.jpg";

const academyStats = [
  { metric: "150+",       label: "Joueuses formées"    },
  { metric: "3 villes",   label: "Laurentides"         },
  { metric: "C CONCACAF", label: "Certification coach" },
  { metric: "4.9 ★",     label: "Note parentale"       },
];

const whyChooseUs = [
  { id: "01", title: "Présents dans 3 villes",              text: "Saint-Jérôme, Terrebonne, Sainte-Thérèse — proche de chez vous dans les Laurentides.",                        image: whyLocationsImg },
  { id: "02", title: "Horaires flexibles",                  text: "Plus de 2 plages horaires et plus par catégorie d'âge, pour faciliter votre calendrier et vos autres activités.", image: p1img },
  { id: "03", title: "Pensé pour les grandes familles",     text: "Des plages horaires qui s'adaptent, même avec plusieurs enfants inscrits à l'académie.",                        image: p2img },
];

const methodDifferentiators = [
  { title: "Groupes limités",              metric: "1 coach pour 6-8",          text: "Chaque joueuse reçoit de vraies corrections techniques pendant la séance."             },
  { title: "Spécialisation féminine",      metric: "Coach certifié C CONCACAF", text: "Le contenu est conçu pour le foot féminin, pas copié d'un modèle standard."          },
  { title: "Suivi vidéo + routine maison", metric: "Terrain + hors terrain",    text: "Les progrès continuent entre les séances grâce à un plan simple et concret."         },
  { title: "Bilans structurés",            metric: "Mi-saison et fin de saison", text: "Parents et joueuses savent exactement où elles avancent et quoi améliorer ensuite."  },
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

export default function HomePage() {
  return (
    <>
      {/* ═══ 1. HERO — full screen ════════════════════════════════ */}
      <section className="nv-hero">
        <div className="nv-hero-image-wrap">
          <div className="nv-hero-img-desktop">
            <Image
              src={heroImage}
              alt=""
              fill
              priority
              quality={95}
              sizes="100vw"
              className="object-cover object-center"
              aria-hidden
            />
          </div>
          <div className="nv-hero-img-mobile">
            <Image
              src={heroImageMobile}
              alt=""
              fill
              priority
              quality={95}
              sizes="100vw"
              className="object-cover"
              aria-hidden
            />
          </div>
          <div className="nv-hero-overlay" />
        </div>
        <div className="nv-hero-inner w-full">
          <Container>
            <span className="nv-hero-tag">Académie féminine · Laurentides, Québec</span>
            <h1 className="nv-hero-title">
              New<br />Valkyria
            </h1>
            <p className="nv-hero-desc">{hero.title}</p>
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
            alt="Entraîneur et joueuses New Valkyria en concertation"
            fill
            className="object-cover"
            sizes="50vw"
          />
        </div>

        {/* Content half */}
        <div className="barca-features-panel">
          <header className="barca-features-header">
            <span className="barca-features-label">Pourquoi New Valkyria</span>
            <h2 className="barca-features-title">Ce qui distingue notre académie 100 % féminin</h2>
          </header>
          <FeaturesCarousel
            features={[
              {
                id: "groupes-limites",
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                ),
                title: "Groupes limités",
                desc: "Encadrement rapproché — 1 coach pour 6 à 8 joueuses. Corrections techniques vraiment individualisées à chaque séance.",
                metric: "1 coach pour 6-8"
              },
              {
                id: "coach-certifie",
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                ),
                title: "Coach certifié",
                desc: "Certification C CONCACAF. Méthode bâtie spécifiquement pour le foot féminin jeune.",
                metric: "Certification C CONCACAF"
              },
              {
                id: "suivi-progression",
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                  </svg>
                ),
                title: "Suivi & progression",
                desc: "Analyse vidéo et bilans formels à la mi-saison et en fin de saison. La progression se mesure.",
                metric: "Bilans mi-saison + fin de saison"
              },
              {
                id: "resultats-garantis",
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                ),
                title: "Résultats garantis",
                desc: "Pas satisfait de la progression cette saison ? Remboursement à 100 %, sans justification à fournir.",
                metric: "Garantie complète"
              }
            ]}
          />
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
            Que ta joueuse ait 8 ou 14 ans, chaque séance est conçue pour la pousser
            au-delà de sa zone de confort — avec un encadrement de 6 à 8 joueuses par
            coach pour une vraie qualité technique. Notre objectif : construire et
            redonner confiance à chaque joueuse dans notre programme.
          </p>
        </Container>

        {/* Full-bleed 3-image strip */}
        <div className="hlt-images">
          <div className="hlt-image-item">
            <Image src={hlt1} alt="Technique" fill className="object-cover object-center" sizes="34vw" />
            <div className="hlt-image-overlay" />
            <div className="hlt-image-label">
              <span className="hlt-image-label-title">Technique</span>
              <span className="hlt-image-label-sub">Contrôle · Frappe · Passes</span>
            </div>
          </div>
          <div className="hlt-image-item">
            <Image src={hlt3} alt="Physique" fill className="object-cover object-center" sizes="34vw" style={{ objectPosition: "center 30%" }} />
            <div className="hlt-image-overlay" />
            <div className="hlt-image-label">
              <span className="hlt-image-label-title">Physique</span>
              <span className="hlt-image-label-sub">Vitesse · Endurance · Explosivité</span>
            </div>
          </div>
          <div className="hlt-image-item">
            <Image src={hlt2} alt="Mental" fill className="object-cover object-center" sizes="34vw" style={{ objectPosition: "center 20%" }} />
            <div className="hlt-image-overlay" />
            <div className="hlt-image-label">
              <span className="hlt-image-label-title">Mental</span>
              <span className="hlt-image-label-sub">Décision · Pression · Focus</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 4. POURQUOI CHOISIR NEW VALKYRIA ════════════════════ */}
      <section className="nv-problems">
        <Container>
          <div className="nv-problems-head">
            <div className="nv-problems-icon" aria-hidden>
              <svg viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 14l14-5 12 5 14-5v33l-14 5-12-5-14 5V14z" />
                <line x1="22" y1="9" x2="22" y2="42" />
                <line x1="34" y1="14" x2="34" y2="47" />
                <circle cx="22" cy="24" r="3" fill="currentColor" stroke="none" />
                <circle cx="34" cy="30" r="3" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <span className="nv-label">Notre différence</span>
            <h2 className="nv-heading">
              Pourquoi choisir<br /><span className="nv-heading-accent">New Valkyria</span> ?
            </h2>
            <p className="nv-body">
              On veut favoriser le foot féminin en étant présents dans plus d&apos;endroits et en offrant
              plus de journées et de plages horaires — pour faciliter la vie de nos membres.
            </p>
          </div>
        </Container>

        <div className="why-grid">
          {whyChooseUs.map((item) => (
            <article key={item.id} className="why-card">
              <div className="why-card-photo">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  className="object-cover"
                  sizes="(max-width:1023px) 82vw, 25vw"
                />
              </div>
              <div className="why-card-overlay" />
              <div className="why-card-content">
                <h3 className="why-card-title">{item.title}</h3>
                <p className="why-card-text">{item.text}</p>
              </div>
            </article>
          ))}
        </div>
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
                Ici, on ne fait pas juste des séances : on construit une progression et on bâtit une confiance.
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

      {/* ═══ CTA BAR — full-width purple ════════════════════════ */}
      <section className="barca-cta-bar">
        <div className="barca-cta-bar-inner">
          <h2 className="barca-cta-bar-title">Prête à progresser vraiment ?</h2>
          <p className="barca-cta-bar-sub">
            Places limitées — 1 coach pour 6 à 8 joueuses, inscriptions ouvertes pour la session en cours.
            Ne laissez pas votre joueuse attendre.
          </p>
          <Link href="/inscription" className="barca-cta-bar-btn">
            Réserver une place →
          </Link>
        </div>
      </section>

      {/* ═══ Photo d'équipe ══════════════════════════════════════ */}
      <section className="nv-cta-photo">
        <Image src={ctaTeamImg} alt="Équipe New Valkyria" fill className="object-cover object-center" sizes="100vw" />
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

    </>
  );
}
