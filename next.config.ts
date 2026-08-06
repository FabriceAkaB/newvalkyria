import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
