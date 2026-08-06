import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { createCoach, getCoaches } from "@/lib/coaches-repo";
import { jsonError } from "@/lib/http";

export async function GET() {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const coaches = await getCoaches();
  return NextResponse.json({ coaches });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);

  const body = (await request.json().catch(() => null)) as {
    firstName?: string;
    lastName?: string;
    phone?: string | null;
    email?: string | null;
    role?: string;
    defaultHourlyRateCents?: number;
    hiredOn?: string | null;
    notes?: string | null;
  } | null;

  if (!body?.firstName?.trim() || !body.lastName?.trim()) {
    return jsonError("Prénom et nom requis", 400);
  }

  const id = await createCoach({
    firstName: body.firstName.trim(),
    lastName: body.lastName.trim(),
    phone: body.phone || null,
    email: body.email || null,
    role: body.role || "Entraîneur principal",
    defaultHourlyRateCents: Math.round(body.defaultHourlyRateCents ?? 0),
    hiredOn: body.hiredOn || null,
    notes: body.notes || null
  });

  return NextResponse.json({ ok: true, id }, { status: 201 });
}
