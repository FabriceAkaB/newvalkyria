import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/http";
import { PARENT_COOKIE_MAX_AGE, PARENT_COOKIE_NAME } from "@/lib/parent-auth";
import { createParentSession, signUpParent } from "@/lib/parent-repo";
import { parentSignUpSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const payload = parentSignUpSchema.parse(await request.json());

    const result = await signUpParent(payload.email, payload.password, payload.fullName);
    if ("error" in result) return jsonError(result.error, 422);

    const token = await createParentSession(result.userId);

    const response = NextResponse.json({ ok: true }, { status: 201 });
    response.cookies.set(PARENT_COOKIE_NAME, token, {
      httpOnly: true,
      path: "/",
      maxAge: PARENT_COOKIE_MAX_AGE,
      sameSite: "lax"
    });
    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Données invalides", 422);
    }
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}
