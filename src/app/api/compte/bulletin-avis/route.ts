import { NextResponse } from "next/server";

import { normalizeFeedback } from "@/lib/bulletin-feedback";
import { saveFeedback } from "@/lib/bulletin-feedback-repo";
import { jsonError } from "@/lib/http";
import { getParentUserId } from "@/lib/parent-auth";
import { getChildrenForParent, getFamilyRegistrations, getParentAccount } from "@/lib/parent-repo";
import { getRegistrationById } from "@/lib/season-admin-repo";

/** Espace famille : « Ce bulletin vous est-il utile ? » (P4.8.11). Seulement pour une fille reliée à ce compte. */
export async function POST(request: Request) {
  const userId = await getParentUserId();
  if (!userId) return jsonError("Connectez-vous d'abord.", 401);
  const parsed = normalizeFeedback(await request.json().catch(() => null));
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const { registrationId } = parsed.value;

  const [family, children, registration, account] = await Promise.all([
    getFamilyRegistrations(userId),
    getChildrenForParent(userId),
    getRegistrationById(registrationId),
    getParentAccount(userId)
  ]);
  const owns =
    family.some((f) => f.registrationId === registrationId) ||
    Boolean(registration?.player_id && children.some((c) => c.player_id === registration.player_id));
  if (!owns) return jsonError("Cette joueuse n'est pas reliée à votre compte.", 403);

  await saveFeedback(userId, account?.email ?? null, parsed.value);
  return NextResponse.json({ ok: true });
}
