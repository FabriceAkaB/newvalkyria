"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface FeatureItem {
  id: string;
  icon: ReactNode;
  title: string;
  desc: string;
  metric: string;
}

interface FeaturesCarouselProps {
  features: FeatureItem[];
}

export function FeaturesCarousel({ features }: FeaturesCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (paused) {
      return;
    }

    const interval = window.setInterval(() => {
      setCurrent((prev) => (prev + 1) % features.length);
    }, 4600);

    return () => window.clearInterval(interval);
  }, [paused, features.length]);

  const goTo = (index: number) => {
    setCurrent(index);
  };

  const next = () => {
    setCurrent((prev) => (prev + 1) % features.length);
  };

  const prev = () => {
    setCurrent((prev) => (prev - 1 + features.length) % features.length);
  };

  const onTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  };

  const onTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) {
      return;
    }

    const end = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = end - touchStartX.current;

    if (Math.abs(delta) > 42) {
      if (delta < 0) {
        next();
      } else {
        prev();
      }
    }

    touchStartX.current = null;
  };

  return (
    <div className="feat-carousel-shell" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="feat-carousel-viewport" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="feat-track" style={{ transform: `translateX(-${current * 100}%)` }}>
          {features.map((feature) => (
            <article key={feature.id} className="feat-slide">
              <div className="barca-feature-icon">{feature.icon}</div>
              <h3 className="barca-feature-title">{feature.title}</h3>
              <p className="barca-feature-desc">{feature.desc}</p>
              <span className="barca-feature-metric">{feature.metric}</span>
            </article>
          ))}
        </div>
      </div>

      <div className="feat-controls">
        <button type="button" onClick={prev} className="feat-arrow" aria-label="Point précédent">
          ←
        </button>

        <div className="feat-dots" role="tablist" aria-label="Navigation — ce qui nous distingue">
          {features.map((feature, index) => (
            <button
              key={feature.id}
              type="button"
              onClick={() => goTo(index)}
              className={`feat-dot ${index === current ? "is-active" : ""}`}
              aria-label={`Aller au point ${index + 1}`}
              role="tab"
              aria-selected={index === current}
            />
          ))}
        </div>

        <button type="button" onClick={next} className="feat-arrow" aria-label="Point suivant">
          →
        </button>
      </div>
    </div>
  );
}
