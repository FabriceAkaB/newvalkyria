import Link from "next/link";

import { Container } from "@/components/container";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-white/10 bg-[#0d0a14] py-10 pb-[calc(2.5rem+68px)] text-sm text-white/75 md:pb-10">
      <Container className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <p className="font-display text-lg uppercase tracking-[0.16em] text-white">New Valkyria</p>
          <p>Académie technique féminine · Laurentides</p>
          <div className="pt-2 space-y-0.5 text-xs text-white/40">
            <p>
              <a href="mailto:jpaka06@gmail.com" className="hover:text-white/65 transition-colors">
                jpaka06@gmail.com
              </a>
            </p>
            <p>
              <a href="tel:+15146883600" className="hover:text-white/65 transition-colors">
                514 688-3600
              </a>
            </p>
          </div>
        </div>

        <div className="space-y-2 text-right">
          <p>Lundi, Mercredi, Vendredi</p>
          <p>Rosemère · Mirabel · Saint-Thérèse</p>
          <Link href="/inscription" className="text-accent hover:text-accent-soft transition-colors">
            Démarrer l&apos;inscription
          </Link>
          <div className="flex gap-4 justify-end pt-3 text-xs text-white/25">
            <Link href="/politique-confidentialite" className="hover:text-white/50 transition-colors">
              Confidentialité
            </Link>
            <Link href="/mentions-legales" className="hover:text-white/50 transition-colors">
              Mentions légales
            </Link>
            <Link href="/admin" className="text-white/8 hover:text-white/20 transition-colors" aria-label="Administration">
              ·
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
