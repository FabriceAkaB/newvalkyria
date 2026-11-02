import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { createExercise, getExercises, parseExerciseBody } from "@/lib/exercises-repo";
import { jsonError } from "@/lib/http";

export async function GET() {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const exercises = await getExercises();
  return NextResponse.json({ exercises });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.title !== "string" || !body.title.trim()) {
    return jsonError("Titre requis", 400);
  }

  const id = await createExercise(parseExerciseBody(body));
  return NextResponse.json({ ok: true, id }, { status: 201 });
}
