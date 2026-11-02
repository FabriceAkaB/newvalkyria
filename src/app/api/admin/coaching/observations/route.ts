import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { parseObservationScores } from "@/lib/coach-observations";
import { saveObservation, setObservationShared } from "@/lib/coach-observations-repo";
import { jsonError } from "@/lib/http";

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 3000) : null);

/** Observation filmée d'un coach par JP (P1.4.03) : grille sur 10 et retour publié dans son portail. Admin seulement. */
export async function POST(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b || typeof b.coachId !== "string" || typeof b.observedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.observedOn)) return jsonError("Choisis le coach et la date.", 400);
  const grid = parseObservationScores(b.scores);
  if (!grid) return jsonError("Note chacun des 5 critères (0, 1 ou 2).", 422);
  const video = text(b.videoUrl);
  if (video && !/^https?:\/\//.test(video)) return jsonError("Le lien de la vidéo doit commencer par https://.", 422);
  const id = await saveObservation(
    {
      coachId: b.coachId,
      activityId: typeof b.activityId === "string" && b.activityId ? b.activityId : null,
      observedOn: b.observedOn,
      videoUrl: video,
      scores: grid.scores,
      total: grid.total,
      strengths: text(b.strengths),
      toImprove: text(b.toImprove),
      nextFocus: text(b.nextFocus),
      share: b.share === true
    },
    typeof b.id === "string" ? b.id : undefined
  );
  return NextResponse.json({ ok: true, id, total: grid.total });
}

export async function PATCH(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const b = (await request.json().catch(() => null)) as { id?: string; shared?: boolean } | null;
  if (!b?.id || typeof b.shared !== "boolean") return jsonError("Paramètres invalides", 400);
  await setObservationShared(b.id, b.shared);
  return NextResponse.json({ ok: true });
}
