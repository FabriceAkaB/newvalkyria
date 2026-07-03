import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    hasUrl: Boolean(env.supabaseUrl),
    hasKey: Boolean(env.supabaseServiceRoleKey),
    urlStart: env.supabaseUrl?.slice(0, 20) ?? "missing",
  });
}
