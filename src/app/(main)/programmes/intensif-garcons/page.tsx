import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { SessionProgramContent } from "@/components/session-program-content";
import { countActiveRegistrations, getProgram, getProgramDates } from "@/lib/session-programs-repo";

// L'aperçu du lien (texto, WhatsApp, Messenger, courriel) montre le logo de l'académie en
// noir et blanc sur fond neutre — jamais la photo d'accueil ni de mention des filles.
const TITLE = "Programme intensif garçons 2015 | New Valkyria";
const DESCRIPTION = "Préparation technique intensive pour garçons nés en 2015 — 10 pratiques du samedi à l'École Chambéry (Blainville), incluant 3 matchs amicaux. Encadré par JP, coach certifié.";
const OG_IMAGE = { url: "/og/garcons.jpg", width: 1200, height: 628, alt: "New Valkyria" };

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/programmes/intensif-garcons" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/programmes/intensif-garcons", type: "website", locale: "fr_CA", siteName: "New Valkyria", images: [OG_IMAGE] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [OG_IMAGE.url] }
};

export const dynamic = "force-dynamic";

export default async function ProgrammeIntensifPage() {
  const slug = "intensif-garcons" as const;
  const program = await getProgram(slug);
  if (!program) notFound();

  const [dates, taken] = await Promise.all([getProgramDates(slug), countActiveRegistrations(slug)]);
  const remaining = Math.max(0, program.max_capacity - taken);

  // Programme complet — la page est fermée, personne ne peut plus y accéder
  // ni s'inscrire (plutôt que d'afficher un simple message "complet").
  if (remaining <= 0) notFound();

  return (
    <SessionProgramContent
      slug={slug}
      title={program.name}
      tagline="Garçons nés en 2015"
      intro={`Une préparation technique intensive de ${dates.length} pratiques du samedi à l'École Chambéry (Blainville), incluant 3 matchs amicaux (dates à déterminer). Encadré par JP, coach certifié.`}
      priceCents={program.price_cents}
      saturdayPackageCents={program.saturday_package_price_cents}
      allowInstallments
      dates={dates}
      remaining={remaining}
      isFull={remaining <= 0}
    />
  );
}
