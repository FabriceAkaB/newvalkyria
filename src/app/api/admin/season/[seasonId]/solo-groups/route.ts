import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import {
  createSoloGroup,
  getSeasonSoloGroupDates,
  getSoloGroupMembers,
  getSoloGroups,
  getUnassignedSoloEligibleRegistrations
} from "@/lib/season-admin-repo";

export async function GET(_request: Request, { params }: { params: Promise<{ seasonId: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { seasonId } = await params;

  try {
    const [groups, datesByGroup, membersByGroup, unassigned] = await Promise.all([
      getSoloGroups(seasonId),
      getSeasonSoloGroupDates(seasonId),
      getSoloGroupMembers(seasonId),
      getUnassignedSoloEligibleRegistrations(seasonId)
    ]);
    return NextResponse.json({ groups, datesByGroup, membersByGroup, unassigned });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur de chargement", 500);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ seasonId: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { seasonId } = await params;

  const body = (await request.json().catch(() => null)) as {
    label?: string;
    day?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    maxPlaces?: number;
  } | null;

  if (!body || !body.label || !body.day || !body.startTime || !body.endTime || !body.location || typeof body.maxPlaces !== "number") {
    return jsonError("Paramètres invalides", 400);
  }

  try {
    const id = await createSoloGroup(seasonId, {
      label: body.label,
      day: body.day,
      startTime: body.startTime,
      endTime: body.endTime,
      location: body.location,
      maxPlaces: body.maxPlaces
    });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur de création", 500);
  }
}
