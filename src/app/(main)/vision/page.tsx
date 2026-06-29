import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/container";
import visionHeroImg from "@/content/image/photos/DSC02229.jpg";

export const metadata: Metadata = {
  title: "Vision | New Valkyria",
  description: "Vision de développement de l'académie et prochaines évolutions de service."
};

const visionPhases = [
  {
    phase: "Maintenant",
    status: "active",
    title: "Académie locale d'excellence",
    desc: "Groupes semi-privés dans les Laurentides. Méthodologie rigoureuse, suivi individuel, résultats documentés. La qualité avant la quantité."
  },
  {
    phase: "Prochainement",
    status: "soon",
    title: "Expansion régionale",
    desc: "Ouvrir de nouveaux groupes dans d'autres secteurs de la région. Former d'autres coachs à la méthodologie New Valkyria pour maintenir le niveau d'exigence."
  },
  {
    phase: "Long terme",
    status: "future",
    title: "Référence du foot féminin québécois",
    desc: "Construire une structure complète : académie, programmes en ligne, communauté de joueuses. Devenir la référence pour les familles qui veulent une progression réelle."
  }
];

const roadmapItems = [
  { icon: "▤", title: "Espace membre", desc: "Suivi personnalisé en ligne avec historique des séances, objectifs et progression documentée pour chaque joueuse." },
  { icon: "⬡", title: "Programmes PDF", desc: "Bibliothèque de routines techniques à la maison organisées par niveau, position et objectif de progression." },
  { icon: "◈", title: "Blog parental", desc: "Ressources pour aider les parents à mieux comprendre le développement technique de leur joueuse." },
  { icon: "▷", title: "Vidéothèque", desc: "Exercices filmés et indexés par niveau et thème pour compléter le travail hors terrain de façon autonome." }
];

const northStarValues = [
  "Qualité avant la croissance",
  "Exigence au service de la confiance",
  "Transparence avec les familles",
  "Progression mesurable, pas ressentie"
];

export default function VisionPage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="page-hero">
        <Image src={visionHeroImg} alt="" fill priority className="object-cover object-center" aria-hidden />
        <div className="page-hero-overlay" />
        <div className="page-hero-content w-full">
          <Container>
            <span className="nv-label">Vision</span>
            <h1 className="page-hero-title">
              Construire<br />la référence
            </h1>
            <p className="page-hero-sub">
              New Valkyria démarre localement avec une promesse claire — qualité, progression, exigence. Cette base prépare une montée en puissance structurée et durable.
            </p>
          </Container>
        </div>
      </section>

      {/* ── 3 Phases ─────────────────────────────────────────── */}
      <section className="nv-section-band-dark">
        <Container>
          <span className="nv-label">Évolution</span>
          <h2 className="nv-heading">Où on va</h2>
          <div className="nv-phase-grid">
            {visionPhases.map((phase) => (
              <div key={phase.phase} className={`nv-phase-card ${phase.status === "active" ? "nv-phase-card-active" : ""}`}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span className={`nv-phase-tag nv-phase-tag-${phase.status}`}>{phase.phase}</span>
                  {phase.status === "active" && <span className="nv-phase-status">En cours</span>}
                </div>
                <h3 className="nv-phase-title">{phase.title}</h3>
                <p className="nv-phase-desc">{phase.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── North star ───────────────────────────────────────── */}
      <section className="nv-section-band-mid">
        <Container>
          <div className="nv-northstar-layout">
            <div>
              <span className="nv-label">Nos principes directeurs</span>
              <h2 className="nv-heading">Ce qui ne<br />changera pas</h2>
            </div>
            <ul className="nv-northstar-list">
              {northStarValues.map((val, i) => (
                <li key={val} className="nv-northstar-item">
                  <span className="nv-northstar-num">{String(i + 1).padStart(2, "0")}</span>
                  <span>{val}</span>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* ── Roadmap ──────────────────────────────────────────── */}
      <section className="nv-section-band-dark">
        <Container>
          <span className="nv-label">En préparation</span>
          <h2 className="nv-heading">Ce qui arrive bientôt</h2>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.95rem", lineHeight: 1.7, maxWidth: "50ch", marginBottom: 0 }}>
            Des outils conçus pour prolonger la progression au-delà du terrain et impliquer les familles dans le développement de leur joueuse.
          </p>
          <div className="nv-roadmap-grid">
            {roadmapItems.map((item) => (
              <div key={item.title} className="nv-roadmap-card">
                <span className="nv-roadmap-icon" aria-hidden>{item.icon}</span>
                <h3 className="nv-roadmap-title">{item.title}</h3>
                <p className="nv-roadmap-desc">{item.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="nv-section-band-mid">
        <Container className="max-w-3xl">
          <div className="text-center">
            <span className="nv-label">Faire partie de l&apos;aventure</span>
            <h2 className="nv-heading">
              Rejoindre New Valkyria<br className="hidden sm:block" /> maintenant
            </h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.95rem", lineHeight: 1.7, marginBottom: "2rem", maxWidth: "42ch", marginLeft: "auto", marginRight: "auto" }}>
              Les premières familles qui rejoignent l&apos;académie construisent quelque chose avec nous. Places limitées.
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
