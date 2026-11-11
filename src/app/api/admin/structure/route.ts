import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-repo";
import { jsonError } from "@/lib/http";
import { EMPLOYMENTS, NEED_STATUSES, STAGES, TEAMS, WEEKDAYS } from "@/lib/structure-core";
import { StructureInputError, deleteNeed, eraseCandidate, saveCandidate, saveNeed, saveStaff, setCandidateStage, setNeedStatus, setStaffActive } from "@/lib/structure-repo";

export const dynamic = "force-dynamic";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (AAAA-MM-JJ)");
const optDate = date.nullable().optional();
const optText = (max: number) => z.string().max(max, `Texte trop long (${max} caractères au plus)`).nullable().optional();
const email = z.union([z.string().trim().email("Courriel invalide"), z.literal("")]).nullable().optional();
const employment = z.enum(EMPLOYMENTS);
const stage = z.enum(STAGES);
const needStatus = z.enum(NEED_STATUSES);

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save-staff"),
    id: z.string().uuid().nullable().optional(),
    coachId: z.string().uuid().nullable().optional(),
    fullName: z.string().trim().min(1, "Nom requis").max(120, "Nom trop long"),
    role: z.string().trim().min(1, "Rôle requis").max(120, "Rôle trop long"),
    team: z.enum(TEAMS),
    employment: employment.nullable(),
    email,
    phone: optText(40),
    diplomas: optText(2000),
    certifications: z.array(z.object({ name: z.string().trim().max(120, "Nom de certification trop long"), issuedOn: optDate, expiresOn: optDate })).max(20, "20 certifications au plus").default([]),
    startedOn: optDate,
    notes: optText(2000),
    onField: z.boolean(),
    availableDays: z.array(z.enum(WEEKDAYS)).max(7),
    hourlyRateCents: z.number().int().min(0, "Taux horaire invalide").max(100_000, "Taux horaire trop élevé (1 000 $/h au plus)").nullable(),
    sortOrder: z.number().int().min(0).max(1000).nullable().optional()
  }),
  z.object({ action: z.literal("staff-active"), id: z.string().uuid(), active: z.boolean() }),
  z.object({
    action: z.literal("save-need"),
    id: z.string().uuid().nullable().optional(),
    position: z.string().trim().min(1, "Poste requis").max(160, "Poste trop long"),
    employment,
    headcount: z.number({ message: "Nombre de personnes invalide" }).int("Nombre de personnes invalide").min(1, "Au moins 1 personne").max(50, "50 personnes au plus"),
    dueOn: optDate,
    status: needStatus,
    season: optText(80),
    notes: optText(2000)
  }),
  z.object({ action: z.literal("need-status"), id: z.string().uuid(), status: needStatus }),
  z.object({ action: z.literal("delete-need"), id: z.string().uuid() }),
  z.object({
    action: z.literal("save-candidate"),
    id: z.string().uuid().nullable().optional(),
    needId: z.string().uuid().nullable().optional(),
    position: z.string().trim().min(1, "Poste requis").max(160, "Poste trop long"),
    fullName: z.string().trim().min(1, "Nom requis").max(120, "Nom trop long"),
    email,
    phone: optText(40),
    stage,
    interviewOn: optDate,
    notes: optText(2000)
  }),
  z.object({ action: z.literal("candidate-stage"), id: z.string().uuid(), stage }),
  z.object({ action: z.literal("erase-candidate"), id: z.string().uuid() })
]);

/** Messages de zod en anglais (« Too small… », « Invalid input… ») : remplacés par un message simple en français. */
function frenchIssue(err: ZodError): string {
  const msg = err.issues[0]?.message ?? "";
  return msg && !/^(invalid|too |expected|required)/i.test(msg) ? msg : "Données invalides";
}

/** Structure de l'Académie et recrutement (admin seulement : données RH). */
export async function POST(request: Request) {
  const role = await getCurrentAdminRole();
  if (role !== "admin") return jsonError("Non autorisé", 401);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Données invalides", 400);
  }
  try {
    const b = schema.parse(body);
    switch (b.action) {
      case "save-staff": {
        const { id, before } = await saveStaff({
          id: b.id ?? null,
          coachId: b.coachId ?? null,
          fullName: b.fullName,
          role: b.role,
          team: b.team,
          employment: b.employment ?? null,
          email: b.email || null,
          phone: b.phone ?? null,
          diplomas: b.diplomas ?? null,
          certifications: b.certifications,
          startedOn: b.startedOn ?? null,
          notes: b.notes ?? null,
          onField: b.onField,
          availableDays: b.availableDays,
          hourlyRateCents: b.hourlyRateCents,
          sortOrder: b.sortOrder ?? null
        });
        await logAudit({ actorRole: role, actorLabel: "JP", action: before ? "update" : "create", entityType: "staff_member", entityId: id, entityLabel: b.fullName, before, after: { role: b.role, team: b.team, employment: b.employment, onField: b.onField, availableDays: b.availableDays } });
        return NextResponse.json({ ok: true, id });
      }
      case "staff-active": {
        const { name } = await setStaffActive(b.id, b.active);
        await logAudit({ actorRole: role, actorLabel: "JP", action: b.active ? "reactivate" : "deactivate", entityType: "staff_member", entityId: b.id, entityLabel: name });
        return NextResponse.json({ ok: true });
      }
      case "save-need":
        return NextResponse.json({
          ok: true,
          id: await saveNeed({ id: b.id ?? null, position: b.position, employment: b.employment, headcount: b.headcount, dueOn: b.dueOn ?? null, status: b.status, season: b.season ?? null, notes: b.notes ?? null })
        });
      case "need-status":
        await setNeedStatus(b.id, b.status);
        return NextResponse.json({ ok: true });
      case "delete-need":
        await deleteNeed(b.id);
        return NextResponse.json({ ok: true });
      case "save-candidate":
        return NextResponse.json({
          ok: true,
          id: await saveCandidate({ id: b.id ?? null, needId: b.needId ?? null, position: b.position, fullName: b.fullName, email: b.email || null, phone: b.phone ?? null, stage: b.stage, interviewOn: b.interviewOn ?? null, notes: b.notes ?? null })
        });
      case "candidate-stage": {
        const c = await setCandidateStage(b.id, b.stage);
        return NextResponse.json({ ok: true, ...c });
      }
      case "erase-candidate": {
        const c = await eraseCandidate(b.id);
        await logAudit({ actorRole: role, actorLabel: "JP", action: "erase", entityType: "recruitment_candidate", entityId: b.id, entityLabel: c.name });
        return NextResponse.json({ ok: true });
      }
    }
  } catch (err) {
    if (err instanceof ZodError) return jsonError(frenchIssue(err), 400);
    if (err instanceof StructureInputError) return jsonError(err.message, 400);
    console.error("Structure POST failed", err);
    return jsonError(err instanceof Error ? err.message : "Erreur", 500);
  }
}
