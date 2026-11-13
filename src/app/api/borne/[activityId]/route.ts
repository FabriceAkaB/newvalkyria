import { NextResponse } from "next/server";

import { setPlayerFeedback } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";
import { parseSurveyAnswer } from "@/lib/practice-survey";
import { getSurveyData } from "@/lib/practice-survey-repo";
import { checkKioskKey } from "@/lib/survey-kiosk";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/** Réponse d'une joueuse sur la borne : ses 5 notes sur 10. Elle est aussi marquée présente. */
export async function POST(request: Request, { params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !checkKioskKey(activityId, body.cle)) return jsonError("Lien invalide", 403);
  const registrationId = typeof body.registrationId === "string" ? body.registrationId : null;
  if (!registrationId) return jsonError("Joueuse manquante", 400);
  const answer = parseSurveyAnswer({ ...body, wantsMore: [] });
  if (typeof answer === "string") return jsonError(answer, 400);
  const data = await getSurveyData(activityId);
  if (!data) return jsonError("Pratique introuvable", 404);
  if (!data.roster.some((p) => p.registrationId === registrationId)) return jsonError("Cette joueuse n'est pas attendue à cette pratique.", 403);
  // Ne pas effacer ce que l'éducateur avait noté (« plus de… ») : on garde ses choix.
  const prev = data.attendance.find((a) => a.registration_id === registrationId);
  await setPlayerFeedback(activityId, registrationId, { ...answer, wantsMore: prev?.wants_more ?? [], wantsMoreNote: prev?.wants_more_note ?? null });
  if (prev && !["present", "late", "left_early"].includes(prev.status)) {
    await (getSupabaseAdminClient() as any).from("activity_player_attendance").update({ status: "present" }).eq("activity_id", activityId).eq("registration_id", registrationId);
  }
  return NextResponse.json({ ok: true });
}
