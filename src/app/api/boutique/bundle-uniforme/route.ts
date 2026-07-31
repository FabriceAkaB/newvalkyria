import { NextResponse } from "next/server";

import { getUniformBundleProducts } from "@/lib/shop-repo";

export const dynamic = "force-dynamic";

/** Offre "2e uniforme" — chandail + short au prix régulier, bas offerts. */
export async function GET() {
  const { jersey, short, socks } = await getUniformBundleProducts();

  if (!jersey || !short || !socks) {
    return NextResponse.json({ active: false });
  }

  return NextResponse.json({
    active: true,
    jersey: { id: jersey.id, name: jersey.name, priceCents: jersey.price_cents, variants: jersey.variants.filter((v) => v.active) },
    short: { id: short.id, name: short.name, priceCents: short.price_cents, variants: short.variants.filter((v) => v.active) },
    socks: { id: socks.id, name: socks.name, priceCents: socks.price_cents, inventoryCount: socks.inventory_count }
  });
}
