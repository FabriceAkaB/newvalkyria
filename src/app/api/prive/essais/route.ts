import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { sendBoysTrialConfirmationEmail } from "@/lib/email";
import { createTrial, getTrialSessions, TrialError } from "@/lib/boys-trials-repo";
import { isValidPhone } from "@/lib/form-validation";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug) return jsonError("Programme requis", 400);
  return NextResponse.json({ sessions: await getTrialSessions(slug) });
}

const schema = z.object({
  slug: z.string().min(1),
  dateId: z.string().min(1, "Choisissez une pratique."),
  playerFirstName: z.string().trim().min(1, "Prénom de l'enfant requis"),
  playerLastName: z.string().trim().min(1, "Nom de l'enfant requis"),
  birthYear: z.number().int().min(2000).max(2026),
  parentName: z.string().trim().min(2, "Nom du parent requis"),
  parentEmail: z.string().trim().email("Courriel invalide"),
  parentPhone: z.string().refine(isValidPhone, "Numéro de téléphone invalide (10 chiffres)"),
  notes: z.string().optional()
});

/** Réserve un essai gratuit sur une pratique du mardi — sans paiement. */
export async function POST(request: Request) {
  try {
    const p = schema.parse(await request.json());
    const { trial, session, programName } = await createTrial({
      slug: p.slug,
      dateId: p.dateId,
      playerFirstName: p.playerFirstName,
      playerLastName: p.playerLastName,
      birthYear: p.birthYear,
      parentName: p.parentName,
      parentEmail: p.parentEmail,
      parentPhone: p.parentPhone,
      notes: p.notes?.trim() || null
    });
    void sendBoysTrialConfirmationEmail({
      to: p.parentEmail,
      parentName: p.parentName,
      playerName: `${p.playerFirstName} ${p.playerLastName}`.trim(),
      programName,
      date: session.date,
      start: session.start.slice(0, 5),
      end: session.end.slice(0, 5),
      location: session.location
    }).catch((err) => console.error("Unable to send trial confirmation email", err));
    return NextResponse.json({ ok: true, id: trial.id, date: session.date, start: session.start, end: session.end, location: session.location });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Données invalides", 422);
    if (error instanceof TrialError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}
