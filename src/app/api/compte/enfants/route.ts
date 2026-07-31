import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/http";
import { getParentUserId } from "@/lib/parent-auth";
import { createChild, getChildrenForParent } from "@/lib/parent-repo";
import { childSchema } from "@/lib/validations";

export async function GET() {
  const userId = await getParentUserId();
  if (!userId) return jsonError("Non autorisé", 401);

  const children = await getChildrenForParent(userId);
  return NextResponse.json({ children });
}

export async function POST(request: Request) {
  const userId = await getParentUserId();
  if (!userId) return jsonError("Non autorisé", 401);

  try {
    const payload = childSchema.parse(await request.json());
    const id = await createChild(userId, {
      firstName: payload.firstName,
      lastName: payload.lastName,
      dob: payload.dob,
      level: payload.level || null,
      club: payload.club || null
    });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Données invalides", 422);
    }
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}
