import { NextResponse } from "next/server";

import { computeCapacityData } from "@/lib/capacity";

export const dynamic = "force-dynamic"; // jamais mis en cache par Next.js

export async function GET() {
  const data = await computeCapacityData();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store, max-age=0" }
  });
}
