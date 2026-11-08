import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-repo";
import { jsonError } from "@/lib/http";
import { adminPlayerData, assignVideo, deleteVideo, setVideoPublished } from "@/lib/match-videos";
import { saveVeoCredentials } from "@/lib/veo-config";
import { importVeoLinks, syncVeo } from "@/lib/veo-robot";
import { archiveVideos } from "@/lib/video-archive";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("veo"), email: z.string().email().max(200), password: z.string().min(4).max(200), club: z.string().max(120).nullable().optional() }),
  z.object({ action: z.literal("veo-sync") }),
  z.object({ action: z.literal("archive") }),
  z.object({ action: z.literal("veo-links"), links: z.array(z.string().max(500)).min(1).max(30) }),
  z.object({
    action: z.literal("assign"),
    id: z.string().uuid(),
    kind: z.enum(["match", "pratique"]),
    teamId: z.string().uuid().nullable(),
    mcsEventId: z.number().int().positive().nullable(),
    activityId: z.string().uuid().nullable(),
    teamName: z.string().min(1).max(200)
  }),
  z.object({ action: z.literal("publish"), id: z.string().uuid(), publish: z.boolean() }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() })
]);

const audit = (entityId: string, entityLabel: string, entityType = "match_video") => logAudit({ actorRole: "admin", actorLabel: "JP", action: "update", entityType, entityId, entityLabel }).catch(() => null);

/** Aperçu d'une vidéo pour l'admin (lien Veo, périodes, temps forts). */
export async function GET(request: Request) {
  if ((await getCurrentAdminRole()) !== "admin") return jsonError("Réservé à l'administrateur.", 403);
  const data = await adminPlayerData(new URL(request.url).searchParams.get("play") ?? "").catch(() => null);
  if (!data) return jsonError("Vidéo introuvable.", 404);
  return NextResponse.json(data);
}

/** Matchs et pratiques filmés : compte Veo, aller chercher dans Veo, ranger à la main, retirer. Admin seulement. */
export async function POST(request: Request) {
  if ((await getCurrentAdminRole()) !== "admin") return jsonError("Réservé à l'administrateur.", 403);
  try {
    const p = schema.parse(await request.json());
    if (p.action === "veo") {
      await saveVeoCredentials(p.email, p.password, p.club ?? null);
      await audit("veo", "Compte Veo enregistré (mot de passe chiffré)", "settings");
      return NextResponse.json({ ok: true });
    }
    if (p.action === "veo-sync") return NextResponse.json(await syncVeo());
    if (p.action === "archive") return NextResponse.json({ ok: true, ...(await archiveVideos({ deadline: Date.now() + 100_000 })) });
    if (p.action === "veo-links") return NextResponse.json({ ok: true, results: await importVeoLinks(p.links) });
    if (p.action === "assign") {
      await assignVideo(p.id, p);
      await audit(p.id, `Rangée : ${p.teamName} (${p.kind})`);
      return NextResponse.json({ ok: true });
    }
    if (p.action === "publish") {
      await setVideoPublished(p.id, p.publish);
      await audit(p.id, p.publish ? "Remise dans l'espace client" : "Retirée de l'espace client");
      return NextResponse.json({ ok: true });
    }
    await deleteVideo(p.id);
    await audit(p.id, "Retirée du site (reste dans Veo)");
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Données invalides", 422);
    return jsonError(error instanceof Error ? error.message : "Erreur", 500);
  }
}
