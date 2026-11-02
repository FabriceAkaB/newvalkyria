import { CLUB_ID } from "@/lib/club";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Statistiques des réseaux sociaux et de la publicité (pilier 3). Saisie manuelle pour l'instant ;
 *  plus tard, l'agent statistiques (A06) les remplira à partir des comptes Meta, YouTube et Google. */

function db() {
  return getSupabaseAdminClient() as any;
}

export type Channel = "instagram" | "facebook" | "youtube" | "tiktok" | "pub_meta" | "pub_google" | "autre";

export const CHANNELS: { id: Channel; label: string; ads: boolean }[] = [
  { id: "instagram", label: "Instagram", ads: false },
  { id: "facebook", label: "Facebook", ads: false },
  { id: "youtube", label: "YouTube", ads: false },
  { id: "tiktok", label: "TikTok", ads: false },
  { id: "pub_meta", label: "Publicité Meta (Facebook, Instagram)", ads: true },
  { id: "pub_google", label: "Publicité Google", ads: true }
];

export interface ChannelStat {
  id: number;
  channel: Channel;
  measured_at: string;
  followers: number | null;
  posts: number | null;
  views: number | null;
  spend_cents: number | null;
  leads: number | null;
  note: string | null;
}

export async function getChannelStats(): Promise<ChannelStat[]> {
  const { data, error } = await db().from("marketing_channel_stats").select("*").eq("club_id", CLUB_ID).order("measured_at", { ascending: false }).order("id", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addChannelStat(input: { channel: Channel; measuredAt?: string; followers?: number | null; posts?: number | null; views?: number | null; spendCents?: number | null; leads?: number | null; note?: string | null }) {
  const { error } = await db()
    .from("marketing_channel_stats")
    .insert({
      club_id: CLUB_ID,
      channel: input.channel,
      measured_at: input.measuredAt ?? new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" }),
      followers: input.followers ?? null,
      posts: input.posts ?? null,
      views: input.views ?? null,
      spend_cents: input.spendCents ?? null,
      leads: input.leads ?? null,
      note: input.note ?? null
    });
  if (error) throw error;
}
