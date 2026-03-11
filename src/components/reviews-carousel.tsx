"use client";

import { useEffect, useRef, useState } from "react";

interface ReviewItem {
  id: string;
  parentName: string;
  role: string;
  quote: string;
  rating: number;
  detail: string;
}

interface ReviewsCarouselProps {
  reviews: ReviewItem[];
}

export function ReviewsCarousel({ reviews }: ReviewsCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (paused) {
      return;
    }

    const interval = window.setInterval(() => {
      setCurrent((prev) => (prev + 1) % reviews.length);
    }, 4600);

    return () => window.clearInterval(interval);
  }, [paused, reviews.length]);

  const goTo = (index: number) => {
    setCurrent(index);
  };

  const next = () => {
    setCurrent((prev) => (prev + 1) % reviews.length);
  };

  const prev = () => {
    setCurrent((prev) => (prev - 1 + reviews.length) % reviews.length);
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
    <div className="reviews-carousel-shell" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="reviews-carousel-viewport" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="reviews-track" style={{ transform: `translateX(-${current * 100}%)` }}>
          {reviews.map((review) => (
            <article key={review.id} className="review-slide">
              <div className="review-stars" aria-label={`${review.rating} étoiles sur 5`}>
                {Array.from({ length: 5 }).map((_, index) => (
                  <span key={`${review.id}-star-${index}`} className={index < review.rating ? "star-on" : "star-off"}>
                    ★
                  </span>
                ))}
              </div>

              <p className="review-quote">“{review.quote}”</p>

              <div className="review-meta">
                <p className="review-name">{review.parentName}</p>
                <p className="review-role">{review.role}</p>
              </div>

              <p className="review-detail">{review.detail}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="reviews-controls">
        <button type="button" onClick={prev} className="reviews-arrow" aria-label="Avis précédent">
          ←
        </button>

        <div className="reviews-dots" role="tablist" aria-label="Navigation avis clients">
          {reviews.map((review, index) => (
            <button
              key={review.id}
              type="button"
              onClick={() => goTo(index)}
              className={`reviews-dot ${index === current ? "is-active" : ""}`}
              aria-label={`Aller à l'avis ${index + 1}`}
              role="tab"
              aria-selected={index === current}
            />
          ))}
        </div>

        <button type="button" onClick={next} className="reviews-arrow" aria-label="Avis suivant">
          →
        </button>
      </div>
    </div>
  );
}
