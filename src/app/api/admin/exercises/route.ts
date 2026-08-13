import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { createExercise, getExercises } from "@/lib/exercises-repo";
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

  const id = await createExercise({
    title: (body.title as string).trim(),
    objective: (body.objective as string) || null,
    category: (body.category as string) || null,
    level: (body.level as string) || null,
    durationMinutes: typeof body.durationMinutes === "number" ? body.durationMinutes : null,
    material: (body.material as string) || null,
    minPlayers: typeof body.minPlayers === "number" ? body.minPlayers : null,
    maxPlayers: typeof body.maxPlayers === "number" ? body.maxPlayers : null,
    dimensions: (body.dimensions as string) || null,
    instructions: (body.instructions as string) || null,
    variants: (body.variants as string) || null,
    coachingPoints: (body.coachingPoints as string) || null,
    commonMistakes: (body.commonMistakes as string) || null,
    videoUrl: (body.videoUrl as string) || null
  });

  return NextResponse.json({ ok: true, id }, { status: 201 });
}
