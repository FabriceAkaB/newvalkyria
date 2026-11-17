import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { GUIDE_ITEMS } from "@/lib/coach-guide";
import { getCoachActivityAccess } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";
import { getChecklist, saveChecklist } from "@/lib/practice-debriefs-repo";

/** Guide de l'éducateur : les cases cochées avant la pratique (alarmes, montage, matériel, rôles, capitaines…). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  if (!(await getCoachActivityAccess(coachId, id))) return jsonError("Activité introuvable", 404);
  return NextResponse.json({ checked: await getChecklist(id, coachId) });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  if (!(await getCoachActivityAccess(coachId, id))) return jsonError("Activité introuvable", 404);
  const body = (await request.json().catch(() => null)) as { checked?: unknown } | null;
  const valid = new Set<string>(GUIDE_ITEMS.map((i) => i.key));
  const checked = (Array.isArray(body?.checked) ? body!.checked : []).filter((k: unknown): k is string => typeof k === "string" && valid.has(k));
  await saveChecklist(id, coachId, checked);
  return NextResponse.json({ ok: true, checked });
}
