import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-repo";
import { jsonError } from "@/lib/http";
import type { TournamentAnswer } from "@/lib/tournaments-core";
import { createTournament, giveGo, importSurveyInterest, setResponse, updateTournament, withdrawOffer, type TournamentInput } from "@/lib/tournaments-repo";

/** Tournois, côté JP (rôle admin seulement : il y a de l'argent) : créer, régler, reprendre le sondage, noter une
 *  réponse donnée de vive voix, donner le go, retirer une place. */
const ANSWERS: TournamentAnswer[] = ["interessee", "disponible", "pas_cette_fois"];

export async function POST(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const b = (await request.json().catch(() => null)) as ({ action?: string; slug?: string; responseId?: string; firstName?: string; lastName?: string; answer?: string; birthYear?: number; parentEmail?: string; parentName?: string } & Partial<TournamentInput>) | null;
  if (!b?.action) return jsonError("Action manquante", 400);
  try {
    if (b.action === "creer") {
      if (!b.name?.trim()) return jsonError("Donne un nom au tournoi.", 400);
      const slug = await createTournament(b as TournamentInput);
      return NextResponse.json({ ok: true, slug });
    }
    if (!b.slug) return jsonError("Tournoi manquant", 400);
    if (b.action === "regler") {
      await updateTournament(b.slug, b);
      return NextResponse.json({ ok: true });
    }
    if (b.action === "sondage") return NextResponse.json({ ok: true, ...(await importSurveyInterest(b.slug)) });
    if (b.action === "reponse") {
      const answer = b.answer as TournamentAnswer;
      if (!b.firstName || !ANSWERS.includes(answer)) return jsonError("Réponse incomplète", 400);
      const res = await setResponse({ slug: b.slug, firstName: b.firstName, lastName: b.lastName ?? "", answer, source: "admin", birthYear: b.birthYear ?? null, parentEmail: b.parentEmail ?? null, parentName: b.parentName ?? null });
      if (!res.ok) return jsonError(res.error, 422);
      return NextResponse.json({ ok: true });
    }
    if (b.action === "go") {
      const res = await giveGo(b.slug, "JP");
      if (!res.ok) return jsonError(res.error, 422);
      await logAudit({ actorRole: "admin", actorLabel: "JP", action: "tournoi_go", entityType: "session_program", entityId: b.slug, after: res }).catch(() => null);
      return NextResponse.json(res);
    }
    if (b.action === "retirer" && b.responseId) {
      await withdrawOffer(b.responseId);
      return NextResponse.json({ ok: true });
    }
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur", 422);
  }
  return jsonError("Action inconnue", 400);
}
