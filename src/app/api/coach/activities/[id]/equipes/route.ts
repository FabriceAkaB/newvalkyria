import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoachActivityWithRoster } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";
import { TEAM_COLORS } from "@/lib/practice-teams-core";
import { confirmTeams, getTeamsForActivity, proposeTeams, rateCaptain, saveTeams } from "@/lib/practice-teams-repo";

/** Équipes, duos et capitaines d'une pratique (portail) : proposer des équipes nouvelles, les enregistrer,
 *  noter le leadership de chaque capitaine. Règles : practice-teams-core.ts. */
async function access(id: string) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return null;
  const entry = await getCoachActivityWithRoster(coachId, id);
  return entry ? { coachId, entry } : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await access(id))) return jsonError("Non autorisé", 401);
  return NextResponse.json({ teams: await getTeamsForActivity(id) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await access(id);
  if (!a) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as Record<string, any> | null;
  const kind = body?.kind === "duo" ? "duo" : "equipe";
  const roster = new Set(a.entry.roster.map((p: { registrationId: string }) => p.registrationId));
  if (body?.action === "proposer") {
    const players = (Array.isArray(body.players) ? body.players : []).filter((p: unknown): p is string => typeof p === "string" && roster.has(p));
    if (players.length < 2) return jsonError("Il faut au moins 2 joueuses présentes.", 422);
    const count = Math.max(2, Math.min(6, Number(body.count) || 2));
    const activity = a.entry.activity as { category?: string | null; title?: string | null };
    const proposal = await proposeTeams({ activityId: id, players, kind, count, theme: typeof body.theme === "string" ? body.theme : null, group: activity.category ?? activity.title ?? null, seed: Number(body.seed) || Date.now() });
    return NextResponse.json({ proposal });
  }
  if (body?.action === "enregistrer") {
    const teams = (Array.isArray(body.teams) ? body.teams : [])
      .map((t: any) => ({
        label: String(t?.label ?? "Équipe"),
        members: (Array.isArray(t?.members) ? t.members : []).filter((m: unknown): m is string => typeof m === "string" && roster.has(m)),
        captain: typeof t?.captain === "string" ? t.captain : null,
        captainTask: typeof t?.captainTask === "string" ? t.captainTask : null,
        color: typeof t?.color === "string" && TEAM_COLORS.some((c) => c.name === t.color) ? t.color : null
      }))
      .filter((t: { members: string[] }) => t.members.length);
    // Une couleur par équipe : le nom de l'équipe est sa couleur.
    for (const t of teams) if (kind === "equipe" && t.color) t.label = t.color;
    return NextResponse.json({ teams: await saveTeams(id, kind, teams, a.coachId) });
  }
  if (body?.action === "confirmer") {
    // Les équipes préparées d'avance ont bien été jouées telles quelles.
    await confirmTeams(id, kind);
    return NextResponse.json({ teams: await getTeamsForActivity(id) });
  }
  return jsonError("Action invalide", 400);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await access(id);
  if (!a) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as { teamId?: string; leadership?: number | null; note?: string | null } | null;
  if (!body?.teamId) return jsonError("Équipe manquante", 400);
  const leadership = body.leadership == null ? null : Math.round(Number(body.leadership));
  if (leadership !== null && (leadership < 1 || leadership > 5)) return jsonError("Note de 1 à 5", 400);
  await rateCaptain(body.teamId, id, leadership, typeof body.note === "string" ? body.note.trim() : null, a.coachId);
  return NextResponse.json({ ok: true });
}
