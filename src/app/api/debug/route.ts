import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasUrl = Boolean(env.supabaseUrl);
  const hasKey = Boolean(env.supabaseServiceRoleKey);

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
  let rowCount = 0;
  if (clientOk) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = getSupabaseAdminClient() as any;
      const { data, error } = await sb.from("leads").select("id");
      if (error) queryError = error.message;
      else { queryOk = true; rowCount = data?.length ?? 0; }
    } catch (e) {
      queryError = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json({ hasUrl, hasKey, clientOk, clientError, queryOk, queryError, rowCount });
}
