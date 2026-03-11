import type { Metadata } from "next";

import { Container } from "@/components/container";

export const metadata: Metadata = {
  title: "Mentions légales | New Valkyria",
  description: "Mentions légales et conditions d'utilisation du site New Valkyria.",
  robots: { index: false }
};

const sections = [
  {
    title: "Éditeur du site",
    content: `New Valkyria\nAcadémie technique de soccer féminin\nLaurentides, Québec, Canada\nCourriel : jpaka06@gmail.com\nSite web : www.newvalkyria.ca`
  },
  {
    title: "Hébergement",
    content: `Ce site est hébergé par Vercel Inc.\n340 Pine Street, Suite 701\nSan Francisco, CA 94104, États-Unis\nvercel.com`
  },
  {
    title: "Propriété intellectuelle",
    content: `L'ensemble du contenu de ce site — textes, visuels, structure, logos et nom de marque — est la propriété exclusive de New Valkyria. Toute reproduction, distribution ou utilisation sans autorisation écrite préalable est strictement interdite.`
  },
  {
    title: "Conditions d'utilisation",
    content: `L'accès et l'utilisation de ce site impliquent l'acceptation des présentes conditions. New Valkyria se réserve le droit de modifier le contenu du site à tout moment sans préavis.\n\nNew Valkyria ne saurait être tenu responsable des dommages directs ou indirects résultant de l'utilisation de ce site ou de l'impossibilité d'y accéder.`
  },
  {
    title: "Services proposés",
    content: `New Valkyria propose des programmes d'entraînement semi-privés de soccer féminin destinés aux joueuses de 9 à 14 ans dans la région des Laurentides, Québec.\n\nL'inscription implique l'acceptation des conditions de la saison, incluant :\n\n• L'engagement pour la durée complète de la saison (15 séances)\n• Le paiement intégral via Stripe au moment de l'inscription\n• Le respect du règlement intérieur communiqué avant le début de la saison`
  },
  {
    title: "Politique de remboursement",
    content: `New Valkyria offre une garantie de progression à la 7e séance. Si aucune progression mesurable n'est constatée à l'issue de la 7e séance, un remboursement intégral peut être demandé.\n\nPassé ce délai, les inscriptions ne sont pas remboursables, sauf en cas de blessure médicalement justifiée ou d'annulation de la saison par New Valkyria. Dans ce cas, un remboursement au prorata sera effectué.`
  },
  {
    title: "Responsabilité",
    content: `Les parents ou tuteurs légaux sont responsables de s'assurer que leur enfant est en bonne condition physique pour participer aux séances. New Valkyria ne peut être tenu responsable des blessures survenues en dehors des séances d'entraînement.\n\nPendant les séances, l'encadrement est assuré par un coach certifié. Toutes les mesures raisonnables sont prises pour garantir la sécurité des joueuses.`
  },
  {
    title: "Paiements",
    content: `Les paiements sont traités de manière sécurisée par Stripe. En procédant au paiement, vous acceptez également les conditions d'utilisation de Stripe disponibles sur stripe.com/legal.\n\nNew Valkyria ne stocke aucune donnée bancaire sur ses serveurs.`
  },
  {
    title: "Droit applicable",
    content: `Les présentes mentions légales sont soumises au droit québécois et canadien. Tout litige relatif à l'utilisation de ce site ou aux services proposés relève de la compétence exclusive des tribunaux de la province de Québec.`
  },
  {
    title: "Contact",
    content: `Pour toute question ou réclamation :\n\nNew Valkyria\nLaurentides, Québec, Canada\njpaka06@gmail.com`
  }
];

export default function MentionsLegalesPage() {
  return (
    <section className="section-band band-dark min-h-screen">
      <Container className="max-w-3xl">
        <div className="mb-12">
          <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Légal</p>
          <h1 className="mt-3 font-display text-4xl uppercase tracking-[0.06em] text-white">
            Mentions légales
          </h1>
          <p className="mt-4 text-sm text-white/50">
            Dernière mise à jour : janvier 2025
          </p>
        </div>

        <div className="space-y-10">
          {sections.map((section, i) => (
            <div key={section.title}>
              <h2 className="font-display text-lg uppercase tracking-[0.06em] text-white">
                <span className="mr-3 text-sm text-accent/60">{String(i + 1).padStart(2, "0")}</span>
                {section.title}
              </h2>
              <div className="mt-3 space-y-2">
                {section.content.split("\n\n").map((para, j) => (
                  <p key={j} className="text-sm leading-relaxed text-white/65 whitespace-pre-line">
                    {para}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
