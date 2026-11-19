import { signedPhotoUrl } from "@/lib/player-photos";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** La photo de chaque fille d'une famille (celle de nos dossiers, `players.photo_url`, stockage privé) : lien signé
 *  d'une heure, seulement pour les inscriptions de cette famille (Loi 25). */
export async function getGirlPhotos(registrationIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!registrationIds.length) return out;
  const db = getSupabaseAdminClient() as any;
  const { data: regs } = await db.from("registrations").select("id, player_id").in("id", registrationIds);
  const playerIds = [...new Set(((regs ?? []) as any[]).map((r) => r.player_id).filter(Boolean))];
  if (!playerIds.length) return out;
  const { data: players } = await db.from("players").select("id, photo_url").in("id", playerIds).not("photo_url", "is", null);
  const photo = new Map(((players ?? []) as any[]).map((p) => [p.id, p.photo_url as string] as const));
  await Promise.all(
    ((regs ?? []) as any[]).map(async (r) => {
      const url = r.player_id ? photo.get(r.player_id) : null;
      const signed = url ? await signedPhotoUrl(url, 3600).catch(() => null) : null;
      if (signed) out.set(r.id, signed);
    })
  );
  return out;
}
