import { NextResponse } from "next/server";

import { parcoursRef } from "@/lib/family-passport";
import { hasOpenMeetingRequest } from "@/lib/family-passport-repo";
import { jsonError } from "@/lib/http";
import { getParentUserId } from "@/lib/parent-auth";
import { getFamilyRegistrations, getVerifiedParentEmail } from "@/lib/parent-repo";
import { syncRefTask } from "@/lib/team-tasks-repo";

/** Espace famille, Mon parcours : le parent demande la rencontre fille-parent-coach de 10 minutes (P1.7.10).
 *  Crée une tâche pour JP (ref parcours:<inscription>) ; une seule demande ouverte à la fois par fille. */
export async function POST(request: Request) {
  const userId = await getParentUserId();
  if (!userId) return jsonError("Connectez-vous d'abord.", 401);
  const b = (await request.json().catch(() => null)) as { registrationId?: string; message?: string } | null;
  if (typeof b?.registrationId !== "string") return jsonError("Paramètres invalides", 400);
  const [family, email] = await Promise.all([getFamilyRegistrations(userId), getVerifiedParentEmail(userId)]);
  const girl = family.find((f) => f.registrationId === b.registrationId);
  if (!girl) return jsonError("Cette joueuse n'est pas reliée à votre compte.", 403);
  if (await hasOpenMeetingRequest(girl.registrationId)) return jsonError("Votre demande est déjà reçue : nous vous écrivons pour fixer le moment.", 409);

  const message = typeof b.message === "string" ? b.message.trim().slice(0, 500) : "";
  const due = new Date(Date.now() + 7 * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const name = `${girl.firstName} ${girl.lastName}`.trim();
  await syncRefTask(parcoursRef(girl.registrationId), {
    title: `Rencontre fille-parent-coach de 10 minutes : ${name}`,
    details: [
      `Demandée par sa famille dans l'espace famille (Progression, Mon parcours).`,
      email ? `Courriel du parent : ${email}` : null,
      message ? `Message du parent : ${message}` : null,
      `Fixer le moment avec la famille et l'éducatrice, puis revoir ensemble son passeport et ses objectifs.`
    ]
      .filter(Boolean)
      .join("\n"),
    due
  });
  return NextResponse.json({ ok: true });
}
