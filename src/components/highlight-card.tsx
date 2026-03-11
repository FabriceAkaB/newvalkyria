import type { ReactNode } from "react";

interface HighlightCardProps {
  title: string;
  children: ReactNode;
}

export function HighlightCard({ title, children }: HighlightCardProps) {
  return (
    <article className="rounded-soft border border-white/15 bg-white/5 p-6 shadow-halo">
      <h3 className="font-display text-xl uppercase tracking-[0.08em] text-white">{title}</h3>
      <div className="mt-3 text-white/80">{children}</div>
    </article>
  );
}
