import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

let cached: ReturnType<typeof createClient> | null = null;

function isLikelyUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

export function getSupabaseAdminClient() {
  if (cached) {
    return cached;
  }

  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error("Supabase env vars are missing");
  }

  if (!isLikelyUrl(env.supabaseUrl)) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL invalide: attendu une URL https://...supabase.co (pas une clé JWT)"
    );
  }

  cached = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  return cached;
}
