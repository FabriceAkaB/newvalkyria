import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { getClubGroups, setClubGroups, type ClubGroup } from "@/lib/club-aliases-store";
import { jsonError } from "@/lib/http";

export async function GET() {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }
  return NextResponse.json({ groups: await getClubGroups() });
}

export async function PUT(request: Request) {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }

  const body = (await request.json()) as { groups?: ClubGroup[] };
  if (!Array.isArray(body.groups)) {
    return jsonError("Format invalide", 400);
  }

  await setClubGroups(body.groups);
  return NextResponse.json({ ok: true, groups: await getClubGroups() });
}
