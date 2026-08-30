import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { createEvent, getAllEvents } from "@/lib/tryout-repo";
import { tryoutEventCreateSchema } from "@/lib/validations";

export async function GET() {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const events = await getAllEvents();
  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  try {
    const payload = tryoutEventCreateSchema.parse(await request.json());
    const id = await createEvent(payload);
    return NextResponse.json({ id });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Données invalides", 422);
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}
