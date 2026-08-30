import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getEvaluation, saveEvaluation } from "@/lib/tryout-repo";
import { tryoutEvaluationSaveSchema } from "@/lib/validations";

export async function GET(_request: Request, { params }: { params: Promise<{ participantId: string; evaluatorId: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { participantId, evaluatorId } = await params;
  const evaluation = await getEvaluation(participantId, evaluatorId);
  return NextResponse.json({ evaluation });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ participantId: string; evaluatorId: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { participantId, evaluatorId } = await params;
  try {
    const body = await request.json();
    const payload = tryoutEvaluationSaveSchema.partial().parse(body);
    const evaluation = await saveEvaluation(participantId, evaluatorId, {
      criteriaScores: payload.criteriaScores,
      comment: payload.comment,
      commentInternal: payload.commentInternal,
      completed: payload.completed
    });
    return NextResponse.json({ evaluation });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Données invalides", 422);
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}
