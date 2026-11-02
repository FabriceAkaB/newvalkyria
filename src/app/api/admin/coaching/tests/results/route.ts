import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { parseScore, TEST_CONTEXTS, type TestContext } from "@/lib/skill-tests";
import { deleteResult, saveResults, type ResultInput } from "@/lib/skill-tests-repo";

/** Feuille de suivi des tests : saisie en lot (un groupe, un test, une date) au bord du terrain. */
export async function POST(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as { testId?: string; testedOn?: string; context?: string; entries?: { registrationId?: string; score?: unknown; videoUrl?: string | null; note?: string | null }[] } | null;
  if (!body?.testId || !body.testedOn || !/^\d{4}-\d{2}-\d{2}$/.test(body.testedOn) || !TEST_CONTEXTS.includes(body.context as TestContext) || !Array.isArray(body.entries)) {
    return jsonError("Choisis le test, la date et le type de test.", 400);
  }
  const entries: ResultInput[] = [];
  for (const e of body.entries) {
    const score = parseScore(e.score);
    if (score === null || !e.registrationId) continue;
    if (Number.isNaN(score)) return jsonError(`Score illisible : « ${String(e.score)} ». Écris seulement un nombre (ex. 42 ou 12,5).`, 422);
    const video = e.videoUrl?.trim() || null;
    if (video && !/^https?:\/\//.test(video)) return jsonError("Le lien de la vidéo doit commencer par https:// (YouTube non répertorié ou dossier privé).", 422);
    entries.push({ registrationId: e.registrationId, testId: body.testId, testedOn: body.testedOn, context: body.context as TestContext, score, videoUrl: video, note: e.note ?? null });
  }
  if (!entries.length) return jsonError("Aucun score à enregistrer.", 400);
  const saved = await saveResults(entries);
  return NextResponse.json({ ok: true, saved });
}

export async function DELETE(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return jsonError("Paramètres invalides", 400);
  await deleteResult(id);
  return NextResponse.json({ ok: true });
}
