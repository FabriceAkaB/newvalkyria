import type { Metadata } from "next";

import { SportEtudesContent } from "@/components/sport-etudes-content";
import { countFullProgramRegistrations, getActiveSessions, getSettings } from "@/lib/sport-etudes-repo";

export const metadata: Metadata = {
  title: "Programme technique de préparation aux évaluations du Sport-Études | New Valkyria",
  description:
    "Encadrement technique intensif pour préparer un jeune joueur à son entrée dans un programme Sport-Études — 6 séances et une séance diagnostique gratuite.",
  alternates: { canonical: "/sport-etudes" },
  // Aperçu du lien : logo de l'académie en noir et blanc (programme garçons).
  openGraph: {
    title: "Programme Sport-Études — Garçons | New Valkyria",
    description: "Encadrement technique intensif pour préparer un jeune joueur à son entrée dans un programme Sport-Études.",
    url: "/sport-etudes",
    type: "website",
    locale: "fr_CA",
    siteName: "New Valkyria",
    images: [{ url: "/og/garcons.jpg", width: 1200, height: 628, alt: "New Valkyria" }]
  },
  twitter: { card: "summary_large_image", title: "Programme Sport-Études — Garçons | New Valkyria", images: ["/og/garcons.jpg"] }
};

export const dynamic = "force-dynamic";

export default async function SportEtudesPage() {
  const [sessions, settings, takenCount] = await Promise.all([getActiveSessions(), getSettings(), countFullProgramRegistrations()]);
  const remaining = Math.max(0, settings.max_capacity - takenCount - settings.manual_reserved_spots);

  return <SportEtudesContent sessions={sessions} remaining={remaining} isFull={remaining <= 0} />;
}
