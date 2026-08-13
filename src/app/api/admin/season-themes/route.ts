import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getSeasonThemes, setSeasonTheme } from "@/lib/season-themes-repo";

export async function GET(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { searchParams } = new URL(request.url);
  const seasonId = searchParams.get("seasonId");
  if (!seasonId) return jsonError("seasonId requis", 400);
  const themes = await getSeasonThemes(seasonId);
  return NextResponse.json({ themes });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);

  const body = (await request.json().catch(() => null)) as { seasonId?: string; weekStartDate?: string; theme?: string; notes?: string | null } | null;
  if (!body?.seasonId || !body.weekStartDate || !body.theme?.trim()) {
    return jsonError("Saison, semaine et thème requis", 400);
  }

  try {
    await setSeasonTheme({ seasonId: body.seasonId, weekStartDate: body.weekStartDate, theme: body.theme.trim(), notes: body.notes?.trim() || null });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}
