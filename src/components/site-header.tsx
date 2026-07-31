"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { MainNav } from "@/components/main-nav";
import logo from "@/content/image/logo/LogoNewValkeryaBlackwhite.png";

type Phase = "top" | "hidden" | "sticky";

export function SiteHeader() {
  const [phase, setPhase] = useState<Phase>("top");

  useEffect(() => {
    const NAV_H = 68;

    function update() {
      const y = window.scrollY;
      // Use 85% of viewport height as the "past the hero" threshold
      const heroThreshold = window.innerHeight * 0.85;
      if (y < NAV_H) {
        setPhase("top");
      } else if (y < heroThreshold) {
        setPhase("hidden");
      } else {
        setPhase("sticky");
      }
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  const isTop = phase === "top";

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        transition: "transform 0.3s ease, background 0.3s ease, border-color 0.3s ease",
        transform: phase === "hidden" ? "translateY(-100%)" : "translateY(0)",
        background: isTop ? "transparent" : "rgba(9,7,14,0.95)",
        backdropFilter: isTop ? "none" : "blur(12px)",
        borderBottom: isTop ? "none" : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: isTop ? "none" : "80rem",
          margin: "0 auto",
          paddingLeft: isTop ? "2rem" : "2.5rem",
          paddingRight: isTop ? "2rem" : "2.5rem",
          transition: "max-width 0.3s ease, padding 0.3s ease",
        }}
      >
        <div className="flex h-[68px] items-center justify-between">
          <Link
            href="/"
            className="order-1 flex shrink-0 items-center gap-2 md:gap-3 whitespace-nowrap font-display text-sm md:text-base font-bold uppercase tracking-[0.12em] md:tracking-[0.2em] text-white"
          >
            <Image src={logo} alt="" width={28} height={28} className="logo-img shrink-0" aria-hidden />
            New Valkyria
          </Link>
          <MainNav />
          <Link
            href="/inscription"
            className="order-2 md:order-3 inline-flex shrink-0 items-center whitespace-nowrap rounded-full md:rounded-lg bg-accent px-3.5 py-2 md:px-5 md:py-2.5 text-[10px] md:text-xs font-bold uppercase tracking-[0.06em] md:tracking-[0.14em] text-ink transition hover:bg-accent-soft"
          >
            <span className="md:hidden">Réserver</span>
            <span className="hidden md:inline">Réserver une place</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
