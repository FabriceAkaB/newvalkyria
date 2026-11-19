import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { sendPasswordLink } from "@/lib/coach-auth";
import { jsonError } from "@/lib/http";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Invitation d'un éducateur : un lien de 7 jours pour choisir son mot de passe ; il se connecte ensuite avec son courriel. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const { data: coach } = await (getSupabaseAdminClient() as any).from("coaches").select("email").eq("id", id).maybeSingle();
  if (!coach?.email) return jsonError("Ajoute d'abord le courriel de l'éducateur.", 400);
  try {
    const sent = await sendPasswordLink(coach.email, "invitation");
    if (!sent) return jsonError("Invitation non envoyée (éducateur inactif ou trop de demandes dans l'heure).", 400);
    return NextResponse.json({ ok: true, email: coach.email });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Erreur", 500);
  }
}
