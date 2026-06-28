"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

interface ParallaxMediaProps {
  src: string;
  alt: string;
  badge: string;
  caption: string;
}

export function ParallaxMedia({ src, alt, badge, caption }: ParallaxMediaProps) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let raf = 0;

    const onScroll = () => {
      if (raf) {
        return;
      }

      raf = window.requestAnimationFrame(() => {
        setOffset(window.scrollY * 0.12);
        raf = 0;
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) {
        window.cancelAnimationFrame(raf);
      }
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-[1.8rem] bg-surface shadow-halo">
      <div className="parallax-frame">
        <Image
          src={src}
          alt={alt}
          width={920}
          height={980}
          className="h-[450px] w-full object-cover object-center md:h-[560px]"
          style={{ transform: `translateY(${Math.min(44, offset)}px) scale(1.08)` }}
          priority
        />
      </div>


      <div className="absolute left-5 top-5 rounded-full bg-ink px-4 py-1 text-[11px] uppercase tracking-[0.18em] text-accent-soft">
        {badge}
      </div>

      <div className="absolute bottom-5 left-5 right-5 rounded-xl bg-surface p-4 text-sm text-white/85">
        {caption}
      </div>
    </div>
  );
}
