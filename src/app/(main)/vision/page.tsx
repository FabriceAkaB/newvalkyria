import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/container";

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
  {
    icon: "▤",
    title: "Espace membre",
    desc: "Suivi personnalisé en ligne avec historique des séances, objectifs et progression documentée pour chaque joueuse."
  },
  {
    icon: "⬡",
    title: "Programmes PDF",
    desc: "Bibliothèque de routines techniques à la maison organisées par niveau, position et objectif de progression."
  },
  {
    icon: "◈",
    title: "Blog parental",
    desc: "Ressources pour aider les parents à mieux comprendre le développement technique de leur joueuse."
  },
  {
    icon: "▷",
    title: "Vidéothèque",
    desc: "Exercices filmés et indexés par niveau et thème pour compléter le travail hors terrain de façon autonome."
  }
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
      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="vp-hero">
        <Container>
          <div className="vp-hero-inner">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Vision</p>
            <h1 className="vp-hero-title">
              Construire une référence<br className="hidden md:block" /> régionale du foot féminin
            </h1>
            <p className="vp-hero-desc">
              New Valkyria démarre localement avec une promesse claire — qualité, progression, exigence. Cette base prépare une montée en puissance structurée et durable.
            </p>
            <div className="vp-hero-pill">
              <span className="vp-hero-dot" aria-hidden />
              En développement actif · Laurentides
            </div>
          </div>
        </Container>
      </section>

      {/* ── 3 phases ────────────────────────────────────────── */}
      <section className="section-band band-dark">
        <Container>
          <div className="mb-14">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Évolution</p>
            <h2 className="mt-3 font-display text-4xl uppercase tracking-[0.06em] text-white md:text-5xl">
              Où on va
            </h2>
          </div>

          <div className="vp-phases">
            {visionPhases.map((phase) => (
              <div key={phase.phase} className={`vp-phase ${phase.status === "active" ? "vp-phase-active" : ""}`}>
                <div className="vp-phase-tag-row">
                  <span className={`vp-phase-tag vp-phase-tag-${phase.status}`}>{phase.phase}</span>
                  {phase.status === "active" && (
                    <span className="vp-phase-live" aria-label="En cours">
                      <span className="vp-phase-dot" aria-hidden />
                      En cours
                    </span>
                  )}
                </div>
                <h3 className="mt-4 font-display text-2xl uppercase tracking-[0.06em] text-white">{phase.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/65">{phase.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── North star ──────────────────────────────────────── */}
      <section className="section-band band-muted">
        <Container>
          <div className="vp-northstar">
            <div className="vp-northstar-left">
              <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Nos principes directeurs</p>
              <h2 className="mt-3 font-display text-4xl uppercase tracking-[0.06em] text-white leading-[1.04] md:text-5xl">
                Ce qui ne<br /> changera pas
              </h2>
            </div>
            <ul className="vp-northstar-list">
              {northStarValues.map((val, i) => (
                <li key={val} className="vp-northstar-item">
                  <span className="vp-northstar-num" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                  <span>{val}</span>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* ── Roadmap fonctionnalités ──────────────────────────── */}
      <section className="section-band band-dark">
        <Container>
          <div className="mb-12">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">En préparation</p>
            <h2 className="mt-3 font-display text-4xl uppercase tracking-[0.06em] text-white md:text-5xl">
              Ce qui arrive bientôt
            </h2>
            <p className="mt-4 max-w-lg text-sm text-white/60">
              Des outils conçus pour prolonger la progression au-delà du terrain et impliquer les familles dans le développement de leur joueuse.
            </p>
          </div>

          <div className="vp-roadmap">
            {roadmapItems.map((item) => (
              <div key={item.title} className="vp-roadmap-card">
                <span className="vp-roadmap-icon" aria-hidden>{item.icon}</span>
                <h3 className="mt-4 font-display text-xl uppercase tracking-[0.06em] text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/62">{item.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="section-band band-soft">
        <Container className="max-w-3xl">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Faire partie de l&apos;aventure</p>
            <h2 className="mt-3 font-display text-4xl uppercase tracking-[0.06em] text-white md:text-5xl">
              Rejoindre New Valkyria<br className="hidden sm:block" /> maintenant
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/58">
              Les premières familles qui rejoignent l&apos;académie construisent quelque chose avec nous. Places limitées.
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
