import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { addChannelStat } from "@/lib/marketing-stats";
import { addRecovery, resolveRecovery } from "@/lib/mandalart-levers";
import { addCustomTask, addKpiValue, setAgentState, setTaskFixed, setTaskStatus } from "@/lib/mandalart-repo";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("status"),
    code: z.string().min(3).max(20),
    status: z.enum(["a_faire", "en_cours", "fait", "abandonne"]),
    note: z.string().max(2000).optional(),
    evidenceUrl: z.string().max(1000).optional()
  }),
  z.object({ action: z.literal("fixed"), code: z.string().min(3).max(20), fixed: z.boolean() }),
  z.object({
    action: z.literal("add-task"),
    objective: z.string().regex(/^P\d\.\d$/),
    title: z.string().min(3).max(400),
    level: z.number().int().min(1).max(6),
    priority: z.enum(["star", "progressive"]),
    due: date.nullable(),
    owner: z.string().max(80).nullable()
  }),
  z.object({ action: z.literal("kpi"), kpiId: z.string().min(2).max(60), value: z.number().finite(), measuredAt: date.optional(), note: z.string().max(500).nullable().optional() }),
  z.object({
    action: z.literal("agent"),
    itemId: z.string().regex(/^(A|AU)\d\d$/),
    status: z.enum(["a_creer", "en_construction", "actif", "pause"]),
    mode: z.enum(["assistant", "semi-automatique", "autonome"]).nullable().optional(),
    hoursSavedWeek: z.number().min(0).max(100).nullable().optional(),
    note: z.string().max(1000).nullable().optional()
  }),
  z.object({ action: z.literal("recovery-add"), label: z.string().min(2).max(200), amountCents: z.number().int().positive().max(100_000_000), note: z.string().max(500).nullable().optional() }),
  z.object({ action: z.literal("recovery-resolve"), id: z.string().uuid() }),
  z.object({
    action: z.literal("channel"),
    channel: z.enum(["instagram", "facebook", "youtube", "tiktok", "pub_meta", "pub_google", "autre"]),
    measuredAt: date.optional(),
    followers: z.number().int().min(0).nullable().optional(),
    posts: z.number().int().min(0).nullable().optional(),
    views: z.number().int().min(0).nullable().optional(),
    spendCents: z.number().int().min(0).nullable().optional(),
    leads: z.number().int().min(0).nullable().optional(),
    note: z.string().max(500).nullable().optional()
  })
]);

/** Écritures du Mandalart (admin seulement) : statut d'une tâche, tâche ajoutée, valeur d'indicateur,
 *  état d'un agent ou d'une automatisation, statistiques des réseaux. */
export async function POST(request: Request) {
  if ((await getCurrentAdminRole()) !== "admin") return jsonError("Non autorisé", 401);
  try {
    const body = schema.parse(await request.json());
    if (body.action === "status") {
      await setTaskStatus({ code: body.code, status: body.status, note: body.note, evidenceUrl: body.evidenceUrl, by: "JP" });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "fixed") {
      await setTaskFixed(body.code, body.fixed, "JP");
      return NextResponse.json({ ok: true });
    }
    if (body.action === "add-task") {
      const code = await addCustomTask({ ...body, by: "JP" });
      return NextResponse.json({ ok: true, code });
    }
    if (body.action === "kpi") {
      await addKpiValue({ kpiId: body.kpiId, value: body.value, measuredAt: body.measuredAt, note: body.note ?? null });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "agent") {
      await setAgentState(body);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "recovery-add") {
      await addRecovery(body.label, body.amountCents, body.note ?? null);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "recovery-resolve") {
      await resolveRecovery(body.id);
      return NextResponse.json({ ok: true });
    }
    await addChannelStat(body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) return jsonError("Données invalides", 400);
    console.error("Mandalart POST failed", err);
    return jsonError(err instanceof Error ? err.message : "Erreur", 500);
  }
}
