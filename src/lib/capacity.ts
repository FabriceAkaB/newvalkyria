import { unstable_cache } from "next/cache";

import type { AgeCategory } from "@/lib/categories";
import { AGE_CATEGORIES } from "@/lib/categories";
import { env } from "@/lib/env";

const MAX_PER_CAT = parseInt(process.env.ENROLLMENT_CAP ?? "10", 10);

// ── Helpers ───────────────────────────────────────────────────

function makeSlot(taken: number, max: number) {
  const clamped = Math.min(taken, max);
  const remaining = max - clamped;
  return {
    taken: clamped,
    remaining,
    max,
    isFull: remaining === 0,
    percentage: Math.round((clamped / max) * 100)
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

/** Récupère les overrides de capacité par catégorie depuis Supabase (silencieux si indisponible). */
async function fetchCapacityConfig(): Promise<Record<string, number>> {
  try {
    const { getCapacityConfig } = await import("@/lib/repositories");
    return await getCapacityConfig();
  } catch {
    return {};
  }
}

// ── Public types ──────────────────────────────────────────────

export type CategoryCapacity = CategorySlot;

export type CapacityData = {
  /** Capacité max par défaut (global) */
  maxPerCategory: number;
  /** Détail par tranche d'âge */
  byCategory: Record<AgeCategory, CategoryCapacity>;
  /** Agrégé total (pour le ruban promo / pricing card) */
  total: { taken: number; remaining: number; isFull: boolean; percentage: number };
};

// ── Shared compute logic ───────────────────────────────────────

function buildCapacityData(
  counts: Record<AgeCategory, number>,
  config: Record<string, number>
): CapacityData {
  const byCategory = Object.fromEntries(
    AGE_CATEGORIES.map((cat) => {
      const max = config[cat] ?? MAX_PER_CAT;
      return [cat, makeSlot(counts[cat], max)];
    })
  ) as Record<AgeCategory, CategoryCapacity>;

  const totalTaken     = AGE_CATEGORIES.reduce((s, c) => s + byCategory[c].taken, 0);
  const totalMax       = AGE_CATEGORIES.reduce((s, c) => s + byCategory[c].max, 0);
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

// ── Compute (sans cache) — pour l'API polling et l'admin ──────

export async function computeCapacityData(): Promise<CapacityData> {
  const [counts, config] = await Promise.all([
    fetchCountsByCategory(),
    fetchCapacityConfig()
  ]);
  return buildCapacityData(counts, config);
}

// ── Cached fetch ──────────────────────────────────────────────

export const getCapacityData = unstable_cache(
  async (): Promise<CapacityData> => {
    const [counts, config] = await Promise.all([
      fetchCountsByCategory(),
      fetchCapacityConfig()
    ]);
    return buildCapacityData(counts, config);
  },
  ["enrollment-capacity"],
  { revalidate: 300 }
);
