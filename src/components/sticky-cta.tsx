import Link from "next/link";

import { getCapacityData } from "@/lib/capacity";

export async function StickyCta() {
  const capacity = await getCapacityData();
  const { isFull, remaining } = capacity.total;

  return (
    <div className="sticky-cta md:hidden" role="complementary" aria-label="Inscription rapide">
      <div className="sticky-cta-inner">
        <p className="sticky-cta-label">
          {isFull ? (
            <span className="text-amber-300/90 font-semibold">Session complète</span>
          ) : (
            <>
              <span className="text-accent-soft font-semibold">{remaining} place{remaining > 1 ? "s" : ""} restante{remaining > 1 ? "s" : ""}</span>
              <span className="text-white/60"> · Session en cours</span>
            </>
          )}
        </p>
        <Link href="/inscription" className="sticky-cta-btn">
          {isFull ? "Liste d\u2019attente" : "Réserver →"}
        </Link>
      </div>
    </div>
  );
}
