import { NextResponse } from "next/server";

import { SEASON_DB_ID } from "@/lib/season-2027-db-map";
import { countPaidRegistrations } from "@/lib/season-admin-repo";
import { getSignupBonusProduct } from "@/lib/shop-repo";

export const dynamic = "force-dynamic";

const FREE_THRESHOLD = 30;

/** Offre de lancement : sac New Valkyria gratuit pour les 30 premiers clients
 *  payants de la saison, proposé en option payante ensuite. */
export async function GET() {
  const product = await getSignupBonusProduct();
  if (!product) return NextResponse.json({ active: false });

  const paidCount = await countPaidRegistrations(SEASON_DB_ID);
  const free = paidCount < FREE_THRESHOLD;
  const inStock = product.inventory_count > 0;

  return NextResponse.json({
    active: inStock,
    productId: product.id,
    productName: product.name,
    priceCents: product.price_cents,
    free,
    remainingFree: Math.max(0, FREE_THRESHOLD - paidCount)
  });
}
