"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { navItems } from "@/lib/site-content";

export function MainNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Lock scroll when menu open — position:fixed trick works on iOS Safari too
  useEffect(() => {
    if (open) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
    } else {
      const scrollY = parseFloat(document.body.style.top || "0") * -1;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      if (scrollY) window.scrollTo({ top: scrollY, behavior: "instant" });
    }
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
    };
  }, [open]);

  const panel = (
    <div className={`mob-panel ${open ? "mob-panel-open" : ""}`} aria-hidden={!open}>
      <nav className="mob-nav" aria-label="Menu mobile">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`mob-link ${active ? "mob-link-active" : ""}`}
            >
              {item.label}
            </Link>
          );
        })}

        <div className="mob-footer">
          <Link href="/inscription" onClick={() => setOpen(false)} className="mob-cta">
            Réserver une place →
          </Link>
        </div>
      </nav>
    </div>
  );

  return (
    <>
      {/* ── Desktop nav ── */}
      <nav className="hidden gap-6 md:flex" aria-label="Navigation principale">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm uppercase tracking-[0.16em] transition ${
                active ? "text-accent" : "text-white/80 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* ── Hamburger (mobile) ── */}
      <button
        className="mob-btn md:hidden"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        aria-expanded={open}
      >
        <span className={`mob-bar ${open ? "mob-bar-top" : ""}`} />
        <span className={`mob-bar ${open ? "mob-bar-mid" : ""}`} />
        <span className={`mob-bar ${open ? "mob-bar-bot" : ""}`} />
      </button>

      {/* ── Panel rendu directement dans body via portal ── */}
      {typeof document !== "undefined" ? createPortal(panel, document.body) : null}
    </>
  );
}
