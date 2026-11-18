import { NextResponse } from "next/server";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { getCurrentCoachId } from "@/lib/coach-auth";
import { getParentUserId } from "@/lib/parent-auth";
import { getChildrenForParent, getFamilyRegistrations } from "@/lib/parent-repo";
import { PHOTO_BUCKETS, type PhotoBucket } from "@/lib/player-photos";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Photo d'une joueuse (stockage privé, Loi 25) : l'admin et les éducateurs voient les photos ; une famille voit
 *  seulement celles de ses enfants. Redirige vers un lien signé de 60 secondes, jamais mis en cache public. */
export async function GET(_request: Request, { params }: { params: Promise<{ bucket: string; path: string[] }> }) {
  const { bucket, path: parts } = await params;
  const path = parts.map(decodeURIComponent).join("/");
  if (!PHOTO_BUCKETS.includes(bucket as PhotoBucket) || !path || path.includes("..")) return new NextResponse("Introuvable", { status: 404 });

  let allowed = Boolean((await getCurrentAdminRole()) || (await getCurrentCoachId()));
  if (!allowed) {
    const userId = await getParentUserId();
    if (userId) {
      if (bucket === "child-photos") allowed = path.startsWith(`${userId}/`);
      else {
        // Fichier « <id de la joueuse>-<horodatage>.<ext> » : la joueuse doit être une enfant de cette famille.
        const [family, children] = await Promise.all([getFamilyRegistrations(userId), getChildrenForParent(userId)]);
        const ids = new Set([...family.map((f) => f.playerId), ...children.map((c) => c.player_id)].filter(Boolean) as string[]);
        allowed = [...ids].some((id) => path.startsWith(`${id}-`) || path.startsWith(`${id}/`) || path.startsWith(`${id}.`));
      }
    }
  }
  if (!allowed) return new NextResponse("Non autorisé", { status: 403 });

  const { data } = await (getSupabaseAdminClient() as any).storage.from(bucket).createSignedUrl(path, 60);
  if (!data?.signedUrl) return new NextResponse("Introuvable", { status: 404 });
  return NextResponse.redirect(data.signedUrl, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
