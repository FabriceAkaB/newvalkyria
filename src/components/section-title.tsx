import type { ReactNode } from "react";

interface SectionTitleProps {
  kicker?: string;
  title: string;
  description?: string;
  rightSlot?: ReactNode;
}

export function SectionTitle({ kicker, title, description, rightSlot }: SectionTitleProps) {
  return (
    <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        {kicker ? <p className="mb-3 text-xs uppercase tracking-[0.2em] text-accent">{kicker}</p> : null}
        <h2 className="font-display text-3xl uppercase tracking-[0.06em] text-white md:text-4xl">{title}</h2>
        {description ? <p className="mt-3 text-white/75">{description}</p> : null}
      </div>
      {rightSlot}
    </div>
  );
}
