import { after, NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { answerInvite } from "@/lib/practice-invites-repo";

/** Réponse du parent à l'invitation à l'avancé (oui / non). Un oui : le robot l'ajoute dans MonClubSportif. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = (await request.json().catch(() => null)) as { accept?: unknown } | null;
  if (typeof body?.accept !== "boolean") return jsonError("Réponse invalide", 400);
  const r = await answerInvite(token, body.accept);
  if (!r) return jsonError("Invitation introuvable", 404);
  if (r.status === "acceptee") {
    after(async () => {
      const { runPracticeInvites } = await import("@/lib/practice-invites-repo");
      await runPracticeInvites().catch(() => null);
    });
  }
  return NextResponse.json({ status: r.status });
}
