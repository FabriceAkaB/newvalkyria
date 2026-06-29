"use client";

import { useState } from "react";
import type { FAQItem } from "@/types/contracts";

export function FaqAccordion({ items }: { items: FAQItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="faq-list nv-faq-list">
      {items.map((faq) => {
        const isOpen = openId === faq.id;
        return (
          <div key={faq.id} className={`faq-row${isOpen ? " faq-row-open" : ""}`}>
            <button
              className="faq-row-summary"
              onClick={() => setOpenId(isOpen ? null : faq.id)}
              aria-expanded={isOpen}
            >
              <span className={`faq-row-question${isOpen ? " faq-row-question-open" : ""}`}>
                {faq.question}
              </span>
              <span className={`faq-row-chevron${isOpen ? " faq-row-chevron-open" : ""}`} aria-hidden>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            </button>
            <div className={`faq-answer-wrap${isOpen ? " faq-answer-wrap-open" : ""}`}>
              <div className="faq-answer-inner">
                <p className="faq-row-answer">{faq.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
