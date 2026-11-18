import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getActivityAttendance, getCoachActivityWithRoster } from "@/lib/coach-portal-repo";
import { PARTICIPATED } from "@/lib/coach-report";
import { jsonError } from "@/lib/http";
import { CHAMPION_KINDS, type ChampionKind } from "@/lib/player-points";
import { deleteChampionPost, getActivityChampions, publishChampions } from "@/lib/player-points-repo";

/** Championnes du jour publiées par l'éducateur : seulement des filles présentes à cette pratique ; la photo (si
 *  toutes ont l'autorisation) va dans le stockage privé ; les points se donnent selon le barème. */

const MAX_PHOTO = 8 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

async function access(id: string) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return { error: jsonError("Non autorisé", 401) } as const;
  const entry = await getCoachActivityWithRoster(coachId, id);
  if (!entry) return { error: jsonError("Activité introuvable", 404) } as const;
  return { coachId, entry } as const;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await access(id);
  if ("error" in a) return a.error;
  const form = await request.formData().catch(() => null);
  if (!form) return jsonError("Paramètres invalides", 400);
  const kind = String(form.get("kind") ?? "") as ChampionKind;
  if (!CHAMPION_KINDS.some((k) => k.kind === kind)) return jsonError("Type de championne invalide", 400);
  let ids: string[] = [];
  try {
    ids = JSON.parse(String(form.get("registrationIds") ?? "[]"));
  } catch {
    return jsonError("Paramètres invalides", 400);
  }
  if (!Array.isArray(ids) || ids.some((x) => typeof x !== "string")) return jsonError("Paramètres invalides", 400);
  const roster = new Set(a.entry.roster.map((p) => p.registrationId));
  if (ids.some((x) => !roster.has(x))) return jsonError("Une de ces joueuses n'est pas attendue à cette activité.", 403);
  const present = new Set((await getActivityAttendance(id)).filter((r) => PARTICIPATED.includes(r.status)).map((r) => r.registration_id));
  if (ids.some((x) => !present.has(x))) return jsonError("Marque d'abord leur présence : seule une joueuse présente peut être championne.", 422);

  const file = form.get("photo");
  let photo: { bytes: Uint8Array; contentType: string } | null = null;
  if (file && typeof file !== "string" && file.size > 0) {
    if (file.size > MAX_PHOTO) return jsonError("Photo trop lourde (8 Mo au plus).", 413);
    const type = TYPES.includes(file.type) ? file.type : "image/jpeg";
    photo = { bytes: new Uint8Array(await file.arrayBuffer()), contentType: type };
  }
  const result = await publishChampions({
    activityId: id,
    kind,
    registrationIds: ids,
    title: String(form.get("title") ?? ""),
    specialPoints: Number(form.get("points")),
    coachId: a.coachId,
    photo
  });
  const posts = await getActivityChampions(id);
  if (result.error && !result.postId) return NextResponse.json({ error: result.error, posts }, { status: 422 });
  return NextResponse.json({ ok: true, error: result.error, posts });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await access(id);
  if ("error" in a) return a.error;
  const body = (await request.json().catch(() => null)) as { postId?: string } | null;
  if (!body?.postId) return jsonError("Paramètres invalides", 400);
  await deleteChampionPost(body.postId, id);
  return NextResponse.json({ ok: true, posts: await getActivityChampions(id) });
}
