import type { Metadata } from "next";

import { MatchSlotsContent } from "@/components/match-slots-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Réservez votre match | New Valkyria",
  description: "Réservez vos plages de match contre New Valkyria à Terrebonne et à Rosemère : le lieu est indiqué sur chaque match.",
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: "/prive/matchs" },
  openGraph: {
    title: "Réservez votre match | New Valkyria",
    description: "Réservez vos plages de match contre New Valkyria à Terrebonne et à Rosemère : le lieu est indiqué sur chaque match.",
    url: "/prive/matchs",
    type: "website",
    locale: "fr_CA",
    siteName: "New Valkyria",
    images: [{ url: "/og/garcons.jpg", width: 1200, height: 628, alt: "New Valkyria" }]
  },
  twitter: { card: "summary_large_image", title: "Réservez votre match | New Valkyria", images: ["/og/garcons.jpg"] }
};

export default async function MatchsPage({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const { cancelled } = await searchParams;
  return <MatchSlotsContent cancelled={cancelled === "1"} />;
}
