import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api/", "/prive/", "/compte/"]
      }
    ],
    sitemap: "https://www.newvalkyria.com/sitemap.xml"
  };
}
