import type { Metadata } from "next";

import { Container } from "@/components/container";

export const metadata: Metadata = {
  title: "Politique de confidentialité | New Valkyria",
  description: "Comment New Valkyria collecte, utilise et protège vos données personnelles.",
  robots: { index: false }
};

const sections = [
  {
    title: "Responsable du traitement",
    content: `New Valkyria est responsable du traitement des données personnelles collectées via ce site. Pour toute question relative à la protection de vos données, vous pouvez nous contacter à l'adresse : jpaka06@gmail.com`
  },
  {
    title: "Données collectées",
    content: `Dans le cadre du processus d'inscription, nous collectons les informations suivantes :\n\n• Nom du parent ou tuteur\n• Adresse courriel\n• Numéro de téléphone\n• Ville de résidence\n• Informations sur la joueuse (âge, niveau de jeu, objectif)\n• Disponibilités souhaitées\n\nLes données de paiement (numéros de carte bancaire, etc.) sont traitées directement et exclusivement par Stripe. New Valkyria ne stocke aucune donnée de paiement sur ses serveurs.`
  },
  {
    title: "Finalités du traitement",
    content: `Vos données sont utilisées exclusivement pour :\n\n• Traiter votre inscription et organiser les séances\n• Vous contacter pour la coordination logistique de la saison\n• Traiter le paiement via notre prestataire Stripe\n• Vous envoyer un courriel de confirmation d'inscription\n• Vous informer des mises à jour importantes concernant votre groupe`
  },
  {
    title: "Base légale",
    content: `Le traitement de vos données repose sur votre consentement explicite, exprimé lors du remplissage du formulaire d'inscription, ainsi que sur l'exécution du contrat de prestation de services entre New Valkyria et vous.`
  },
  {
    title: "Conservation des données",
    content: `Vos données personnelles sont conservées pour la durée nécessaire à la prestation des services (durée de la saison), puis archivées pendant une période maximale de 3 ans à des fins administratives et comptables, conformément aux obligations légales applicables au Québec.`
  },
  {
    title: "Partage des données",
    content: `Vos données ne sont jamais vendues ni transmises à des tiers à des fins commerciales. Elles peuvent être partagées uniquement avec :\n\n• Stripe (traitement des paiements) — politique disponible sur stripe.com\n• Supabase (hébergement sécurisé de la base de données)\n• Resend (envoi des courriels transactionnels)\n\nCes prestataires sont contractuellement tenus de protéger vos données.`
  },
  {
    title: "Vos droits",
    content: `Conformément à la Loi 25 (Loi modernisant des dispositions législatives en matière de protection des renseignements personnels) et à la Loi sur la protection des renseignements personnels dans le secteur privé (Québec), vous disposez des droits suivants :\n\n• Droit d'accès à vos données\n• Droit de rectification des données inexactes\n• Droit à l'effacement de vos données\n• Droit à la portabilité de vos données\n• Droit de retirer votre consentement à tout moment\n\nPour exercer ces droits, contactez-nous à : jpaka06@gmail.com`
  },
  {
    title: "Sécurité",
    content: `Nous mettons en œuvre les mesures techniques et organisationnelles appropriées pour protéger vos données contre tout accès non autorisé, modification, divulgation ou destruction. Les communications entre votre navigateur et nos serveurs sont chiffrées via HTTPS.`
  },
  {
    title: "Cookies",
    content: `Ce site utilise des cookies techniques nécessaires au bon fonctionnement des pages, ainsi que des cookies analytiques anonymes (Plausible Analytics) pour mesurer l'audience de manière respectueuse de la vie privée, sans collecte de données personnelles identifiables.`
  },
  {
    title: "Modifications",
    content: `New Valkyria se réserve le droit de modifier la présente politique à tout moment. Toute modification substantielle vous sera communiquée par courriel ou affichée de manière visible sur ce site.`
  },
  {
    title: "Contact",
    content: `Pour toute question concernant cette politique ou l'exercice de vos droits :\n\nNew Valkyria\nLaurentides, Québec, Canada\njpaka06@gmail.com`
  }
];

export default function PolitiqueConfidentialitePage() {
  return (
    <section className="section-band band-dark min-h-screen">
      <Container className="max-w-3xl">
        <div className="mb-12">
          <p className="text-xs uppercase tracking-[0.2em] text-accent-soft">Légal</p>
          <h1 className="mt-3 font-display text-4xl uppercase tracking-[0.06em] text-white">
            Politique de confidentialité
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
