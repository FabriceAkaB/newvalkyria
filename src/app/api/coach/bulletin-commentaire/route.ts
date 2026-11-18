import { NextResponse } from "next/server";

import { saveFamilyComment } from "@/lib/bulletin-repo";
import { getCurrentCoachId } from "@/lib/coach-auth";
import { coachCanSeePlayer } from "@/lib/coach-portal-repo";
import { getCoach } from "@/lib/coaches-repo";
import { jsonError } from "@/lib/http";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Le mot d'un éducateur pour la famille, sur le bulletin d'une joueuse qu'il suit. */
export async function POST(request: Request) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const b = (await request.json().catch(() => null)) as { registrationId?: string; period?: string; text?: string } | null;
  if (!b?.registrationId || (b.period !== "mi-saison" && b.period !== "fin-saison") || typeof b.text !== "string") return jsonError("Paramètres invalides", 400);
  if (!(await coachCanSeePlayer(coachId, b.registrationId))) return jsonError("Cette joueuse n'est pas dans tes groupes.", 403);
  const [coach, { data: reg }] = await Promise.all([
    getCoach(coachId),
    (getSupabaseAdminClient() as any).from("registrations").select("player_first_name").eq("id", b.registrationId).maybeSingle()
  ]);
  const author = coach ? `${coach.first_name} ${String(coach.last_name ?? "").charAt(0)}.`.trim() : "L'éducatrice";
  const problem = await saveFamilyComment({ registrationId: b.registrationId, period: b.period, coachId, author, text: b.text, firstName: String(reg?.player_first_name ?? "la joueuse").trim() });
  if (problem) return jsonError(problem, 422);
  return NextResponse.json({ ok: true });
}
