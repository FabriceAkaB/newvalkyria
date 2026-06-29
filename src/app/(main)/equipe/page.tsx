import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/container";
import { coachProfile } from "@/lib/site-content";
import equipeHeroImg from "@/content/image/photos/DSC02086.jpg";

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
      {/* ── Hero — photo full-screen ─────────────────────────── */}
      <section className="page-hero">
        <Image src={equipeHeroImg} alt="" fill priority className="object-cover object-center" aria-hidden />
        <div className="page-hero-overlay" />
        <div className="page-hero-content w-full">
          <Container>
            <span className="nv-label">L&apos;équipe</span>
            <h1 className="page-hero-title">
              Derrière<br />l&apos;académie
            </h1>
          </Container>
        </div>
      </section>

      {/* ── Coach ────────────────────────────────────────────── */}
      <section className="nv-section-band-dark">
        <Container>
          <div style={{ maxWidth: "680px" }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              background: "rgba(176,144,200,0.1)",
              borderRadius: "0.5rem",
              padding: "0.3rem 0.9rem",
              fontSize: "0.6rem",
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              color: "var(--color-accent-soft)",
              marginBottom: "1.25rem"
            }}>
              Owner &amp; CEO
            </div>
            <h2 style={{
              fontFamily: "var(--font-display), sans-serif",
              fontSize: "clamp(2.75rem, 6vw, 5.5rem)",
              textTransform: "uppercase",
              letterSpacing: "0.03em",
              color: "#fff",
              margin: "0 0 1.5rem",
              lineHeight: "0.93"
            }}>
              Michel Aka
            </h2>
            <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.65)", lineHeight: "1.76", maxWidth: "58ch" }}>
              Fondateur et directeur de New Valkyria, Michel Aka a bâti l&apos;académie avec une conviction claire :
              les joueuses des Laurentides méritent un encadrement technique structuré, exigeant et centré sur
              leur progression réelle. Il pilote la vision stratégique, les partenariats et l&apos;organisation
              globale de l&apos;académie.
            </p>
          </div>
        </Container>
      </section>

      {/* ── Parcours ─────────────────────────────────────────── */}
      <section className="nv-section-band-mid">
        <Container>
          <span className="nv-label">Parcours</span>
          <h2 className="nv-heading">Comment on en est<br className="hidden sm:block" /> arrivé là</h2>
          <div className="nv-timeline">
            {careerMilestones.map((item) => (
              <div key={item.period} className="nv-timeline-item">
                <div className="nv-timeline-period">{item.period}</div>
                <div>
                  <h3 className="nv-timeline-title">{item.title}</h3>
                  <p className="nv-timeline-desc">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Approche ─────────────────────────────────────────── */}
      <section className="nv-section-band-dark">
        <Container>
          <div className="nv-approach-grid">
            <div>
              <p className="nv-approach-quote">
                Le cadre exigeant n&apos;est pas une contrainte — c&apos;est ce qui permet aux joueuses de se faire vraiment confiance.
              </p>
              <p className="nv-approach-author">— L&apos;équipe New Valkyria</p>
            </div>
            <div>
              <span className="nv-label">Mon approche terrain</span>
              <div className="nv-approach-list">
                {coachApproach.map((item, i) => (
                  <div key={item} className="nv-approach-item">
                    <span className="nv-approach-num">{String(i + 1).padStart(2, "0")}</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ── Valeurs ──────────────────────────────────────────── */}
      <section className="nv-section-band-mid">
        <Container>
          <span className="nv-label">Valeurs d&apos;encadrement</span>
          <h2 className="nv-heading">Ce qui guide chaque séance</h2>
          <div className="nv-values-grid">
            {coachProfile.values.map((value, i) => (
              <div key={value} className="nv-value-card">
                <span className="nv-value-num">0{i + 1}</span>
                <p className="nv-value-label">{value}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="nv-section-band-dark">
        <Container className="max-w-3xl">
          <div className="text-center">
            <span className="nv-label">Travailler ensemble</span>
            <h2 className="nv-heading">
              Votre joueuse mérite<br className="hidden sm:block" /> ce niveau d&apos;encadrement
            </h2>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.95rem", lineHeight: 1.7, marginBottom: "2rem", maxWidth: "44ch", marginLeft: "auto", marginRight: "auto" }}>
              Places limitées à 10 joueuses par groupe. Contactez-nous pour vérifier la disponibilité.
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
