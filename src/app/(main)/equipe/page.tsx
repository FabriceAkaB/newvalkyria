import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/container";
import { coachProfile } from "@/lib/site-content";
import teamPhoto from "@/content/image/photos/newval2_940.jpg";

export const metadata: Metadata = {
  title: "À propos | New Valkyria",
  description: "La mission de New Valkyria, nos valeurs d'encadrement et ce qui s'en vient pour l'académie.",
  alternates: { canonical: "/equipe" }
};

const roadmapItems = [
  { icon: "▤", title: "Espace membre", desc: "Suivi personnalisé en ligne avec historique des séances, objectifs et progression documentée pour chaque joueuse." },
  { icon: "⬡", title: "Expérience internationale", desc: "Opportunités de tournois et de stages à l'international pour les joueuses prêtes à vivre le foot autrement." },
  { icon: "◈", title: "Camps de perfectionnement", desc: "Camps intensifs pendant les congés scolaires pour accélérer la progression technique et physique." },
  { icon: "▷", title: "Vidéothèque", desc: "Exercices filmés et indexés par niveau et thème pour compléter le travail hors terrain de façon autonome." }
];

export default function EquipePage() {
  return (
    <>
      {/* ── Mot de l'équipe ──────────────────────────────────── */}
      <section className="nv-section-band-dark" style={{ paddingTop: "9rem" }}>
        <Container>
          <div className="nv-team-row">
            <div className="nv-team-img">
              <Image src={teamPhoto} alt="Joueuses New Valkyria célébrant sur le terrain" fill className="object-cover" sizes="(max-width: 768px) 100vw, 380px" />
            </div>
            <div className="nv-team-text">
              <span className="nv-label">Mot de l&apos;équipe</span>
              <h1 className="nv-heading">Pourquoi New Valkyria existe</h1>
              <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.65)", lineHeight: "1.76", maxWidth: "58ch", marginBottom: "1.25rem" }}>
                Chez New Valkyria, nous voulons faire grandir le foot féminin — et ça commence par leur offrir un
                environnement pensé à 100 % pour elles. Pas un programme adapté d&apos;ailleurs : des séances conçues
                dès le départ pour leurs besoins, dans un cadre où elles se sentent à l&apos;aise de progresser, de se
                tromper et de recommencer.
              </p>
              <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.65)", lineHeight: "1.76", maxWidth: "58ch" }}>
                Notre plus grande fierté, c&apos;est de voir l&apos;une de nos guerrières commencer à prendre confiance
                en elle, séance après séance, en même temps que sa technique progresse. Cette confiance ne se construit
                jamais seule : c&apos;est ensemble — coachs, parents et joueuses — que nous gardons les filles motivées
                dans le sport.
              </p>
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
            <span className="nv-label">Travailler ensemble</span>
            <h2 className="nv-heading">
              Votre joueuse mérite<br className="hidden sm:block" /> ce niveau d&apos;encadrement
            </h2>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "0.95rem", lineHeight: 1.7, marginBottom: "2rem", maxWidth: "44ch", marginLeft: "auto", marginRight: "auto" }}>
              Encadrement de 1 coach pour 6 à 8 joueuses. Contactez-nous pour vérifier la disponibilité.
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
