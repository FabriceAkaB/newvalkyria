import { NextResponse } from "next/server";

import { getProducts } from "@/lib/shop-repo";

export const dynamic = "force-dynamic";

export async function GET() {
  const products = await getProducts(false);
  return NextResponse.json({ products });
}
