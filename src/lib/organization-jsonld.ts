/** Données structurées de l'académie (SEO) — injectées seulement sur les pages publiques du site principal. */
export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "SportsActivityLocation",
  name: "New Valkyria",
  alternateName: "Académie New Valkyria",
  description:
    "Académie de soccer technique pour joueuses de 8 à 14 ans dans les Laurentides. Groupes semi-privés, suivi individuel, progression documentée.",
  url: "https://www.newvalkyria.com",
  logo: "https://www.newvalkyria.com/logo.png",
  image: "https://www.newvalkyria.com/og-image.jpg",
  email: "info@newvalkyria.com",
  address: {
    "@type": "PostalAddress",
    addressRegion: "QC",
    addressCountry: "CA"
  },
  areaServed: ["Terrebonne", "Sainte-Thérèse", "Prévost", "Rosemère"].map((name) => ({
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

