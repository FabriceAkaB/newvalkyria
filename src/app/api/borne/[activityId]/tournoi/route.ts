import { jsonError } from "@/lib/http";
import { handleTournamentRequest } from "@/lib/practice-tournament-repo";
import { checkKioskKey } from "@/lib/survey-kiosk";

export const dynamic = "force-dynamic";

/** Tournoi de fin de pratique sur la borne (code 180180) : ouvert avec la clé de la pratique, sans connexion. */
async function handle(request: Request, activityId: string) {
  const url = new URL(request.url);
  const body = request.method === "GET" || request.method === "DELETE" ? null : await request.json().catch(() => null);
  const cle = url.searchParams.get("cle") ?? (body as { cle?: unknown } | null)?.cle;
  if (!checkKioskKey(activityId, cle)) return jsonError("Lien invalide", 403);
  return handleTournamentRequest(request.method, activityId, body, "Borne");
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
