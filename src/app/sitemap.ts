import type { MetadataRoute } from "next";

const pages = ["", "/methode", "/equipe", "/vision", "/inscription", "/confirmation", "/politique-confidentialite", "/mentions-legales"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.newvalkyria.ca";

  return pages.map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.7
  }));
}
