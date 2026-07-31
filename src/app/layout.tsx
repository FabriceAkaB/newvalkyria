import type { Metadata } from "next";
import { Barlow_Semi_Condensed, Oswald } from "next/font/google";

import { AnalyticsScripts } from "@/components/analytics-scripts";

import "./globals.css";

const barlowSemiCondensed = Barlow_Semi_Condensed({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const oswald = Oswald({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "New Valkyria | Académie technique féminine",
  description:
    "Académie de coaching soccer féminin dans les Laurentides. Programme saison semi-privé, suivi technique, discipline et progression visible.",
  metadataBase: new URL("https://www.newvalkyria.ca"),
  alternates: { canonical: "/" },
  openGraph: {
    title: "New Valkyria",
    description: "Former des joueuses plus techniques, intelligentes et confiantes.",
    locale: "fr_CA",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "New Valkyria — Académie féminine de soccer, Laurentides"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "New Valkyria | Académie technique féminine",
    description: "Former des joueuses plus techniques, intelligentes et confiantes.",
    images: ["/og-image.jpg"]
  }
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "SportsActivityLocation",
  name: "New Valkyria",
  alternateName: "Académie New Valkyria",
  description:
    "Académie de soccer technique pour joueuses de 8 à 14 ans dans les Laurentides. Groupes semi-privés, suivi individuel, progression documentée.",
  url: "https://www.newvalkyria.ca",
  logo: "https://www.newvalkyria.ca/logo.png",
  image: "https://www.newvalkyria.ca/og-image.jpg",
  email: "info@newvalkyria.com",
  address: {
    "@type": "PostalAddress",
    addressRegion: "QC",
    addressCountry: "CA"
  },
  areaServed: ["Terrebonne", "Sainte-Thérèse", "Saint-Jérôme", "Rosemère"].map((name) => ({
    "@type": "City",
    name
  })),
  founder: {
    "@type": "Person",
    name: "Michel Aka"
  },
  sameAs: [
    "https://www.instagram.com/newvalkyria_ac",
    "https://facebook.com/newvalkyria",
    "https://tiktok.com/@newvalkyria"
  ]
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr-CA">
      <body className={`${barlowSemiCondensed.variable} ${oswald.variable} bg-ink text-white antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <AnalyticsScripts />
        {children}
      </body>
    </html>
  );
}
