import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasUrl = Boolean(env.supabaseUrl);
  const hasKey = Boolean(env.supabaseServiceRoleKey);
  const urlPreview = env.supabaseUrl
    ? env.supabaseUrl.slice(0, 30) + "..."
    : "(missing)";

  let clientOk = false;
  let clientError = "";
  try {
    getSupabaseAdminClient();
    clientOk = true;
  } catch (e) {
    clientError = e instanceof Error ? e.message : String(e);
  }

  let queryOk = false;
  let queryError = "";
  if (clientOk) {
    try {
      const supabase = getSupabaseAdminClient() as any;
      const { error } = await supabase.from("leads").select("id").limit(1);
      if (error) queryError = error.message;
      else queryOk = true;
    } catch (e) {
      queryError = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json({
    hasUrl,
    hasKey,
    urlPreview,
    clientOk,
    clientError,
    queryOk,
    queryError,
  });
}
