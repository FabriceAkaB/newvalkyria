import Link from "next/link";

import { Container } from "@/components/container";
import { navItems } from "@/lib/site-content";

export function SiteFooter() {
  return (
    <footer className="mt-20 bg-[#06040c] pt-16 pb-10 text-sm">
      <Container>
        <div className="footer-grid">
          {/* Brand */}
          <div>
            <p className="font-display text-xl uppercase tracking-[0.18em] text-white">New Valkyria</p>
            <p className="mt-2 text-xs text-white/45 leading-relaxed">
              Académie technique féminine<br />Laurentides, Québec
            </p>
            <div className="mt-5 space-y-1 text-xs text-white/30">
              <a href="mailto:info@newvalkyria.com" className="block hover:text-white/55 transition-colors">
                info@newvalkyria.com
              </a>
              <p>Lundi · Mercredi · Vendredi</p>
            </div>
            {/* Social icons */}
            <div className="mt-6 flex items-center gap-4">
              <a href="https://www.instagram.com/newvalkyria_ac" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-white/70 transition-colors hover:text-white">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
              </a>
              <a href="https://facebook.com/newvalkyria" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="text-white/70 transition-colors hover:text-white">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                </svg>
              </a>
              <a href="https://tiktok.com/@newvalkyria" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="text-white/70 transition-colors hover:text-white">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <p className="footer-col-heading">Navigation</p>
            <ul className="footer-link-list">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="footer-link">{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Villes */}
          <div>
            <p className="footer-col-heading">Emplacements</p>
            <ul className="footer-link-list text-white/40">
              <li>Rosemère</li>
              <li>Mirabel</li>
              <li>Saint-Thérèse</li>
            </ul>
          </div>

          {/* CTA card */}
          <div>
            <div className="footer-cta-card">
              <p className="text-[10px] uppercase tracking-[0.2em] text-accent-soft">Places limitées</p>
              <p className="mt-2 font-display text-2xl uppercase tracking-[0.05em] text-white leading-tight">
                Inscriptions<br />ouvertes
              </p>
              <Link
                href="/inscription"
                className="mt-5 inline-flex items-center rounded-lg bg-accent px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-ink transition hover:bg-accent-soft"
              >
                Réserver une place
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="footer-bottom">
          <p className="text-white/60 text-xs">
            © {new Date().getFullYear()} New Valkyria. Tous droits réservés.
            &nbsp;·&nbsp;
            Photos par{" "}
            <a
              href="https://anoble.pro"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors underline underline-offset-2"
            >
              Fabrice Aka
            </a>
          </p>
          <div className="flex gap-4 text-xs text-white/60">
            <Link href="/politique-confidentialite" className="hover:text-white transition-colors">
              Confidentialité
            </Link>
            <Link href="/mentions-legales" className="hover:text-white transition-colors">
              Mentions légales
            </Link>
            <Link href="/admin" className="opacity-40 hover:opacity-70 transition-opacity" aria-label="Administration">
              ·
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
