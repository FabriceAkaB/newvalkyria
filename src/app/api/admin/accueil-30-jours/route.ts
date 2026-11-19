import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { saveOnboardingSettings } from "@/lib/onboarding-30-days-repo";

/** Interrupteur de l'accueil des 30 premiers jours et lien de la vidéo de bienvenue de JP (admin et gérante). */
export async function POST(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin", "gerante"] }))) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { active?: unknown; videoUrl?: unknown } | null;
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() : undefined;
  if (videoUrl && !/^https:\/\/\S+$/.test(videoUrl)) return NextResponse.json({ error: "Le lien de la vidéo doit commencer par https://" }, { status: 400 });
  try {
    await saveOnboardingSettings({ active: typeof body.active === "boolean" ? body.active : undefined, videoUrl });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur." }, { status: 500 });
  }
}
