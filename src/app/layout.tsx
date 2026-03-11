import type { Metadata } from "next";
import { Sora, Archivo_Black } from "next/font/google";

import { AnalyticsScripts } from "@/components/analytics-scripts";

import "./globals.css";

const sora = Sora({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"]
});

const archivoBlack = Archivo_Black({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400"
});

export const metadata: Metadata = {
  title: "New Valkyria | Académie technique féminine",
  description:
    "Académie de coaching soccer féminin dans les Laurentides. Programme saison semi-privé, suivi technique, discipline et progression visible.",
  metadataBase: new URL("https://www.newvalkyria.ca"),
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr-CA">
      <body className={`${sora.variable} ${archivoBlack.variable} bg-ink text-white antialiased`}>
        <AnalyticsScripts />
        {children}
      </body>
    </html>
  );
}
