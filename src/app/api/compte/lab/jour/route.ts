import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { getParentUserId } from "@/lib/parent-auth";
import { getVerifiedParentEmail } from "@/lib/parent-repo";
import { getAccessByEmail, setPracticeDay, todayIso } from "@/lib/valkyria-lab";

/** Espace famille : « routine faite aujourd'hui » pour une joueuse de la famille (Valkyria Lab). */
export async function POST(request: Request) {
  const userId = await getParentUserId();
  if (!userId) return jsonError("Connectez-vous d'abord.", 401);
  const email = await getVerifiedParentEmail(userId);
  if (!email) return jsonError("Confirmez d'abord votre courriel.", 403);
  const b = (await request.json().catch(() => null)) as { player?: string; on?: boolean } | null;
  if (typeof b?.player !== "string" || typeof b.on !== "boolean") return jsonError("Paramètres invalides", 400);
  const access = await getAccessByEmail(email);
  if (!access) return jsonError("Le Lab de votre famille n'est pas encore ouvert.", 404);
  const problem = await setPracticeDay(access, b.player, todayIso(), b.on);
  if (problem) return jsonError(problem, 422);
  return NextResponse.json({ ok: true });
}
