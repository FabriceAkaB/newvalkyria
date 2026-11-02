import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { createTest, updateTest, type TestPatch } from "@/lib/skill-tests-repo";

/** Catalogue des tests du passeport : JP crée, ajuste (protocole, seuils de chaque niveau) et valide chaque test. */
function parsePatch(body: Record<string, unknown>): TestPatch {
  const p: TestPatch = {};
  if (typeof body.name === "string") p.name = body.name;
  if (typeof body.gesture === "string" || body.gesture === null) p.gesture = body.gesture as string | null;
  if (typeof body.unit === "string") p.unit = body.unit;
  if (typeof body.higherIsBetter === "boolean") p.higherIsBetter = body.higherIsBetter;
  if (body.durationSeconds === null || (typeof body.durationSeconds === "number" && body.durationSeconds > 0)) p.durationSeconds = body.durationSeconds as number | null;
  if (typeof body.protocol === "string" || body.protocol === null) p.protocol = body.protocol as string | null;
  if (body.thresholds && typeof body.thresholds === "object") p.thresholds = body.thresholds as Record<string, number | null>;
  if (typeof body.active === "boolean") p.active = body.active;
  if (typeof body.validated === "boolean") p.validated = body.validated;
  return p;
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const id = await createTest(parsePatch(body));
  return NextResponse.json({ ok: true, id }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.id !== "string") return jsonError("Paramètres invalides", 400);
  await updateTest(body.id, parsePatch(body));
  return NextResponse.json({ ok: true });
}
