import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getSlotConfigs, setSlotConfigs, type SlotConfig } from "@/lib/timeslot-config-store";

export async function GET() {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }
  return NextResponse.json({ slots: await getSlotConfigs() });
}

export async function PUT(request: Request) {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }

  const body = (await request.json()) as { slots?: SlotConfig[] };
  if (!Array.isArray(body.slots)) {
    return jsonError("Format invalide", 400);
  }

  await setSlotConfigs(body.slots);
  return NextResponse.json({ ok: true, slots: await getSlotConfigs() });
}
