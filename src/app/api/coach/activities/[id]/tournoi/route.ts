import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoachActivityAccess } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";
import { handleTournamentRequest } from "@/lib/practice-tournament-repo";

export const dynamic = "force-dynamic";

/** Tournoi de fin de pratique dans le portail des éducateurs (toute l'équipe qui voit la pratique). */
async function handle(request: Request, id: string) {
  const coachId = await getCurrentCoachId();
  if (!coachId || !(await getCoachActivityAccess(coachId, id))) return jsonError("Non autorisé", 401);
  const body = request.method === "PUT" ? await request.json().catch(() => null) : null;
  return handleTournamentRequest(request.method, id, body, coachId);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(request, (await params).id);
}
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(request, (await params).id);
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(request, (await params).id);
}
