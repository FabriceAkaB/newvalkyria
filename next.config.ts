import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // En-têtes de sécurité (audit du 17 nov. 2026) : pas d'intégration du site dans une autre page (clickjacking),
  // pas de devinette de type de fichier, l'adresse complète jamais envoyée aux autres sites, pas de caméra ni de
  // localisation demandées par les pages. La borne (/borne) a sa clé dans l'adresse : aucun « referer » du tout.
  async headers() {
    const base = [
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }
    ];
    return [
      { source: "/:path*", headers: base },
      { source: "/borne/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      { source: "/(admin|entraineur|compte|api)/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }
    ];
  },
  // Ancienne page cachée « Qualification » : l'essai gratuit est maintenant dans le site (/inscription/essai).
  async redirects() {
    return [{ source: "/qualification", destination: "/inscription/essai", permanent: true }];
  },
  // pdfkit charge ses fichiers de police (.afm) via __dirname au moment de
  // l'exécution — le bundler casse ce chemin s'il essaie de l'empaqueter.
  // On le garde en dépendance Node externe non transformée.
  serverExternalPackages: ["pdfkit"],
  turbopack: {
    root: dirname
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      },
      {
        protocol: "https",
        hostname: "picsum.photos"
      },
      {
        protocol: "https",
        hostname: "cdn.sanity.io"
      },
      {
        protocol: "https",
        hostname: "bavrkbyiofmaoryshmxu.supabase.co"
      }
    ]
  }
};

export default nextConfig;
