import { NextResponse } from "next/server";

import { getTrialConfig } from "@/lib/trial-dates-store";

export async function GET() {
  return NextResponse.json(await getTrialConfig());
}
