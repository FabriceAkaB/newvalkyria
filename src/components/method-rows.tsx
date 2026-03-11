"use client";

import { useEffect, useRef } from "react";

interface MethodItem {
  title: string;
  metric: string;
  text: string;
}

const STAGGER_MS  = 80;   // délai entre chaque rangée à l'entrée
const IN_MS       = 560;  // durée animation ENTRÉE
const OUT_MS      = 240;  // durée animation SORTIE (plus rapide pour être visible)
const X_OFFSET    = 52;   // pixels de translation horizontale

// Transitions séparées pour entrée vs sortie
const TRANSITION_IN  = `opacity ${IN_MS}ms cubic-bezier(0.16, 1, 0.3, 1), transform ${IN_MS}ms cubic-bezier(0.16, 1, 0.3, 1), background-color 200ms ease, padding-left 200ms ease`;
const TRANSITION_OUT = `opacity ${OUT_MS}ms ease, transform ${OUT_MS}ms ease, background-color 200ms ease, padding-left 200ms ease`;

export function MethodRows({ items }: { items: MethodItem[] }) {
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timers  = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const els = rowRefs.current.filter(Boolean) as HTMLDivElement[];
    const timerStore = timers.current;

    // Suivre la direction du scroll en temps réel
    let scrollDir: "down" | "up" = "down";
    let lastScrollY = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      if (y !== lastScrollY) {
        scrollDir = y > lastScrollY ? "down" : "up";
        lastScrollY = y;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // État initial : caché, décalé à droite
    els.forEach((el) => {
      el.style.opacity   = "0";
      el.style.transform = `translateX(${X_OFFSET}px)`;
      el.style.transition = "none";
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el  = entry.target as HTMLElement;
          const idx = els.indexOf(el as HTMLDivElement);
          clearTimeout(timerStore[idx]);

          if (entry.isIntersecting) {
            // ── ENTRÉE ──────────────────────────────────────────────
            const fromX = scrollDir === "down" ? X_OFFSET : -X_OFFSET;
            const delay = idx * STAGGER_MS;

            // 1. Snap vers la position de départ (sans animation)
            el.style.transition = "none";
            el.style.opacity    = "0";
            el.style.transform  = `translateX(${fromX}px)`;

            // 2. Forcer le reflow — le navigateur enregistre l'état initial
            void el.getBoundingClientRect();

            // 3. Appliquer la transition d'ENTRÉE et animer vers visible
            el.style.transition      = TRANSITION_IN;
            el.style.transitionDelay = `${delay}ms`;
            el.style.opacity         = "1";
            el.style.transform       = "translateX(0)";

            // 4. Réinitialiser le délai quand l'animation est terminée
            timerStore[idx] = setTimeout(() => {
              el.style.transitionDelay = "0ms";
            }, delay + IN_MS + 20);

          } else {
            // ── SORTIE ──────────────────────────────────────────────
            // Glisse vers le côté OPPOSÉ à la direction du scroll
            // → scroll↓ : sort à GAUCHE   → scroll↑ : sort à DROITE
            const toX = scrollDir === "down" ? -X_OFFSET : X_OFFSET;

            el.style.transition      = TRANSITION_OUT; // rapide (240ms)
            el.style.transitionDelay = "0ms";
            el.style.opacity         = "0";
            el.style.transform       = `translateX(${toX}px)`;
          }
        });
      },
      {
        threshold: 0.12,
        // -10px haut + -60px bas : le exit via le bas fire
        // pendant que 60px de l'élément sont encore visibles
        rootMargin: "-10px 0px -60px 0px",
      }
    );

    els.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      timerStore.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="method-rows">
      {items.map((item, i) => (
        <div
          key={item.title}
          ref={(el) => { rowRefs.current[i] = el; }}
          className="method-row group"
        >
          <span className="method-row-num" aria-hidden>
            0{i + 1}
          </span>
          <div className="method-row-body">
            <div className="method-row-top">
              <h3 className="font-display text-2xl uppercase tracking-[0.06em] text-white md:text-3xl">
                {item.title}
              </h3>
              <span className="method-row-tag">{item.metric}</span>
            </div>
            <p className="mt-2 max-w-lg text-sm text-white/70">{item.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
