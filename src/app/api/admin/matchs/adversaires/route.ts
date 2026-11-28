import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { addManualTeam, removeManualTeam, setOpponentArchived, updateTeam } from "@/lib/match-opponents-repo";

export const dynamic = "force-dynamic";

const year = z.number().int().min(2000).max(2030);
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    orgName: z.string().trim().min(1).max(120),
    teamLabel: z.string().trim().max(80).default(""),
    gender: z.enum(["filles", "garcons", "mixte"]).nullable().default(null),
    birthYear: year.nullable().default(null),
    birthYearTo: year.nullable().default(null),
    level: z.string().trim().max(40).default(""),
    players: z.number().int().min(1).max(60).nullable().default(null),
    count: z.number().int().min(1).max(20).default(1),
    contactName: z.string().trim().max(120).default(""),
    contactEmail: z.string().trim().max(160).default(""),
    contactPhone: z.string().trim().max(40).default(""),
    notes: z.string().trim().max(500).nullable().default(null)
  }),
  z.object({ action: z.literal("update"), id: z.string().uuid(), count: z.number().int().min(1).max(20).optional(), players: z.number().int().min(1).max(60).nullable().optional(), level: z.string().trim().max(40).optional(), notes: z.string().trim().max(500).nullable().optional() }),
  z.object({ action: z.literal("remove"), id: z.string().uuid() }),
  z.object({ action: z.literal("archive"), key: z.string().min(1).max(120), archived: z.boolean() })
]);

/** Adversaires (Matchs & arbitres) : ajouter un club ou une équipe à la main, sa catégorie et combien d'équipes,
 *  archiver un club. */
export async function POST(request: Request) {
  if (!(await isAdminRequest({ roles: ["admin", "gerante"] }))) return jsonError("Non autorisé", 401);
  try {
    const b = schema.parse(await request.json());
    if (b.action === "add") {
      if (b.contactEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.contactEmail)) return jsonError("Courriel invalide.", 422);
      await addManualTeam({ ...b, birthYearTo: b.birthYearTo });
    } else if (b.action === "update") await updateTeam(b.id, b);
    else if (b.action === "remove") await removeManualTeam(b.id);
    else await setOpponentArchived(b.key, b.archived);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) return jsonError("Données invalides", 400);
    return jsonError(err instanceof Error ? err.message : "Erreur", 422);
  }
}
