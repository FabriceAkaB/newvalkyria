import { after, NextResponse } from "next/server";

import { notifyActivityCoaches } from "@/lib/coach-report-notice";
import { setPlayerAttendance, setPlayerFeedback } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";
import { parseSurveyAnswer } from "@/lib/practice-survey";
import { getSurveyData } from "@/lib/practice-survey-repo";
import { checkKioskKey } from "@/lib/survey-kiosk";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { parseThemeAnswer } from "@/lib/theme-quiz-core";
import { getThemeQuiz, saveThemeAnswer } from "@/lib/theme-quiz-repo";

export const dynamic = "force-dynamic";

/** Réponse d'une joueuse sur la borne : plaisir, fatigue, l'aide de sa coach et des autres. Elle est aussi marquée présente. */
export async function POST(request: Request, { params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !checkKioskKey(activityId, body.cle)) return jsonError("Lien invalide", 403);
  const registrationId = typeof body.registrationId === "string" ? body.registrationId : null;
  if (!registrationId) return jsonError("Joueuse manquante", 400);
  // « Absente » touché sur la borne (ou remise après une erreur) : seulement la présence, aucune réponse.
  if (body.presence === "absent" || body.presence === "present") {
    const roster = await getSurveyData(activityId);
    if (!roster) return jsonError("Pratique introuvable", 404);
    if (!roster.roster.some((p) => p.registrationId === registrationId)) return jsonError("Cette joueuse n'est pas attendue à cette pratique.", 403);
    await setPlayerAttendance(activityId, registrationId, body.presence, "borne");
    return NextResponse.json({ ok: true });
  }
  const answer = parseSurveyAnswer({ ...body, wantsMore: [] });
  if (typeof answer === "string") return jsonError(answer, 400);
  const data = await getSurveyData(activityId);
  if (!data) return jsonError("Pratique introuvable", 404);
  if (!data.roster.some((p) => p.registrationId === registrationId)) return jsonError("Cette joueuse n'est pas attendue à cette pratique.", 403);
  // Seulement des coachs de cette pratique et des filles attendues (jamais elle-même) : le reste est ignoré sans
  // refuser la réponse (elle a pu partir de la file hors ligne).
  if (answer.coachHelpers) answer.coachHelpers = answer.coachHelpers.filter((id) => data.coaches.some((c) => c.id === id));
  if (answer.peerHelpers) answer.peerHelpers = answer.peerHelpers.filter((id) => id !== registrationId && data.roster.some((p) => p.registrationId === id));
  // Ne pas effacer ce que l'éducateur avait noté (« plus de… ») : on garde ses choix.
  const prev = data.attendance.find((a) => a.registration_id === registrationId);
  await setPlayerFeedback(activityId, registrationId, { ...answer, wantsMore: prev?.wants_more ?? [], wantsMoreNote: prev?.wants_more_note ?? null });
  // « Qu'est-ce qu'on a travaillé aujourd'hui ? » : le bon thème est recalculé ici (jamais celui envoyé par l'iPad).
  if (typeof body.themeAnswer === "string") {
    const quiz = await getThemeQuiz(activityId).catch(() => null);
    const choice = parseThemeAnswer(body.themeAnswer, quiz);
    if (quiz && choice) await saveThemeAnswer(activityId, registrationId, choice, quiz);
  }
  // Rapports du jour tous finis : courriel automatique à l'éducateur (une fois par jour).
  after(() => notifyActivityCoaches(activityId).catch(() => null));
  // Elle a répondu à la borne : présente (MonClubSportif fait foi quand il a une réponse, à sa prochaine lecture).
  if (prev && !["present", "late", "left_early"].includes(prev.status)) {
    await (getSupabaseAdminClient() as any).from("activity_player_attendance").update({ status: "present", status_source: "borne" }).eq("activity_id", activityId).eq("registration_id", registrationId);
  } else if (!prev) {
    await (getSupabaseAdminClient() as any).from("activity_player_attendance").update({ status_source: "borne" }).eq("activity_id", activityId).eq("registration_id", registrationId).is("status_source", null);
  }
  return NextResponse.json({ ok: true });
}
