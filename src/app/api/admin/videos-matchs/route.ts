import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-repo";
import { jsonError } from "@/lib/http";
import { saveVeoCredentials } from "@/lib/veo-config";
import { syncVeo } from "@/lib/veo-robot";
import { adminPlayerUrl, deleteVideo, importVideoFromUrl, publishVideo, refreshVideoStatuses, saveStreamConfig, startFileUpload } from "@/lib/match-videos";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const match = {
  kind: z.enum(["match", "pratique"]).default("match"),
  activityId: z.string().uuid().nullable().optional(),
  teamId: z.string().uuid().nullable(),
  mcsEventId: z.number().int().positive().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().min(2).max(200),
  opponent: z.string().max(200).nullable().optional()
};

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("config"), accountId: z.string().min(10).max(64), token: z.string().min(20).max(200) }),
  z.object({ action: z.literal("import-url"), ...match, url: z.string().url().max(4000) }),
  z.object({ action: z.literal("start-upload"), ...match, size: z.number().int().positive(), filename: z.string().min(1).max(300) }),
  z.object({ action: z.literal("refresh") }),
  z.object({ action: z.literal("veo-sync"), dryRun: z.boolean().default(false) }),
  z.object({ action: z.literal("veo"), email: z.string().email().max(200), password: z.string().min(4).max(200), club: z.string().max(120).nullable().optional() }),
  z.object({ action: z.literal("publish"), id: z.string().uuid(), publish: z.boolean(), confirmed: z.boolean().default(false) }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() })
]);

/** Aperçu d'une vidéo pour l'admin (lien signé). */
export async function GET(request: Request) {
  const role = await getCurrentAdminRole();
  if (role !== "admin") return jsonError("Réservé à l'administrateur.", 403);
  const id = new URL(request.url).searchParams.get("play") ?? "";
  const url = /^[0-9a-f-]{36}$/.test(id) ? await adminPlayerUrl(id).catch(() => null) : null;
  if (!url) return jsonError("Vidéo pas encore prête.", 404);
  return NextResponse.json({ url });
}

/** Matchs filmés pour l'espace client : brancher Cloudflare Stream, importer (lien Veo ou fichier), publier. Admin seulement. */
export async function POST(request: Request) {
  const role = await getCurrentAdminRole();
  if (role !== "admin") return jsonError("Réservé à l'administrateur.", 403);
  try {
    const p = schema.parse(await request.json());
    if (p.action === "config") {
      await saveStreamConfig(p.accountId, p.token);
      return NextResponse.json({ ok: true });
    }
    if (p.action === "import-url") {
      const id = await importVideoFromUrl({ ...p, by: "admin" });
      await logAudit({ actorRole: "admin", actorLabel: "JP", action: "create", entityType: "match_video", entityId: id, entityLabel: `${p.date} ${p.title}` }).catch(() => null);
      return NextResponse.json({ ok: true, id });
    }
    if (p.action === "start-upload") return NextResponse.json({ ok: true, ...(await startFileUpload({ ...p, by: "admin" })) });
    if (p.action === "veo") {
      await saveVeoCredentials(p.email, p.password, p.club ?? null);
      await logAudit({ actorRole: "admin", actorLabel: "JP", action: "update", entityType: "settings", entityId: "veo", entityLabel: "Compte Veo enregistré (mot de passe chiffré)" }).catch(() => null);
      return NextResponse.json({ ok: true });
    }
    if (p.action === "veo-sync") return NextResponse.json(await syncVeo({ dryRun: p.dryRun }));
    if (p.action === "refresh") {
      await refreshVideoStatuses();
      return NextResponse.json({ ok: true });
    }
    if (p.action === "publish") {
      const r = await publishVideo(p.id, p.publish, p.confirmed);
      if (!r.ok) return jsonError(r.reason ?? "Publication refusée.", 409);
      await logAudit({ actorRole: "admin", actorLabel: "JP", action: "update", entityType: "match_video", entityId: p.id, entityLabel: p.publish ? `Publiée aux familles${p.confirmed ? " (accord confirmé par JP)" : ""}` : "Retirée de l'espace client" }).catch(() => null);
      return NextResponse.json({ ok: true });
    }
    await deleteVideo(p.id);
    await logAudit({ actorRole: "admin", actorLabel: "JP", action: "delete", entityType: "match_video", entityId: p.id, entityLabel: "Vidéo supprimée" }).catch(() => null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Données invalides", 422);
    return jsonError(error instanceof Error ? error.message : "Erreur", 500);
  }
}
