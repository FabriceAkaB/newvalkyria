import { unstable_cache } from "next/cache";

import type { AgeCategory } from "@/lib/categories";
import { AGE_CATEGORIES } from "@/lib/categories";
import { env } from "@/lib/env";

const MAX_PER_CAT = parseInt(process.env.ENROLLMENT_CAP ?? "10", 10);

// ── Helpers ───────────────────────────────────────────────────

function makeSlot(taken: number) {
  const clamped = Math.min(taken, MAX_PER_CAT);
  const remaining = MAX_PER_CAT - clamped;
  return {
    taken: clamped,
    remaining,
    isFull: remaining === 0,
    percentage: Math.round((clamped / MAX_PER_CAT) * 100)
  };
}

type CategorySlot = ReturnType<typeof makeSlot>;

// ── Fetch per-category counts ─────────────────────────────────

async function fetchCountsByCategory(): Promise<Record<AgeCategory, number>> {
  const zero = Object.fromEntries(AGE_CATEGORIES.map((c) => [c, 0])) as Record<AgeCategory, number>;

  // ── 1. Supabase ────────────────────────────────────────────────
  if (env.supabaseUrl && env.supabaseServiceRoleKey) {
    try {
      const { countPaidLeadsByCategory } = await import("@/lib/repositories");
      return await countPaidLeadsByCategory();
    } catch {
      // fall through
    }
  }

  // ── 2. Stripe fallback ─────────────────────────────────────────
  if (env.stripeSecretKey) {
    try {
      const { getStripeClient } = await import("@/lib/stripe");
      const stripe = getStripeClient();
      const counts = { ...zero };

      let hasMore = true;
      let startingAfter: string | undefined;

      while (hasMore) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const page = await stripe.checkout.sessions.list({
          status: "complete",
          limit: 100,
          ...(startingAfter ? { starting_after: startingAfter } : {})
        } as any);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const s of page.data as any[]) {
          const cat = s.metadata?.category as AgeCategory | undefined;
          if (cat && cat in counts) counts[cat]++;
        }

        hasMore = page.has_more;
        if (hasMore && page.data.length > 0) {
          startingAfter = page.data[page.data.length - 1].id;
        }
      }

      return counts;
    } catch {
      // fall through
    }
  }

  return zero;
}

// ── Public types ──────────────────────────────────────────────

export type CategoryCapacity = CategorySlot;

export type CapacityData = {
  /** Capacité max par catégorie */
  maxPerCategory: number;
  /** Détail par tranche d'âge */
  byCategory: Record<AgeCategory, CategoryCapacity>;
  /** Agrégé total (pour le ruban promo / pricing card) */
  total: { taken: number; remaining: number; isFull: boolean; percentage: number };
};

// ── Compute (sans cache) — pour l'API polling ─────────────────

export async function computeCapacityData(): Promise<CapacityData> {
  const counts = await fetchCountsByCategory();

  const byCategory = Object.fromEntries(
    AGE_CATEGORIES.map((cat) => [cat, makeSlot(counts[cat])])
  ) as Record<AgeCategory, CategoryCapacity>;

  const totalTaken = AGE_CATEGORIES.reduce((s, c) => s + byCategory[c].taken, 0);
  const totalMax = MAX_PER_CAT * AGE_CATEGORIES.length;
  const totalRemaining = Math.max(0, totalMax - totalTaken);

  return {
    maxPerCategory: MAX_PER_CAT,
    byCategory,
    total: {
      taken: totalTaken,
      remaining: totalRemaining,
      isFull: totalRemaining === 0,
      percentage: Math.round((totalTaken / totalMax) * 100)
    }
  };
}

// ── Cached fetch ──────────────────────────────────────────────

export const getCapacityData = unstable_cache(
  async (): Promise<CapacityData> => {
    const counts = await fetchCountsByCategory();

    const byCategory = Object.fromEntries(
      AGE_CATEGORIES.map((cat) => [cat, makeSlot(counts[cat])])
    ) as Record<AgeCategory, CategoryCapacity>;

    const totalTaken = AGE_CATEGORIES.reduce((s, c) => s + byCategory[c].taken, 0);
    const totalMax = MAX_PER_CAT * AGE_CATEGORIES.length;
    const totalRemaining = Math.max(0, totalMax - totalTaken);

    return {
      maxPerCategory: MAX_PER_CAT,
      byCategory,
      total: {
        taken: totalTaken,
        remaining: totalRemaining,
        isFull: totalRemaining === 0,
        percentage: Math.round((totalTaken / totalMax) * 100)
      }
    };
  },
  ["enrollment-capacity"],
  { revalidate: 300 }
);
