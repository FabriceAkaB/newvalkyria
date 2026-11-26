import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { handleTournamentRequest } from "@/lib/practice-tournament-repo";

export const dynamic = "force-dynamic";

/** Tournoi de fin de pratique dans l'admin (fiche de la pratique). */
async function handle(request: Request, activityId: string) {
  if (!(await isAdminRequest({ roles: ["admin", "gerante"] }))) return jsonError("Non autorisé", 401);
  const body = request.method === "PUT" ? await request.json().catch(() => null) : null;
  return handleTournamentRequest(request.method, activityId, body, "JP");
}

export async function GET(request: Request, { params }: { params: Promise<{ activityId: string }> }) {
  return handle(request, (await params).activityId);
}
export async function PUT(request: Request, { params }: { params: Promise<{ activityId: string }> }) {
  return handle(request, (await params).activityId);
}
export async function DELETE(request: Request, { params }: { params: Promise<{ activityId: string }> }) {
  return handle(request, (await params).activityId);
}
