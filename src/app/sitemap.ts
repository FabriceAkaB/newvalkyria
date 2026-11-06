import type { MetadataRoute } from "next";

// Pages publiques que Google doit trouver (pas /confirmation : page de fin de paiement, sans intérêt pour la recherche).
const pages = [
  "",
  "/inscription",
  "/inscription/essai",
  "/sport-etudes",
  "/programmes/intensif-garcons",
  "/programmes/privilege-valkyria",
  "/location-terrains",
  "/boutique",
  "/methode",
  "/equipe",
  "/politique-confidentialite",
  "/mentions-legales"
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.newvalkyria.com";

  return pages.map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.7
  }));
}
