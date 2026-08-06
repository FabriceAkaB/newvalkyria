import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { createActivity, getActivities } from "@/lib/coaches-repo";
import { jsonError } from "@/lib/http";

export async function GET(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const activities = await getActivities({ from, to });
  return NextResponse.json({ activities });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);

  const body = (await request.json().catch(() => null)) as {
    activityDate?: string;
    startTime?: string;
    endTime?: string;
    location?: string | null;
    category?: string | null;
    activityType?: string;
    title?: string | null;
    notes?: string | null;
  } | null;

  if (!body?.activityDate || !body.startTime || !body.endTime || !body.activityType) {
    return jsonError("Date, heures et type d'activité requis", 400);
  }
  if (body.endTime <= body.startTime) {
    return jsonError("L'heure de fin doit être après l'heure de début", 400);
  }

  const id = await createActivity({
    activityDate: body.activityDate,
    startTime: body.startTime,
    endTime: body.endTime,
    location: body.location || null,
    category: body.category || null,
    activityType: body.activityType,
    title: body.title || null,
    notes: body.notes || null
  });

  return NextResponse.json({ ok: true, id }, { status: 201 });
}
