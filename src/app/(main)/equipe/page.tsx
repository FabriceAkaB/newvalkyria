import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/container";
import { coachProfile } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "L'équipe | New Valkyria",
  description: "Coach fondateur, certifications et engagement pour le football féminin."
};

const careerMilestones = [
  {
    period: "Début de carrière",
    title: "Premiers pas dans le coaching",
    desc: "Travail avec des groupes féminins jeunes dans les Laurentides. Développement d'une approche centrée sur la technique individuelle et le feedback immédiat."
  },
  {
    period: "Formation",
    title: "Certification C CONCACAF",
    desc: "Formation approfondie en développement du joueur, spécialisation dans les profils féminins jeunes et les méthodes d'apprentissage par opposition réelle."
  },
  {
    period: "Spécialisation",
    title: "Focus exclusif foot féminin",
    desc: "Concentration sur les joueuses de 9 à 14 ans. Mise en place des premiers protocoles de suivi vidéo, d'évaluation structurée et de routines hors terrain."
  },
  {
    period: "Aujourd'hui",
    title: "Fondation de New Valkyria",
    desc: "Lancement de l'académie avec une méthodologie formalisée, groupes limités à 10 joueuses, bilans formels et suivi individuel inédit dans la région."
  }
];

const coachApproach = [
  "Corrections techniques immédiates, pas de rétroaction différée",
  "Suivi vidéo pour que les joueuses se voient progresser",
  "Communication claire et régulière avec les familles",
  "Cadre exigeant mais motivant — la discipline comme outil de confiance"
];

export default function EquipePage() {
  return (
    <>
      {/* ── Hero équipe ─────────────────────────────────────── */}
      <section className="ep-hero">
        <Container>
          <div className="ep-team-intro">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">L&apos;équipe</p>
            <h1 className="mt-3 font-display text-4xl uppercase tracking-[0.05em] text-white md:text-5xl">
              Derrière l&apos;académie
            </h1>
          </div>

          {/* ── Michel Aka — Owner & CEO ── */}
          <div className="ep-member-block ep-member-first">
            <span className="ep-role-badge">Owner &amp; CEO</span>
            <h2 className="ep-member-name">Michel Aka</h2>
            <p className="ep-member-bio">
              Fondateur et directeur de New Valkyria, Michel Aka a bâti l&apos;académie avec une conviction claire :
              les joueuses des Laurentides méritent un encadrement technique structuré, exigeant et centré sur
              leur progression réelle. Il pilote la vision stratégique, les partenariats et l&apos;organisation
              globale de l&apos;académie.
            </p>
          </div>

          <hr className="ep-team-sep" aria-hidden />

          {/* ── Jean-Paul Aka — Coach ── */}
          <div className="ep-member-block">
            <span className="ep-role-badge">Coach fondateur</span>
            <h2 className="ep-member-name">{coachProfile.fullName}</h2>
            <p className="ep-hero-mission">{coachProfile.mission}</p>

            <div className="ep-certif-row">
              {coachProfile.certifications.map((cert) => (
                <span key={cert} className="ep-certif-badge">{cert}</span>
              ))}
              <span className="ep-certif-badge">{coachProfile.experienceYears} ans d&apos;expérience</span>
            </div>

            <div className="ep-hero-stats">
              <div className="ep-stat">
                <span className="font-display text-3xl uppercase tracking-[0.04em] text-accent">9–14</span>
                <span className="ep-stat-label">Âge des joueuses</span>
              </div>
              <div className="ep-stat-sep" aria-hidden />
              <div className="ep-stat">
                <span className="font-display text-3xl uppercase tracking-[0.04em] text-accent">10</span>
                <span className="ep-stat-label">Joueuses max/groupe</span>
              </div>
              <div className="ep-stat-sep" aria-hidden />
              <div className="ep-stat">
                <span className="font-display text-3xl uppercase tracking-[0.04em] text-accent">1:5</span>
                <span className="ep-stat-label">Ratio renforcé</span>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ── Parcours ────────────────────────────────────────── */}
      <section className="section-band band-dark">
        <Container>
          <div className="ep-section-header">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Parcours</p>
            <h2 className="mt-3 font-display text-4xl uppercase tracking-[0.06em] text-white md:text-5xl">
              Comment on en est<br className="hidden sm:block" /> arrivé là
            </h2>
          </div>

          <div className="ep-timeline">
            {careerMilestones.map((item, i) => (
              <div key={item.period} className="ep-timeline-item">
                <div className="ep-timeline-left">
                  <span className="ep-timeline-period">{item.period}</span>
                  {i < careerMilestones.length - 1 && <span className="ep-timeline-line" aria-hidden />}
                </div>
                <div className="ep-timeline-body">
                  <h3 className="font-display text-2xl uppercase tracking-[0.06em] text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/68">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Approche ────────────────────────────────────────── */}
      <section className="section-band band-muted">
        <Container>
          <div className="ep-approach">
            <div className="ep-approach-quote">
              <span className="ep-big-quote" aria-hidden>&ldquo;</span>
              <p className="ep-quote-text">
                Le cadre exigeant n&apos;est pas une contrainte — c&apos;est ce qui permet aux joueuses de se faire vraiment confiance.
              </p>
              <p className="ep-quote-author">— {coachProfile.fullName}</p>
            </div>

            <div className="ep-approach-list">
              <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Mon approche terrain</p>
              <ul className="mt-5 space-y-0">
                {coachApproach.map((item, i) => (
                  <li key={item} className="ep-approach-item">
                    <span className="ep-approach-num" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      {/* ── Valeurs ─────────────────────────────────────────── */}
      <section className="section-band band-dark">
        <Container>
          <div className="mb-12">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Valeurs d&apos;encadrement</p>
            <h2 className="mt-3 font-display text-4xl uppercase tracking-[0.06em] text-white md:text-5xl">
              Ce qui guide chaque séance
            </h2>
          </div>

          <div className="ep-values-grid">
            {coachProfile.values.map((value, i) => (
              <div key={value} className="ep-value-card">
                <span className="ep-value-num" aria-hidden>0{i + 1}</span>
                <p className="ep-value-label">{value}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="section-band band-soft">
        <Container className="max-w-3xl">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Travailler ensemble</p>
            <h2 className="mt-3 font-display text-4xl uppercase tracking-[0.06em] text-white md:text-5xl">
              Votre joueuse mérite<br className="hidden sm:block" /> ce niveau d&apos;encadrement
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/60">
              Places limitées à 10 joueuses par groupe. Contactez-nous pour vérifier la disponibilité.
            </p>
            <Link
              href="/inscription"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-8 py-3.5 text-xs font-bold uppercase tracking-[0.14em] text-ink transition hover:bg-accent-soft"
            >
              Réserver une place <span aria-hidden>→</span>
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
